import os
import sys
import argparse
from decimal import Decimal
from Common import *

sys.path.append(os.path.abspath('../../NAYtrading.Common'))
from FileItemProgress import *
from KillFileMonitor import *


parser = argparse.ArgumentParser()

parser.add_argument('--input_path', type=str, default='data\\selling_test_aug.csv', help='Input file path.')
parser.add_argument('--output_path', type=str, default='data\\selling_test_norm.csv', help='Output file path.')


def normalize(rates):
    min_rate = min(rates)
    max_rate = max(rates)
    height = max_rate - min_rate

    for i in range(0, len(rates)):
        if height > 0:
            rates[i] = (rates[i] - min_rate) / height
        else:
            rates[i] = 0

    return min_rate, height

def main(input_path, output_path):
    output_dir = os.path.dirname(os.path.abspath(output_path))
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    kill_path = output_dir + '/kill'
    killfile_monitor = KillFileMonitor(kill_path, 1)

    output_path_temp = output_path + '.incomplete'
    try:
        with open(input_path, 'r', encoding='utf8') as in_file:
            with open(output_path_temp, 'w', encoding='utf8') as out_file:

                progress = FileItemProgress('normalize: ', 1, input_path, in_file)

                header = in_file.readline()
                if header.endswith('\n'):
                    header = header[0:-1]

                split_header = header.split(';')

                additionals_index = len(split_header)
                for i in range(5, len(split_header)):
                    if split_header[i] == '0':
                        additionals_index = i + 1
                        break

                normalized_header = ';'.join(split_header[0:5] + [str(x) for x in range(0, 1024)] + split_header[additionals_index:])
                out_file.writelines([normalized_header + '\n'])

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
                    rates = [Decimal(x) for x in split[5:additionals_index]]
                    additionals = split[additionals_index:]

                    min_rate, height = normalize(rates)

                    rates = [sample(rates, Decimal(x) / 1024 * len(rates)) for x in range(0, 1024)]
                    for i in range(additionals_index, len(split_header)):
                        if split_header[i].endswith('_rate'):
                            additionals[i-additionals_index] = ('%.2f' % ((Decimal(additionals[i-additionals_index]) - min_rate) / height))
                        if split_header[i].endswith('_day'):
                            additionals[i-additionals_index] = str(1023 - int(round(-Decimal(additionals[i-additionals_index]) * 1024 / len(rates))))

                    out_file.writelines([serialize(index, id, instrumentId, time, decision, rates, additionals) + '\n'])

                    progress.add_item()
                    progress.maybe_print()

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
         output_path=FLAGS.output_path)
