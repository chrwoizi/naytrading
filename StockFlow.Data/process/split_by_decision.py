import os
import argparse
import datetime
from decimal import Decimal
from itertools import groupby
from Progress import Progress

parser = argparse.ArgumentParser()

parser.add_argument('--input_path', type=str, default='data\\flat.csv', help='Input file path.')
parser.add_argument('--output_path_buy', type=str, default='data\\buy.csv', help='Output file path for buy decisions.')
parser.add_argument('--output_path_no_buy', type=str, default='data\\no_buy.csv', help='Output file path for no-buy decisions.')
parser.add_argument('--output_path_sell', type=str, default='data\\sell.csv', help='Output file path for sell decisions.')
parser.add_argument('--output_path_no_sell', type=str, default='data\\no_sell.csv', help='Output file path for no-sell decisions.')


def distinct(sequence, get_key):
    seen = set()
    for s in sequence:
        key = get_key(s)
        if not key in seen:
            seen.add(key)
            yield s

def get_metadata(input_path):
    metas = []

    with open(input_path, 'r') as in_file:
        line_index = 0
        while True:
            try:
                line = in_file.readline()
                if len(line) > 0:

                    if line_index > 0:

                        split = str(line).split(";")
                        id = split[0]
                        instrument_id = split[1]
                        decision = split[2]
                        time = datetime.datetime.strptime(split[3], '%Y%m%d').date()
                        first_rate = Decimal(split[4])
                        last_rate = Decimal(split[len(split)-1])

                        meta = dict(
                            Line = line_index,
                            ID = id,
                            InstrumentId = instrument_id,
                            Decision = decision,
                            Time = time,
                            CurrentPrice = last_rate
                        )

                        metas += [meta]

                    line_index += 1
                else:
                    break
            except EOFError:
                break

    for group in groupby(metas, lambda x: x['InstrumentId']):
        invested = False
        previous_buy_rate = Decimal(0)
        (k, v) = group
        for meta in sorted(v, key=lambda x: x['Time']):
            meta['Invested'] = invested
            meta['PreviousBuyRate'] = previous_buy_rate
            if meta['Decision'] == 'buy':
                invested = True
                previous_buy_rate = meta['CurrentPrice']
            if meta['Decision'] == 'sell':
                invested = False
                previous_buy_rate = Decimal(0)

    return metas

def main(input_path, output_path_buy, output_path_no_buy, output_path_sell, output_path_no_sell):

    dir = os.path.dirname(os.path.abspath(output_path_buy))
    if not os.path.exists(dir):
        os.makedirs(dir)

    dir = os.path.dirname(os.path.abspath(output_path_no_buy))
    if not os.path.exists(dir):
        os.makedirs(dir)

    dir = os.path.dirname(os.path.abspath(output_path_sell))
    if not os.path.exists(dir):
        os.makedirs(dir)

    dir = os.path.dirname(os.path.abspath(output_path_no_sell))
    if not os.path.exists(dir):
        os.makedirs(dir)

    metas = get_metadata(input_path)

    with open(input_path, 'r') as in_file:
        with open(output_path_buy, 'w') if len(output_path_buy) > 0 else None as out_file_buy:
            with open(output_path_no_buy, 'w') if len(output_path_no_buy) > 0 else None as out_file_no_buy:
                with open(output_path_sell, 'w') if len(output_path_sell) > 0 else None as out_file_sell:
                    with open(output_path_no_sell, 'w') if len(output_path_no_sell) > 0 else None as out_file_no_sell:

                        header = "index;" + in_file.readline()

                        if out_file_buy:
                            out_file_buy.writelines([header])

                        if out_file_no_buy:
                            out_file_no_buy.writelines([header])

                        if out_file_sell:
                            out_file_sell.writelines([header])

                        if out_file_no_sell:
                            out_file_no_sell.writelines([header])

                        progress = Progress()
                        progress.set_count(len(metas))

                        lines_read = 1
                        for meta in sorted(metas, key=lambda x: x['Line']):
                            while meta['Line'] > lines_read:
                                in_file.readline()
                                lines_read += 1

                            line = in_file.readline()
                            lines_read += 1

                            if len(line) > 0:
                                if meta['Invested']:

                                    if meta['Decision'] == 'sell':

                                        if out_file_sell:
                                            out_file_sell.writelines([str(lines_read) + ';' + line])

                                    elif meta['Decision'] == 'ignore':

                                        if out_file_buy:

                                            if meta['PreviousBuyRate'] > 0 and meta['PreviousBuyRate'] < meta['CurrentPrice'] * Decimal(1.01):
                                                first_semicolon = line.index(';')
                                                line_as_buy = line[0 : first_semicolon + 1] + 'buy' + line[line.index(';', first_semicolon + 1):]
                                                out_file_buy.writelines([str(lines_read) + ';' + line_as_buy])

                                        if out_file_no_sell:
                                            out_file_no_sell.writelines([str(lines_read) + ';' + line])
                                else:

                                    if meta['Decision'] == 'buy':

                                        if out_file_buy:
                                            out_file_buy.writelines([str(lines_read) + ';' + line])
                                    elif meta['Decision'] == 'ignore':

                                        if out_file_no_buy:
                                            out_file_no_buy.writelines([str(lines_read) + ';' + line])

                            progress.print()
                            progress.next_item()


if __name__ == '__main__':
    FLAGS, unparsed = parser.parse_known_args()

    main(input_path=FLAGS.input_path,
         output_path_buy=FLAGS.output_path_buy,
         output_path_no_buy=FLAGS.output_path_no_buy,
         output_path_sell=FLAGS.output_path_sell,
         output_path_no_sell=FLAGS.output_path_no_sell)
