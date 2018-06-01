import os
import sys
import argparse
from random import shuffle
from Common import *

sys.path.append(os.path.abspath('..\\..\\StockFlow.Common'))
from Progress import *
from KillFileMonitor import *


parser = argparse.ArgumentParser()

parser.add_argument('--input_path_1', type=str, default='data\\buy_train.csv', help='Input file path.')
parser.add_argument('--input_path_2', type=str, default='data\\no_buy_train.csv', help='Input file path.')
parser.add_argument('--output_path', type=str, default='data\\buying_train.csv', help='Output file path.')


def main(input_path_1, input_path_2, output_path):
    output_dir = os.path.dirname(os.path.abspath(output_path))
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    kill_path = output_dir + '\\kill'
    killfile_monitor = KillFileMonitor(kill_path, 1)

    output_path_temp = output_path + '.incomplete'
    try:
        line_positions_1 = get_line_positions(input_path_1, lambda: killfile_monitor.maybe_check_killfile())
        line_positions_2 = get_line_positions(input_path_2, lambda: killfile_monitor.maybe_check_killfile())

        with open(input_path_1, 'r') as in_file_1:
            with open(input_path_2, 'r') as in_file_2:

                line_positions_1 = [(in_file_1, x) for x in line_positions_1]
                line_positions_2 = [(in_file_2, x) for x in line_positions_2]

                line_positions = line_positions_1 + line_positions_2
                shuffle(line_positions)

                with open(output_path_temp, 'w') as out_file:

                    header = in_file_1.readline()
                    out_file.writelines([header])

                    progress = Progress('merge: ', 1)
                    progress.set_count(len(line_positions))

                    for item in line_positions:
                        in_file, line_position = item
                        in_file.seek(line_position['Position'])
                        line = in_file.readline()
                        if not line.endswith('\n'):
                            line += '\n'
                        out_file.writelines([line])
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

    main(input_path_1=FLAGS.input_path_1,
         input_path_2=FLAGS.input_path_2,
         output_path=FLAGS.output_path)
