import os
import numpy as np
import datetime

class Progress:
    def __init__(self):
        self.last_log = datetime.datetime.now()
        self.last_count = 0
        self.durations = []
        self.i = 0
        self.count = None
        self.file_name = None
        self.file = None
        self.file_length = None

    def next_item(self):
        self.i = self.i + 1

    def begin_file(self, path, file):
        self.file_name = os.path.basename(path)
        self.file = file
        file.seek(0, 2)
        self.file_length = file.tell()
        file.seek(0, 0)

    def end_file(self):
        self.file_name = None
        self.file = None
        self.file_length = None

    def set_count(self, count):
        self.count = count

    def print(self):
        if (datetime.datetime.now() - self.last_log).total_seconds() > 1:
            now = datetime.datetime.now()
            last_duration = now - self.last_log
            self.last_log = now
            rows = self.i - self.last_count
            self.last_count = self.i
            if rows > 0:
                self.durations.append(last_duration.total_seconds() / rows)
                if len(self.durations) > 10:
                    self.durations.pop(0)
            seconds_per_row = np.mean(self.durations) if len(self.durations) > 0 else 1
            if self.file is None:
                if self.count is None:
                    print("row %d # %.2f rows/s" % (self.i + 1, 1 / seconds_per_row))
                else:
                    print("row %d/%d # %.2f rows/s # %.2f%%" % (self.i + 1, self.count, 1 / seconds_per_row, 100 * self.i / self.count))
            else:
                print("item %d # %.2f items/s # %.2f%% of %s" % (self.i + 1, 1 / seconds_per_row, 100 * self.file.tell() / self.file_length, self.file_name))
