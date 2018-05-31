import os
import argparse
import random
import math
from decimal import Decimal
from noise import pnoise1
from Progress import *
from Common import *

parser = argparse.ArgumentParser()

parser.add_argument('--input_path', type=str, default='data\\buying_train.csv', help='Input file path.')
parser.add_argument('--output_path', type=str, default='data\\buying_train_aug.csv', help='Output file path.')
parser.add_argument('--factor', type=int, default=5, help='Number of data sets to output per original data set.')

def sphere():
    return random.random() * math.sin(random.random() * 2 * math.pi)

def augment(rates, maxSkew, maxJitterX, maxJitterY):
    perlin1 = 1
    perlin2 = 5 * random.random()

    avg = float(sum(rates) / len(rates))

    maxSkewAbs = maxSkew * float(rates[len(rates)-1]) / len(rates)
    skew = maxSkewAbs * sphere()

    newRates = list(rates)

    for i in range(0, len(rates)):
        jitterX = maxJitterX * pnoise1(perlin1 * i / float(len(rates)))
        jitterY = avg * maxJitterY * pnoise1(perlin2 * i / float(len(rates)))

        x = i + jitterX

        newRates[i] = sample(rates, x) + Decimal(skew * x + jitterY)

    return newRates

def main(input_path, output_path, factor):

    dir = os.path.dirname(os.path.abspath(output_path))
    if not os.path.exists(dir):
        os.makedirs(dir)

    with open(input_path, 'r') as in_file:
        with open(output_path, 'w') as out_file:

            progress = Progress()
            progress.begin_file(input_path, in_file)

            header = in_file.readline()
            split_header = header.split(';')
            normalized_header = ';'.join(split_header[0:5] + [str(x) for x in range(0, 1024)]) + '\n'
            out_file.writelines([normalized_header])

            line_index = 1

            while True:
                line = in_file.readline()
                if not line or len(line) == 0:
                    break

                split = line.split(';')

                index = split[0]
                id = split[1]
                instrumentId = split[2]
                time = split[3]
                decision = split[4]
                rates = [Decimal(x) for x in split[5:]]

                out_file.writelines([serialize(index + "-0", id, instrumentId, time, decision, rates) + '\n'])
                line_index += 1

                for i in range(1, factor):
                    augmented_rates = augment(rates, 0.2, 20, 0.05)
                    out_file.writelines([serialize(index + "-" + str(i), id, instrumentId, time, decision, augmented_rates) + '\n'])
                    line_index += 1

                progress.print()
                progress.next_item()


if __name__ == '__main__':
    FLAGS, unparsed = parser.parse_known_args()

    main(input_path=FLAGS.input_path,
         output_path=FLAGS.output_path,
         factor=FLAGS.factor)
