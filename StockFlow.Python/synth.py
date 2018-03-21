import random
import math
from noise import pnoise1
import matplotlib.pyplot as plt


def generate(y_base, gradient, width, height, jitter_low, jitter_med, jitter_high, deform, end):

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

    base = 10000 * random.random()

    last_point = [0, (low_max + high_min) / 2, 1]
    for x in range(0, days_extra):
        if len(points) > 0:
            next_point = points[0]

            def smooth(v):
                return (1 - math.cos(v * math.pi)) / 2

            x_ratio = smooth((x - last_point[0]) / (next_point[0] - last_point[0]))

            noise_high = pnoise1(base + x * 0.05) + 1 / 2
            noise_med = pnoise1(base + x * 0.02) + 1 / 2
            noise_low = pnoise1(base + x * 0.005) + 1 / 2
            noise_very_low = pnoise1(base + x * 0.0005)

            if x >= last_x - transition_x:
                transition_factor = smooth((last_x - x) / transition_x)
                transition_factor = 0.3 + 0.7 * transition_factor
                noise_high = transition_factor * noise_high + (1 - transition_factor) * end
                noise_med = transition_factor * noise_med + (1 - transition_factor) * end
                noise_low = transition_factor * noise_low + (1 - transition_factor) * end

            noise_high = 2 * noise_high - 1
            noise_med = 2 * noise_med - 1
            noise_low = 2 * noise_low - 1

            jitter = y_mid * jitter_low * noise_low + (jitter_med * 0.5 + jitter_med * noise_med) * y_mid * jitter_high * noise_high

            chart[x] = last_point[1] + x_ratio * (next_point[1] - last_point[1]) + deform * y_mid * noise_very_low + jitter

            if x == next_point[0]:
                last_point = next_point
                points.pop(0)

    chart = chart[:last_x]

    if len(chart) > days:
        chart = chart[len(chart) - days:]

    chart_min = min(chart)
    chart_max = max(chart)

    for i,v in enumerate(chart):
        chart[i] = (chart[i] - chart_min) / (chart_max - chart_min)

    return chart


def generate_random():

    def random_range(min, max):
        return min + (max - min) * random.random()

    y_base = random_range(1, 100)
    gradient = random_range(0.005, 2)
    width = random_range(0.1, 0.5)
    height = random_range(1 * width, 2 * width)
    jitter_low = random_range(0.4 * height, 0.9 * height)
    jitter_med = random_range(0.1, 0.15)
    jitter_high = random_range(1 * height, 3 * height)
    deform = random_range(0.005, 0.01)

    chart = generate(y_base, gradient, width, height, jitter_low, jitter_med, jitter_high, deform, 0)

    return chart


if __name__ == '__main__':
    days = 5 * 365

    fig_size = plt.rcParams["figure.figsize"]
    fig_size[0] = 7
    fig_size[1] = 2
    plt.rcParams["figure.figsize"] = fig_size

    plt.plot(generate_random())
    plt.plot(generate_random())
    plt.plot(generate_random())
    plt.show()