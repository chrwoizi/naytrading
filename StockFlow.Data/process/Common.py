import math
from decimal import Decimal

def get_line_positions(in_file, report_progress):

    line_positions = []

    in_file.seek(0, 2)
    length = in_file.tell()
    in_file.seek(0, 0)

    line_index = 0
    while in_file.tell() < length:
        position = in_file.tell()

        line = in_file.readline()
        if not line or len(line) == 0:
            break

        if line_index > 0:
            first = line.index(';')
            skipped_index = line[first + 1:]
            second = skipped_index.index(';')
            line_positions += [dict(Position = position, Id = skipped_index[0:second])]

        line_index += 1

    in_file.seek(0)

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
