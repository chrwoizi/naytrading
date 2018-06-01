import os
import sys
import argparse
from random import shuffle
from Common import *

sys.path.append(os.path.abspath('..\\..\\StockFlow.Common'))
from Progress import *
from KillFileMonitor import *


parser = argparse.ArgumentParser()

parser.add_argument('--input_path', type=str, default='data\\buy.csv', help='Input file path.')
parser.add_argument('--output_path_train', type=str, default='data\\buy_train.csv', help='Output file path for the training set.')
parser.add_argument('--output_path_test', type=str, default='data\\buy_test.csv', help='Output file path for the validation set.')
parser.add_argument('--factor', type=float, default=0.2, help='Output file path for the validation set.')
parser.add_argument('--samples', type=int, default=None, help='Output file path for the validation set.')
parser.add_argument('--preserve_test_ids', type=bool, default=True, help='Output file path for the validation set.')


def main(input_path, output_path_train, output_path_test, factor, samples, preserve_test_ids):
    output_dir = os.path.dirname(os.path.abspath(output_path_train))
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    output_dir = os.path.dirname(os.path.abspath(output_path_test))
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    kill_path = output_dir + '\\kill'
    killfile_monitor = KillFileMonitor(kill_path, 1)

    output_path_train_temp = output_path_train + '.incomplete'
    output_path_test_temp = output_path_test + '.incomplete'

    try:
        test_ids = set()
        if preserve_test_ids and os.path.exists(output_path_test):
            with open(input_path, 'r') as in_file:
                in_file.readline()
                while True:
                    killfile_monitor.maybe_check_killfile()
                    line = in_file.readline()
                    if not line or len(line) == 0:
                        break
                    id = line[0 : line.index(';')]
                    test_ids.add(id)

        random_line_positions = get_line_positions(input_path, lambda: killfile_monitor.maybe_check_killfile())

        with open(input_path, 'r') as in_file:

            shuffle(random_line_positions)

            if samples:
                random_line_positions = random_line_positions[0:samples]

            testCount = int(len(random_line_positions) * factor)

            testLines = random_line_positions[0:testCount]
            trainLines = random_line_positions[testCount:]

            moveFromTrainToTest = [x for x in trainLines if x['Id'] in test_ids]
            potentialTrainInTest = [x for x in testLines if x['Id'] not in test_ids]
            moveFromTestToTrain = potentialTrainInTest[:min(len(moveFromTrainToTest), len(potentialTrainInTest))]

            testLines = [x for x in testLines if x not in moveFromTestToTrain] + moveFromTrainToTest
            trainLines = [x for x in trainLines if x not in moveFromTrainToTest] + moveFromTestToTrain

            if not all(not x['Id'] in test_ids for x in trainLines):
                raise Exception("train_lines in test_ids")

            if any(x in testLines for x in trainLines):
                raise Exception("train_lines in test_lines")

            if len(trainLines) + len(testLines) != len(random_line_positions):
                raise Exception("train_lines or test_lines missing")

            header = in_file.readline()

            i = 0

            in_file.seek(0)

            progress = Progress('split test/train: ', 1)
            progress.set_count(len(random_line_positions))

            with open(output_path_test_temp, 'w') as out_file:
                out_file.writelines([header])
                for item in testLines:
                    killfile_monitor.maybe_check_killfile()
                    in_file.seek(item['Position'])
                    line = in_file.readline()
                    columns = len(line.split(';'))
                    if columns != 5 + 1815:
                        raise Exception('unexpected column count: %d' % columns)
                    out_file.writelines([line])
                    progress.add_item()
                    progress.maybe_print()
                    i += 1

            in_file.seek(0)

            with open(output_path_train_temp, 'w') as out_file:
                out_file.writelines([header])
                for item in trainLines:
                    killfile_monitor.maybe_check_killfile()
                    in_file.seek(item['Position'])
                    line = in_file.readline()
                    columns = len(line.split(';'))
                    if columns != 5 + 1815:
                        raise Exception('unexpected column count: %d' % columns)
                    out_file.writelines([line])
                    progress.add_item()
                    progress.maybe_print()
                    i += 1

        if os.path.exists(output_path_train):
            os.remove(output_path_train)
        os.rename(output_path_train_temp, output_path_train)

        if os.path.exists(output_path_test):
            os.remove(output_path_test)
        os.rename(output_path_test_temp, output_path_test)

    except KilledException:
        killfile_monitor.delete_killfile()

        if os.path.exists(output_path_train_temp):
            os.remove(output_path_train_temp)

        if os.path.exists(output_path_test_temp):
            os.remove(output_path_test_temp)

        print('Killed.')


if __name__ == '__main__':
    FLAGS, unparsed = parser.parse_known_args()

    main(input_path=FLAGS.input_path,
         output_path_train=FLAGS.output_path_train,
         output_path_test=FLAGS.output_path_test,
         factor=FLAGS.factor,
         samples=FLAGS.samples,
         preserve_test_ids=FLAGS.preserve_test_ids)
