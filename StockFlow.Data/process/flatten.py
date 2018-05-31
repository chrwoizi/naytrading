import os
import glob
import argparse
import datetime
import ijson
import itertools
from decimal import Decimal
from Progress import Progress

parser = argparse.ArgumentParser()

parser.add_argument('--input_path', type=str, default='..\\download\\data\\*.json', help='Input file path. May contain wildcards.')
parser.add_argument('--output_path', type=str, default='data\\flat.csv', help='Output file path.')
parser.add_argument('--days', type=int, default=5 * 365 - 10, help='Number of day columns in the output.')
parser.add_argument('--max_missing_days', type=int, default=120, help='Number of weekdays that may be missing to still consider a snapshot complete.')


def lastOrDefault(sequence, default=None):
    lastItem = default
    for s in sequence:
        lastItem = s
    return lastItem

def get_split_factor(previousRate, rate):
    factor = previousRate / rate
    rounded = round(factor)
    if rounded >= 2 and rounded < 100:
        fraction = factor - rounded
        if abs(fraction) < 0.1:
            return Decimal(rounded)

    factor = rate / previousRate
    rounded = round(factor)
    if rounded >= 2 and rounded < 100:
        fraction = factor - rounded
        if abs(fraction) < 0.1:
            return Decimal(1 / rounded)

    return 1

def main(input_path, output_path, days, max_missing_days):

    weekdays = (5 * days) / 7

    dir = os.path.dirname(os.path.abspath(output_path))
    if not os.path.exists(dir):
        os.makedirs(dir)

    with open(output_path, 'w') as out_file:
        out_file.write('id;instrument;decision;time;')
        for day in range(-days + 1, 1):
            out_file.write(str(day))
            if day < 0:
                out_file.write(';')

        progress = Progress()
        known_ids = set()

        for file_path in sorted(glob.iglob(input_path), reverse=True):
            with open(file_path, 'r') as in_file:
                progress.begin_file(file_path, in_file)

                snapshots = ijson.items(in_file, 'item')
                for snapshot in snapshots:

                    id = snapshot['DecisionId']
                    if id in known_ids:
                        continue

                    if snapshot['Decision'] is not None and snapshot['snapshotrates'] is not None:

                        known_ids.add(id)

                        snapshot_date = datetime.datetime.strptime(snapshot['Time'], '%Y-%m-%d %H:%M:%S').date()
                        first_date = snapshot_date - datetime.timedelta(days - 1)

                        rates = list(filter(lambda r: r['Close'] is not None and r['Close'] > 0, snapshot['snapshotrates']))
                        rates = list(map(lambda r: dict(Date=datetime.datetime.strptime(r['Time'], '%Y-%m-%d %H:%M:%S').date(), Close=r['Close']), rates))

                        if len(rates) > 0:
                            previous_rate = lastOrDefault((r for r in rates if r['Date'] < first_date), rates[0])
                            remaining_rates = list(itertools.dropwhile(lambda r: r['Date'] < first_date, rates))

                            if previous_rate['Date'] <= first_date and len(remaining_rates) >= weekdays - max_missing_days:
                                out_file.write('\n')

                                out_file.write(str(id))
                                out_file.write(';')

                                out_file.write(str(snapshot['instrument']['ID']))
                                out_file.write(';')

                                out_file.write(snapshot['Decision'])
                                out_file.write(';')

                                out_file.write(snapshot_date.strftime('%Y%m%d'))
                                out_file.write(';')

                                split_factor = 1

                                snapshot_days = (snapshot_date - first_date).days + 1
                                for day in range(snapshot_days):

                                    date = first_date + datetime.timedelta(days=day)

                                    remaining_rates = list(itertools.dropwhile(lambda r: r['Date'] < date, remaining_rates))

                                    rate = previous_rate
                                    if (len(remaining_rates) > 0):
                                        firstRate = remaining_rates[0]
                                        if (firstRate['Date'] == date):
                                            rate = firstRate
                                        #else: #encountered future rate. use previous rate.
                                    #else: #no remaining rates. use previous rate.

                                    split_factor *= get_split_factor(previous_rate['Close'], rate['Close'])

                                    value = "%.2f" % (split_factor * rate['Close'])
                                    out_file.write(value)

                                    if day < snapshot_days - 1:
                                        out_file.write(';')

                                    previous_rate = rate

                            else:
                                print("%s has insufficient rates: %d" % (snapshot['instrument']['InstrumentName'], len(remaining_rates)))

                    progress.print()
                    progress.next_item()

                progress.end_file()


if __name__ == '__main__':
    FLAGS, unparsed = parser.parse_known_args()

    main(input_path=FLAGS.input_path,
         output_path=FLAGS.output_path,
         days=FLAGS.days,
         max_missing_days=FLAGS.max_missing_days)