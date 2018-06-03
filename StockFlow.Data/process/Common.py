import math
import sys
import os
from decimal import Decimal

sys.path.append(os.path.abspath('../../StockFlow.Common'))
from FileBinaryProgress import *


def print_flush(s):
    print(s)
    sys.stdout.flush()

def get_line_positions(file_path, report_progress):

    line_positions = []

    line_index = 0

    position = 0

    progress = FileBinaryProgress('index: ', 1, file_path, os.path.getsize(file_path))

    line_ending_length = 0
    with open(file_path, 'rb', 0) as file:
        line = file.readline()
        if line.endswith(b'\r\n'):
            line_ending_length = 2
        else:
            line_ending_length = 1

    with open(file_path, 'r') as file:
        for line in iter(file.readline, ''):
            report_progress()

            if len(line) > 2:

                if line[-1] == '\n':
                    if line[-2] == '\r':
                        line = line[0:len(line)-2]
                    else:
                        line = line[0:len(line)-1]

                if line_index > 0:
                    first = line.index(';')
                    skipped_index = line[first + 1:]
                    second = skipped_index.index(';')
                    line_positions += [dict(Position = position, Id = skipped_index[0:second])]

            position += len(line.encode("utf-8")) + 2

            progress.set_items(position)
            progress.maybe_print()

            line_index += 1

    return line_positions

def serialize(index, id, instrumentId, time, decision, rates):
    return ';'.join([index, id, instrumentId, time, decision] + [('%.2f' % x) for x in rates])

def sample(rates, x):
    low = int(math.floor(x))
    high = int(math.ceil(x))
    frac = x - low
    rateLow = rates[min(max(0, low), len(rates) - 1)]
    rateHigh = rates[min(max(0, high), len(rates) - 1)]
    return rateLow + Decimal(frac) * (rateHigh - rateLow)
