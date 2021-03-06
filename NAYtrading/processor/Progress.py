import numpy as np
import sys

from IntervalCall import *

def print_flush(s):
    print(s)
    sys.stdout.flush()

class Progress(IntervalCall):
    def __init__(self, prefix, seconds):
        super().__init__(seconds)
        self.prefix = prefix
        self.last_i = 0
        self.durations = []
        self.i = 0
        self.count = None

    def add_item(self):
        self.add_items(1)

    def add_items(self, count):
        self.i += count

    def set_items(self, count):
        self.i = count

    def set_count(self, count):
        self.count = count

    def maybe_print(self):
        super().maybe_call(self.__update)

    def __update(self, duration):
        items = self.i - self.last_i
        self.last_i = self.i
        if items > 0:
            self.durations.append(duration.total_seconds() / items)
            if len(self.durations) > 10:
                self.durations.pop(0)
        seconds_per_item = np.mean(self.durations) if len(self.durations) > 0 else 1
        self.print_progress(seconds_per_item)

    def print_progress(self, seconds_per_item):
        if self.count is None:
            print_flush("%sitem %d # %.2f items/s" % (self.prefix, self.i + 1, 1 / seconds_per_item))
        else:
            print_flush("%sitem %d/%d # %.2f items/s # %.2f%%" % (self.prefix, self.i + 1, self.count, 1 / seconds_per_item, 100 * self.i / self.count))
