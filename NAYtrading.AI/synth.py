import random
import math
import argparse
import numpy as np
import datetime
from noise import pnoise1
import matplotlib.pyplot as plt


parser = argparse.ArgumentParser()

parser.add_argument('--test', type=int, default=1000, help='Number of test data rows.')
parser.add_argument('--train', type=int, default=100000, help='Number of train data rows.')


def random_range(min, max):
    return min + (max - min) * random.random()


def sample(chart, x):
    return chart[max(0, min(int(x), len(chart) - 1))]


def linear_sample(chart, x):
    x1 = sample(chart, int(x))
    x2 = sample(chart, int(x) + 1)
    return x1 + (x2 - x1) * (x - int(x))


def normalize(chart):
    chart_min = min(chart)
    chart_max = max(chart)

    for i,v in enumerate(chart):
        diff = chart_max - chart_min
        if diff != 0:
            chart[i] = (chart[i] - chart_min) / diff


def generate_well_formed(config):
    days = config.days
    y_base = config.y_base
    gradient = config.gradient
    width = config.width
    height = config.height
    jitter_low = config.jitter_low
    jitter_med = config.jitter_med
    jitter_high = config.jitter_high
    deform = config.deform
    end = config.end

    point_dist_min = int(width * 0.2 * days)
    point_dist_max = int(width * days)
    points = []

    y_mid = y_base + gradient * (days + (point_dist_max + point_dist_min) / 2) / 2

    low_min = -height * y_mid
    low_max = -height * 0.8 * y_mid

    high_min = height * 0.8 * y_mid
    high_max = height * y_mid

    days_extra = days + 2 * point_dist_max

    transition_x = 20

    x = 0
    last_low_x = 0
    last_high_x = 0
    while x < days_extra:
        x = x + random.randint(point_dist_min, point_dist_max)
        if x >= days_extra:
            break
        if len(points) % 2 == 0:
            y = y_base + x * gradient + low_min + (low_max-low_min) * random.random()
            points.append([x,y,0])
            last_low_x = x
        else:
            y = y_base + x * gradient + high_min + (high_max-high_min) * random.random()
            points.append([x,y,1])
            last_high_x = x

    last_x = int(last_low_x + (last_high_x - last_low_x) * end)

    for point in points:
        if point[0] == last_low_x:
            point[1] = y_base + point[0] * gradient + low_min + (low_max-low_min) * 0.4 * random.random()
        if point[0] == last_high_x:
            point[1] = y_base + point[0] * gradient + high_max + (high_max-high_min) * (0.6 + 0.4 * random.random())

    chart = [0] * days_extra

    base1 = 10000 * random.random()
    base2 = 10000 * random.random()
    base3 = 10000 * random.random()
    base4 = 10000 * random.random()
    base5 = 10000 * random.random()

    last_point = [0, (low_max + high_min) / 2, 1]
    for x in range(0, days_extra):
        if len(points) > 0:
            next_point = points[0]

            def smooth(v):
                return (1 - math.cos(v * math.pi)) / 2

            x_ratio = smooth((x - last_point[0]) / (next_point[0] - last_point[0]))

            noise_high = pnoise1(base1 + x * 0.05) + 1 / 2
            noise_med = pnoise1(base2 + x * 0.02) + 1 / 2
            noise_low = pnoise1(base3 + x * 0.005) + 1 / 2
            noise_very_low = pnoise1(base4 + x * 0.0005)
            jitter_very_high = pnoise1(base5 + x * 0.08)

            if x >= last_x - transition_x:
                transition_factor = smooth((last_x - x) / transition_x)
                transition_factor = 0.3 + 0.7 * transition_factor
                noise_high = transition_factor * noise_high + (1 - transition_factor) * end
                noise_med = transition_factor * noise_med + (1 - transition_factor) * end
                noise_low = transition_factor * noise_low + (1 - transition_factor) * end

            noise_high = 2 * noise_high - 1
            noise_med = 2 * noise_med - 1
            noise_low = 2 * noise_low - 1

            jitter = y_mid * jitter_low * noise_low + (jitter_med * 0.5 + jitter_med * noise_med) * y_mid * jitter_high * noise_high + 0.1 * y_mid * jitter_very_high

            chart[x] = last_point[1] + x_ratio * (next_point[1] - last_point[1]) + deform * y_mid * noise_very_low + jitter

            if x == next_point[0]:
                last_point = next_point
                points.pop(0)

    chart = chart[:last_x]

    if len(chart) > days:
        chart = chart[len(chart) - days:]

    downsampled = [0] * 1024
    for x in range(0, 1024):
        downsampled[x] = linear_sample(chart, x / 1024 * len(chart))
    chart = downsampled

    normalize(chart)

    return chart


def generate_random():
    chart = [0] * 1024

    base = 10000 * random.random()

    #random slope
    for x in range(0, 1024):
        chart[x] = chart[max(0, x-1)] + random_range(-1,1)

    #deform
    avg = sum(chart) / len(chart)
    for x in range(0, 1024):
        noise = pnoise1(base + x * 0.002)
        chart[x] += 2 * avg * noise

    # lift the end
    for x in range(900, 1024):
        chart[x] += chart[x-100] * math.pow((x - 900) / (1024-900), 2)

    normalize(chart)

    return chart


class BuyConfig():
    def __init__(self):
        self.days = 5 * 365 - 10
        self.y_base = random_range(1, 100)
        self.gradient = random_range(0.005, 2)
        self.width = random_range(0.1, 0.3)
        self.height = random_range(1 * self.width, 2 * self.width)
        self.jitter_low = random_range(0.4 * self.height, 0.9 * self.height)
        self.jitter_med = random_range(0.1, 0.15)
        self.jitter_high = random_range(1 * self.height, 3 * self.height)
        self.deform = random_range(0.005, 0.01)
        self.end = 0

class SellConfigMid(BuyConfig):
    def __init__(self):
        super().__init__()
        self.end = 0.7

class SellConfigHigh(BuyConfig):
    def __init__(self):
        super().__init__()
        self.end = 1

class SellConfigBearish(BuyConfig):
    def __init__(self):
        super().__init__()
        self.gradient = -random_range(0.005, 2)
        self.end = random_range(0, 1)

class SellConfigWide(BuyConfig):
    def __init__(self):
        super().__init__()
        self.y_base = random_range(1, 100)
        self.gradient = random_range(-2, 2)
        self.width = random_range(2, 5)
        self.height = random_range(0.01 * self.width, 0.02 * self.width)
        self.jitter_low = random_range(0.4 * self.height, 0.9 * self.height)
        self.jitter_med = random_range(0.1, 0.15)
        self.jitter_high = random_range(1 * self.height, 3 * self.height)
        self.deform = random_range(0.005, 0.01)
        self.end = random_range(0, 1)

class SellConfigJitter(BuyConfig):
    def __init__(self):
        super().__init__()
        self.gradient = random_range(-2, 2)
        self.height = random_range(0.5 * self.width, 1 * self.width)
        self.jitter_low = random_range(10 * self.height, 20 * self.height)
        self.jitter_med = random_range(1, 1.5)
        self.jitter_high = random_range(30 * self.height, 50 * self.height)
        self.deform = random_range(5, 10)
        self.end = random_range(0.5, 1)


def plot(chart):
    fig_size = plt.rcParams["figure.figsize"]
    fig_size[0] = 7
    fig_size[1] = 2
    plt.rcParams["figure.figsize"] = fig_size

    plt.plot(chart)
    plt.show()


if __name__ == '__main__':
    
    FLAGS, unparsed = parser.parse_known_args()

    sell_generators = {
        0: lambda: generate_well_formed(SellConfigMid()),
        1: lambda: generate_well_formed(SellConfigHigh()),
        2: lambda: generate_well_formed(SellConfigBearish()),
        3: lambda: generate_well_formed(SellConfigWide()),
        4: lambda: generate_well_formed(SellConfigJitter()),
        5: lambda: generate_random()
    }

    def generate_file(filename, count):
        with open(filename, 'w', encoding='utf8') as text_file:
            text_file.write('id;instrument;decision;time;')
            text_file.write(';'.join(str(i) for i in range(0, 1024)))
            text_file.write('\n')

            last_log = datetime.datetime.now()
            last_count = 0
            durations = []

            for i in range(count):

                if i == 0 or i == count - 1 or (datetime.datetime.now() - last_log).total_seconds() > 1:
                    now = datetime.datetime.now()
                    last_duration = now - last_log
                    last_log = now
                    rows = i - last_count
                    last_count = i
                    if rows > 0:
                        durations.append(last_duration.total_seconds() / rows)
                        if len(durations) > 10:
                            durations.pop(0)
                    seconds_per_row = np.mean(durations) if len(durations) > 0 else 1
                    remaining = seconds_per_row * (count - i)
                    print_flush("%s %d/%d # %.2f rows/s # %s remaining" % (
                        filename, i + 1, count, 1 / seconds_per_row, datetime.timedelta(seconds=int(remaining))))

                if random.randint(0, 2) == 0:
                    decision = 'buy'
                    chart = generate_well_formed(BuyConfig())
                else:
                    decision = 'wait'
                    chart = sell_generators[random.randint(0, len(sell_generators) - 1)]()

                text_file.write('%d;%d;%s;19700101' % (i, i, decision))
                for x in range(1024):
                    text_file.write(';')
                    text_file.write('%.2f' % chart[x])
                text_file.write('\n')

    generate_file('train_buying_synth.csv', FLAGS.train)
    generate_file('test_buying_synth.csv', FLAGS.test)