import os

from IntervalCall import *


class KilledException(Exception):
    pass

class KillFileMonitor:
    def __init__(self, killfile_path, seconds):
        self.killfile_path = killfile_path
        self.interval = IntervalCall(seconds)

    def maybe_check_killfile(self):
        self.interval.maybe_call(lambda duration: self.check_killfile())

    def check_killfile(self):
        if os.path.exists(self.killfile_path):
            raise KilledException()

    def delete_killfile(self):
        if os.path.exists(self.killfile_path):
            os.remove(self.killfile_path)
