import os
import sys
import glob
import argparse
import re
from Common import *
from FileItemProgress import *
from KillFileMonitor import *


parser = argparse.ArgumentParser()

parser.add_argument('--input_dir', type=str, default='data', help='Input file directory.')
parser.add_argument('--input_exp', type=str, default='^\\d+.json.csv$', help='Input file name regular expression.')
parser.add_argument('--output_path', type=str, default='data\\flat.csv', help='Output file path.')


def main(input_dir, input_exp, output_path):

    output_dir = os.path.dirname(os.path.abspath(output_path))
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    kill_path = output_dir + '/kill'
    killfile_monitor = KillFileMonitor(kill_path, 1)

    output_path_temp = output_path + '.incomplete'
    try:
        with open(output_path_temp, 'w', encoding='utf8') as out_file:

            progress = FileItemProgress('distinct: ', 1, None, None)
            known_ids = set()

            line_index = 0

            for file_path in sorted(glob.iglob(input_dir + '/*'), reverse=True):
                killfile_monitor.maybe_check_killfile()
                file_name = os.path.basename(file_path)
                search = re.search(input_exp, file_name, re.IGNORECASE)
                if search:
                    with open(file_path, 'r', encoding='utf8') as in_file:
                        progress.set_file(file_path, in_file)

                        header = in_file.readline()
                        if not header.endswith('\n'):
                            header = header + '\n'

                        if line_index == 0:
                            out_file.writelines([header])
                            line_index += 1

                        while True:
                            killfile_monitor.maybe_check_killfile()
                            line = in_file.readline()
                            if not line or len(line) <= 2:
                                break

                            split = line.split(';')

                            id = split[0]

                            if id in known_ids:
                                continue

                            known_ids.add(id)

                            new_line = "%d%s" % (line_index, line[line.index(';'):])
                            if not new_line.endswith('\n'):
                                new_line += '\n'

                            out_file.writelines([new_line])

                            progress.add_item()
                            progress.maybe_print()

                            line_index += 1

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

    main(input_dir=FLAGS.input_dir,
         input_exp=FLAGS.input_exp,
         output_path=FLAGS.output_path)
