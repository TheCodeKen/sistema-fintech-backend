"""Keep operational subprocesses invisible when launched by Windows Task Scheduler."""
import os
import subprocess


def background_options():
    return {'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {}
