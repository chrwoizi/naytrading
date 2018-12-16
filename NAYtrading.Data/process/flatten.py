import os
import sys
import glob
import argparse
import datetime
import itertools
from Importer import *
from Common import *

sys.path.append(os.path.abspath('../../NAYtrading.Common'))
from FileItemProgress import *
from KillFileMonitor import *


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

class Rate():
    def __init__(self, date, close):
        self.Date = date
        self.Close = close

def main(input_path, output_path, days, max_missing_days):

    weekdays = (5 * days) / 7

    output_dir = os.path.dirname(os.path.abspath(output_path))
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    kill_path = output_dir + '/kill'
    killfile_monitor = KillFileMonitor(kill_path, 1)

    output_path_temp = output_path + '.incomplete'
    try:
        with open(output_path_temp, 'w', encoding='utf8') as out_file:
            out_file.write('id;instrument;decision;confirmed;time;')
            for day in range(-days + 1, 1):
                out_file.write(str(day))
                if day < 0:
                    out_file.write(';')

            progress = FileItemProgress('flatten: ', 1, None, None)
            known_ids = set()

            for file_path in sorted(glob.iglob(input_path), reverse=True):
                killfile_monitor.maybe_check_killfile()
                with open(file_path, 'r', encoding='utf8') as in_file:
                    progress.set_file(file_path, in_file)

                    def flatten_snapshot(snapshot):
                        killfile_monitor.maybe_check_killfile()

                        id = snapshot.DecisionId
                        if id in known_ids:
                            return

                        if snapshot.Decision is not None and snapshot.snapshotrates is not None:

                            known_ids.add(id)

                            snapshot_date = datetime.datetime.strptime(snapshot.Time, '%Y-%m-%d %H:%M:%S').date()
                            first_date = snapshot_date - datetime.timedelta(days - 1)

                            rates = list(filter(lambda r: r.Close is not None and r.Close > 0, snapshot.snapshotrates))
                            rates = list(map(lambda r: Rate(datetime.datetime.strptime(r.Time, '%Y-%m-%d %H:%M:%S').date(), r.Close), rates))

                            if len(rates) > 0:
                                previous_rate = lastOrDefault((r for r in rates if r.Date < first_date), rates[0])
                                remaining_rates = list(itertools.dropwhile(lambda r: r.Date < first_date, rates))

                                if len(remaining_rates) >= (weekdays - max_missing_days):
                                    out_file.write('\n')

                                    out_file.write(str(id))
                                    out_file.write(';')

                                    out_file.write(str(snapshot.instrument.ID))
                                    out_file.write(';')

                                    out_file.write(snapshot.Decision)
                                    out_file.write(';')

                                    out_file.write(str(snapshot.Confirmed))
                                    out_file.write(';')

                                    out_file.write(snapshot_date.strftime('%Y%m%d'))
                                    out_file.write(';')

                                    snapshot_days = (snapshot_date - first_date).days + 1
                                    for day in range(snapshot_days):

                                        date = first_date + datetime.timedelta(days=day)

                                        remaining_rates = list(itertools.dropwhile(lambda r: r.Date < date, remaining_rates))

                                        rate = previous_rate
                                        if len(remaining_rates) > 0:
                                            firstRate = remaining_rates[0]
                                            if firstRate.Date == date:
                                                rate = firstRate
                                            # else: #encountered future rate. use previous rate.
                                        # else: #no remaining rates. use previous rate.

                                        value = '%.2f' % (rate.Close)
                                        out_file.write(value)

                                        if day < snapshot_days - 1:
                                            out_file.write(';')

                                        previous_rate = rate

                                else:
                                    print_flush("%s has insufficient rates: %d < %d - %d" % (
                                    snapshot.instrument.InstrumentName, len(remaining_rates), weekdays, max_missing_days))

                        progress.add_item()
                        progress.maybe_print()

                    importer = Importer()
                    importer.import_stream(in_file, flatten_snapshot)

        if os.path.exists(output_path):
            os.remove(output_path)
        os.rename(output_path_temp, output_path)

    except KilledException:
        killfile_monitor.delete_killfile()
        if os.path.exists(output_path_temp):
            os.remove(output_path_temp)
        print_flush('Killed.')


if __name__ == '__main__':
    FLAGS, unparsed = parser.parse_known_args()

    main(input_path=FLAGS.input_path,
         output_path=FLAGS.output_path,
         days=FLAGS.days,
         max_missing_days=FLAGS.max_missing_days)
