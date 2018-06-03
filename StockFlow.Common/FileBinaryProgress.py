import os

from Progress import *

class FileBinaryProgress(Progress):
    def __init__(self, prefix, seconds, file_name, file_length):
        super().__init__(prefix, seconds)
        self.file_name = file_name
        self.file_length = file_length

    def format_bytes(self, n):
        abbrv = ["B", "KB", "MB", "GB", "TB"]
        i = 0
        k = n
        while i < len(abbrv) and k >= 1024:
            k /= 1024.0
            i += 1
        return ('%.2f' % k) + abbrv[i]

    def print_progress(self, seconds_per_item):
        if self.file_length:
            print_flush("%s%s # %s/s # %.2f%% of %s" % (self.prefix, self.format_bytes(self.i + 1), self.format_bytes(1 / seconds_per_item), 100 * self.i / self.file_length, self.file_name))
        else:
            print_flush("%s%s # %s/s # %s" % (self.prefix, self.format_bytes(self.i + 1), self.format_bytes(1 / seconds_per_item), self.file_name))
