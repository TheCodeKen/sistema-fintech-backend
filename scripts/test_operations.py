"""Failure and recovery checks for the scheduled operations runner (no network)."""
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import operations as ops


class OperationsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        self.config = {'project': 'isolated', 'directory': self.temp.name}

    def healthy(self, *args, **kwargs):
        return subprocess.CompletedProcess([], 0, json.dumps({'healthy': True}), '')

    def backup(self, project, directory):
        bundle = directory / '20261117T120000Z-abcdef12'
        bundle.mkdir(exist_ok=True)
        return bundle

    def test_missing_external_settings_are_explicit_and_local_backup_is_not_repeated(self):
        with patch.object(ops, 'run', side_effect=self.healthy), patch.object(ops, 'create_backup', side_effect=self.backup) as backup:
            first = ops.check(self.config)
            second = ops.check(self.config)
        self.assertFalse(first['healthy'])
        self.assertIn('offsite_not_configured', first['issues'])
        self.assertIn('notifications_not_configured', second['issues'])
        self.assertEqual(backup.call_count, 1)

    def test_failed_upload_is_retried_without_creating_another_backup(self):
        self.config.update(remote='crypt:fintech', smtp={'host': 'unused'})
        with patch.object(ops, 'run', side_effect=self.healthy), patch.object(ops, 'create_backup', side_effect=self.backup) as backup, patch.object(ops, 'notify', return_value=True), patch.object(ops, 'deliver', side_effect=[RuntimeError('failed'), None]) as upload:
            first = ops.check(self.config)
            second = ops.check(self.config)
        self.assertIn('offsite_delivery_failed', first['issues'])
        self.assertTrue(second['healthy'])
        self.assertEqual(upload.call_count, 2)
        self.assertEqual(backup.call_count, 1)
        self.assertIsNotNone(second['lastOffsiteAt'])

    def test_failed_backup_is_never_marked_as_success(self):
        with patch.object(ops, 'run', side_effect=self.healthy), patch.object(ops, 'create_backup', side_effect=RuntimeError('failed')):
            report = ops.check(self.config)
        self.assertIn('backup_or_restore_failed', report['issues'])
        self.assertIsNone(report['lastBackupAt'])

    def test_docker_failure_becomes_a_persisted_incident(self):
        with patch.object(ops, 'run', side_effect=FileNotFoundError()), patch.object(ops, 'create_backup', side_effect=self.backup):
            report = ops.check(self.config)
        self.assertIn('monitor_unavailable', report['issues'])
        self.assertEqual(json.loads((self.directory / 'status.json').read_text())['issues'], report['issues'])

    def test_notifications_repeat_only_after_change_and_recover(self):
        self.config.update(remote='crypt:fintech', smtp={'host': 'unused'})
        states = [subprocess.CompletedProcess([], 1, '{"healthy":false}', ''),
                  subprocess.CompletedProcess([], 1, '{"healthy":false}', ''), self.healthy()]
        with patch.object(ops, 'run', side_effect=states), patch.object(ops, 'create_backup', side_effect=self.backup), patch.object(ops, 'deliver'), patch.object(ops, 'notify', return_value=True) as notify:
            ops.check(self.config)
            ops.check(self.config)
            report = ops.check(self.config)
        self.assertEqual(notify.call_count, 2)
        self.assertTrue(report['healthy'])

    def test_failed_notification_retries_on_next_check(self):
        self.config.update(remote='crypt:fintech', smtp={'host': 'unused'})
        with patch.object(ops, 'run', side_effect=self.healthy), patch.object(ops, 'create_backup', side_effect=self.backup), patch.object(ops, 'deliver'), patch.object(ops, 'notify', side_effect=[OSError('failed'), True]) as notify:
            first = ops.check(self.config)
            second = ops.check(self.config)
        self.assertIn('notification_delivery_failed', first['issues'])
        self.assertTrue(second['healthy'])
        self.assertEqual(notify.call_count, 2)

    def test_remote_verification_failure_is_not_accepted(self):
        outcomes = [subprocess.CompletedProcess([], 0, '', ''), subprocess.CompletedProcess([], 1, '', '')]
        with patch.object(ops, 'run', side_effect=outcomes) as run:
            with self.assertRaises(RuntimeError):
                ops.deliver(self.directory, 'crypt:fintech', 'rclone')
        self.assertIn('--download', run.call_args.args[0])

    def test_cannot_treat_a_local_path_as_an_external_remote(self):
        with self.assertRaises(ValueError):
            ops.deliver(self.directory, 'D:/backups', 'rclone')

    def test_partial_backup_is_removed_and_not_published(self):
        with patch.object(ops, 'run', return_value=subprocess.CompletedProcess([], 1, '', '')):
            with self.assertRaises(RuntimeError):
                ops.create_backup('isolated', self.directory)
        self.assertEqual(list(self.directory.iterdir()), [])

    def test_retention_keeps_seven_and_preserves_foreign_directories(self):
        backups = self.directory / 'backups'
        backups.mkdir()
        for index in range(10):
            (backups / f'202601{index+1:02}T120000Z-abcdef12').mkdir()
        foreign = backups / 'user-files'
        foreign.mkdir()
        with patch.object(ops, 'run', side_effect=self.healthy), patch.object(ops, 'create_backup', side_effect=self.backup):
            ops.check(dict(self.config, retainLocal=1))
        self.assertEqual(len(list(backups.iterdir())), 8)
        self.assertTrue(foreign.exists())

    def test_failed_offsite_does_not_prune_unuploaded_backups(self):
        backups = self.directory / 'backups'
        backups.mkdir()
        for index in range(10):
            (backups / f'202601{index+1:02}T120000Z-abcdef12').mkdir()
        with patch.object(ops, 'run', side_effect=self.healthy), patch.object(ops, 'create_backup', side_effect=self.backup), patch.object(ops, 'deliver', side_effect=RuntimeError('failed')):
            ops.check(dict(self.config, remote='crypt:fintech', retainLocal=7))
        self.assertEqual(len(list(backups.iterdir())), 11)

    def test_all_waiting_bundles_are_retried_after_cloud_recovers(self):
        backups = self.directory / 'backups'
        backups.mkdir()
        (backups / '20260101T120000Z-abcdef12').mkdir()
        with patch.object(ops, 'run', side_effect=self.healthy), patch.object(ops, 'create_backup', side_effect=self.backup), patch.object(ops, 'deliver') as upload:
            ops.check(dict(self.config, remote='crypt:fintech'))
        self.assertEqual(upload.call_count, 2)

    def test_lock_prevents_overlapping_runs(self):
        with ops.exclusive(self.directory / 'operations.lock'):
            with self.assertRaises(OSError):
                with ops.exclusive(self.directory / 'operations.lock'):
                    self.fail('Overlapping run acquired the lock')


if __name__ == '__main__':
    unittest.main()
