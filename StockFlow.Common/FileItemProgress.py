import os

from Progress import *

class FileItemProgress(Progress):
    def __init__(self, prefix, seconds, path, file):
        super().__init__(prefix, seconds)
        self.set_file(path, file)

    def set_file(self, path, file):
        self.file_name = os.path.basename(path) if path is not None else None
        self.file = file
        if file is not None:
            file.seek(0, 2)
            self.file_length = file.tell()
            file.seek(0, 0)
        else:
            self.file_length = None

    def print_progress(self, seconds_per_item):
        print("%sitem %d # %.2f items/s # %.2f%% of %s" % (self.prefix, self.i + 1, 1 / seconds_per_item, 100 * self.file.tell() / self.file_length, self.file_name))
