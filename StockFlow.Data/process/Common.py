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

    with open(file_path, 'rb') as file:
        for line in iter(file.readline, b''):
            report_progress()

            if len(line) > 2:
                if line_index > 0:
                    first = line.index(b';')
                    if first == -1:
                        raise Exception("Could not find ; in " + line.decode('utf8'))
                    skipped_index = line[first + 1:]
                    second = skipped_index.index(b';')
                    if second == -1:
                        raise Exception("Could not find ; in " + skipped_index.decode('utf8'))
                    line_positions += [dict(Position = position, Id = skipped_index[0:second].decode('utf8'))]

            position += len(line)

            progress.set_items(position)
            progress.maybe_print()

            line_index += 1

    return line_positions

def serialize(index, id, instrumentId, time, decision, rates, additionals):
    return ';'.join([index, id, instrumentId, time, decision] + [('%.2f' % x) for x in rates] + additionals)

def sample(rates, x):
    low = int(math.floor(x))
    high = int(math.ceil(x))
    frac = x - low
    rateLow = rates[min(max(0, low), len(rates) - 1)]
    rateHigh = rates[min(max(0, high), len(rates) - 1)]
    return rateLow + Decimal(frac) * (rateHigh - rateLow)
