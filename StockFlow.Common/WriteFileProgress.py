import os

from Progress import *

class WriteFileProgress(Progress):
    def __init__(self, seconds):
        super().__init__(seconds)

    def format_bytes(self, n):
        abbrv = ["B", "KB", "MB", "GB", "TB"]
        i = 0
        k = n
        while i < len(abbrv) and k >= 1024:
            k /= 1024.0
            i += 1
        return ('%.2f' % k) + abbrv[i]

    def print_progress(self, seconds_per_item):
        print("%s # %s/s" % (self.format_bytes(self.i + 1), self.format_bytes(1 / seconds_per_item)))
