import os
import sys
import argparse
from decimal import Decimal
from Common import *

sys.path.append(os.path.abspath('..\\..\\StockFlow.Common'))
from FileItemProgress import *
from KillFileMonitor import *


parser = argparse.ArgumentParser()

parser.add_argument('--input_path', type=str, default='data\\buying_train_aug.csv', help='Input file path.')
parser.add_argument('--output_path', type=str, default='data\\buying_train_aug_norm.csv', help='Output file path.')


def normalize(rates):
    min_rate = min(rates)
    max_rate = max(rates)
    height = max_rate - min_rate

    for i in range(0, len(rates)):
        rates[i] = (rates[i] - min_rate) / height

def main(input_path, output_path):
    output_dir = os.path.dirname(os.path.abspath(output_path))
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    kill_path = output_dir + '\\kill'
    killfile_monitor = KillFileMonitor(kill_path, 1)

    output_path_temp = output_path + '.incomplete'
    try:
        with open(input_path, 'r') as in_file:
            with open(output_path_temp, 'w') as out_file:

                progress = FileItemProgress('normalize: ', 1, input_path, in_file)

                header = in_file.readline()
                split_header = header.split(';')
                normalized_header = ';'.join(split_header[0:5] + [str(x) for x in range(0, 1024)]) + '\n'
                out_file.writelines([normalized_header])

                while True:
                    killfile_monitor.maybe_check_killfile()
                    line = in_file.readline()
                    if not line or len(line) <= 2:
                        break

                    split = line.split(';')

                    index = split[0]
                    id = split[1]
                    instrumentId = split[2]
                    time = split[3]
                    decision = split[4]
                    rates = [Decimal(x) for x in split[5:]]

                    normalize(rates)

                    rates = [sample(rates, Decimal(x) / 1024 * len(rates)) for x in range(0, 1024)]

                    out_file.writelines([serialize(index, id, instrumentId, time, decision, rates) + '\n'])

                    progress.add_item()
                    progress.maybe_print()

        if os.path.exists(output_path):
            os.remove(output_path)
        os.rename(output_path_temp, output_path)

    except KilledException:
        killfile_monitor.delete_killfile()
        if os.path.exists(output_path_temp):
            os.remove(output_path_temp)
        print('Killed.')


if __name__ == '__main__':
    FLAGS, unparsed = parser.parse_known_args()

    main(input_path=FLAGS.input_path,
         output_path=FLAGS.output_path)
