"""One scheduled check: health, daily verified audit backup and optional offsite delivery.

Credentials belong in the user's rclone configuration and environment, never this JSON.
"""
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
from email.message import EmailMessage
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import smtplib
import subprocess
import sys
import tempfile
import uuid
from process_options import background_options

ROOT = Path(__file__).resolve().parents[1]


def now():
    return datetime.now(timezone.utc).isoformat()


def write_json(path, value):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, indent=2), encoding='utf-8')
    os.replace(temporary, path)


def run(command, timeout=600):
    return subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=timeout, **background_options())


@contextmanager
def exclusive(path):
    with path.open('a+b') as handle:
        handle.seek(0)
        handle.write(b'0')
        handle.flush()
        handle.seek(0)
        if os.name == 'nt':
            import msvcrt
            msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            yield
        finally:
            handle.seek(0)
            if os.name == 'nt':
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(handle, fcntl.LOCK_UN)


def create_backup(project, directory):
    name = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ-') + uuid.uuid4().hex[:8]
    with tempfile.TemporaryDirectory(prefix='.pending-', dir=directory) as temporary:
        pending = Path(temporary)
        result = run([sys.executable, str(ROOT / 'scripts/backup_audit.py'), '--project', project,
                      '--output', str(pending / 'auditoria.sql'), '--verify-restore'])
        if result.returncode:
            raise RuntimeError('backup_or_restore_failed')
        manifest = json.loads((pending / 'auditoria.sql.json').read_text(encoding='utf-8'))
        if not manifest['restoreVerified'] or manifest['sha256'] != hashlib.sha256((pending / 'auditoria.sql').read_bytes()).hexdigest():
            raise RuntimeError('backup_integrity_failed')
        manifest['file'] = 'auditoria.sql'
        write_json(pending / 'auditoria.sql.json', manifest)
        completed = directory / name
        pending.rename(completed)
    return completed


def deliver(bundle, remote, executable):
    # Only named rclone remotes; no local destination disguised as offsite storage.
    if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_-]+:[^\r\n]*', remote):
        raise ValueError('Use a named rclone remote')
    destination = remote.rstrip('/') + '/' + bundle.name
    for arguments in (['copy', str(bundle), destination, '--immutable'],
                      ['check', str(bundle), destination, '--download', '--one-way']):
        if run([executable, *arguments], timeout=600).returncode:
            raise RuntimeError('offsite_upload_or_verification_failed')


def notify(config, report):
    smtp = config.get('smtp')
    if not smtp:
        return False
    # Require transport encryption; password supplied to the scheduled user's environment.
    message = EmailMessage()
    message['From'] = smtp['from']
    message['To'] = smtp['to']
    message['Subject'] = '[FinTech] ' + ('RECUPERADO' if report['healthy'] else 'INCIDENTE')
    message.set_content(json.dumps(report, indent=2))
    import ssl
    with smtplib.SMTP(smtp['host'], smtp.get('port', 587), timeout=20) as client:
        client.starttls(context=ssl.create_default_context())
        if smtp.get('user'):
            client.login(smtp['user'], os.environ[smtp.get('passwordEnv', 'FINTECH_SMTP_PASSWORD')])
        client.send_message(message)
    return True


def check(config, force_backup=False):
    project = config['project']
    if not re.fullmatch(r'[a-z0-9][a-z0-9_-]*', project):
        raise ValueError('Invalid Compose project')
    directory = Path(config['directory']).resolve()
    directory.mkdir(parents=True, exist_ok=True)
    with exclusive(directory / 'operations.lock'):
        state_path = directory / 'state.json'
        state = json.loads(state_path.read_text(encoding='utf-8')) if state_path.exists() else {}
        report = {'project': project, 'checkedAt': now(), 'healthy': True, 'issues': [],
                  'offsiteConfigured': bool(config.get('remote')), 'notificationsConfigured': bool(config.get('smtp'))}
        try:
            health = run([sys.executable, str(ROOT / 'scripts/audit_status.py'), '--project', project,
                          '--max-age-seconds', str(config.get('maxQueueAgeSeconds', 60))], timeout=90)
            report['health'] = json.loads(health.stdout)
            if health.returncode or not report['health']['healthy']:
                report['issues'].append('services_or_queues_unhealthy')
        except (OSError, subprocess.SubprocessError, ValueError, KeyError):
            report['issues'].append('monitor_unavailable')
        backups = directory / 'backups'
        backups.mkdir(exist_ok=True)
        stamp = state.get('lastBackupAt')
        due = not stamp or not Path(state.get('lastBackup', '')).is_dir() or (datetime.now(timezone.utc) - datetime.fromisoformat(stamp)).total_seconds() >= 86400
        if due or force_backup:
            try:
                bundle = create_backup(project, backups)
                state.update(lastBackupAt=now(), lastBackup=str(bundle), lastOffsiteBundle=None)
            except (OSError, subprocess.SubprocessError, ValueError, KeyError, RuntimeError):
                report['issues'].append('backup_or_restore_failed')
        completed = sorted(p for p in backups.iterdir() if p.is_dir() and not p.is_symlink()
                           and re.fullmatch(r'\d{8}T\d{6}Z-[a-f0-9]{8}', p.name))
        if state.get('remote') != config.get('remote'):
            state.update(remote=config.get('remote'), deliveredBundles=[], lastOffsiteAt=None, lastOffsiteBundle=None)
        delivered = state.setdefault('deliveredBundles', [])
        if config.get('remote'):
            for bundle in completed:
                if bundle.name in delivered:
                    continue
                try:
                    deliver(bundle, config['remote'], config.get('rclone', 'rclone'))
                    delivered.append(bundle.name)
                    state.update(lastOffsiteAt=now(), lastOffsiteBundle=str(bundle))
                except (OSError, subprocess.SubprocessError, ValueError, RuntimeError):
                    report['issues'].append('offsite_delivery_failed')
                    break
        if not config.get('remote'):
            report['issues'].append('offsite_not_configured')
        if not config.get('smtp'):
            report['issues'].append('notifications_not_configured')
        # Keep at least seven completed backups; never delete failed/foreign directories.
        retain = max(7, int(config.get('retainLocal', 14)))
        if state.get('lastBackup') and 'backup_or_restore_failed' not in report['issues'] and (not config.get('remote') or 'offsite_delivery_failed' not in report['issues']):
            for old in completed[:-retain]:
                if old.resolve().parent != backups.resolve():
                    raise ValueError('Invalid retention path')
                shutil.rmtree(old)
        state['deliveredBundles'] = [name for name in delivered if (backups / name).is_dir()]
        report.update(lastBackupAt=state.get('lastBackupAt'), lastOffsiteAt=state.get('lastOffsiteAt'))
        report['healthy'] = not report['issues']
        signature = sorted(report['issues'])
        # Retry failed notifications on subsequent checks; send recovery when issues clear.
        if signature != state.get('notifiedIssues'):
            try:
                if notify(config, report):
                    state['notifiedIssues'] = signature
            except (OSError, KeyError, smtplib.SMTPException):
                report['issues'].append('notification_delivery_failed')
                report['healthy'] = False
        signature = sorted(report['issues'])
        events = directory / 'events.jsonl'
        if signature != state.get('lastIssues'):
            if events.exists() and events.stat().st_size > 1_000_000:
                os.replace(events, directory / 'events.previous.jsonl')
            with events.open('a', encoding='utf-8') as output:
                output.write(json.dumps(report) + '\n')
        state['lastIssues'] = signature
        write_json(state_path, state)
        write_json(directory / 'status.json', report)
        return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True, type=Path)
    parser.add_argument('--force-backup', action='store_true')
    args = parser.parse_args()
    try:
        config = json.loads(args.config.read_text(encoding='utf-8-sig'))
        report = check(config, args.force_backup)
    except (OSError, ValueError, KeyError, subprocess.SubprocessError) as error:
        # Do not print subprocess output, credentials or configuration values.
        print(json.dumps({'healthy': False, 'error': type(error).__name__}))
        return 2
    print(json.dumps(report, indent=2))
    return 0 if report['healthy'] else 1


if __name__ == '__main__':
    sys.exit(main())
