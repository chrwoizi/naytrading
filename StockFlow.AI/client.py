from __future__ import absolute_import
from __future__ import division
from __future__ import print_function

import os
import glob
import argparse
import sys
import time
import re
import shutil
import requests
import getpass
import datetime
import matplotlib.pyplot as plt

os.environ["CUDA_VISIBLE_DEVICES"]="-1"

import numpy as np
import tensorflow as tf

from GoogLeNet import GoogLeNet
#from InceptionResNetV2 import InceptionResNetV2

sys.path.append('../StockFlow.Common')
from StockFlow import StockFlow


parser = argparse.ArgumentParser()

parser.add_argument('--checkpoint_dir', type=str, default='checkpoint', help='Base directory for the model checkpoint.')
parser.add_argument('--proxy_url', type=str, default='', help='Proxy URL.')
parser.add_argument('--proxy_user', type=str, default='', help='Proxy user.')
parser.add_argument('--proxy_password', type=str, default='', help='Proxy password.')
parser.add_argument('--stockflow_url', type=str, default='http://localhost:5000', help='StockFlow base url.')
parser.add_argument('--stockflow_user', type=str, default='', help='StockFlow user.')
parser.add_argument('--stockflow_password', type=str, default='', help='StockFlow password.')


def sample(chart, x):
    return chart[max(0, min(int(x), len(chart) - 1))]


def linear_sample(chart, x):
    x1 = sample(chart, int(x))
    x2 = sample(chart, int(x) + 1)
    return x1 + (x2 - x1) * (x - int(x))


def get_split_factor(previousRate, rate):
    factor = previousRate / rate
    rounded = round(factor)
    if rounded >= 2 and rounded < 100:
        fraction = factor - rounded
        if abs(fraction) < 0.1:
            return rounded

    factor = rate / previousRate
    rounded = round(factor)
    if rounded >= 2 and rounded < 100:
        fraction = factor - rounded
        if abs(fraction) < 0.1:
            return 1 / rounded

    return 1


def normalize(chart):
    chart_min = min(chart)
    chart_max = max(chart)

    for i,v in enumerate(chart):
        diff = chart_max - chart_min
        if diff != 0:
            chart[i] = (chart[i] - chart_min) / diff


def plot(chart):
    fig_size = plt.rcParams["figure.figsize"]
    fig_size[0] = 7
    fig_size[1] = 2
    plt.rcParams["figure.figsize"] = fig_size

    plt.plot(chart)
    plt.show()


def get_chart(snapshot):
    rates = list(map(lambda x: [datetime.datetime.strptime(x['T'], '%y%m%d'), x['C']], snapshot['Rates']))

    start_date = datetime.datetime.strptime(snapshot['StartTime'], '%d.%m.%y')
    end_date = datetime.datetime.strptime(snapshot['Date'], '%d.%m.%y')

    total_days = (end_date - start_date).days + 1
    daily_rates = [[None, 0]] * total_days
    index = 0
    i = 0
    for d in (rates[0][0] + datetime.timedelta(days = n) for n in range(total_days)):
        while index < len(rates) - 1 and rates[index + 1][0] <= d:
            index += 1
        daily_rates[i] = [d, rates[index][1]]
        i += 1

    daily_rates = list(map(lambda x: x[1], daily_rates))

    split_factor = 1
    for i in range(1, len(daily_rates)):
        split_factor *= get_split_factor(daily_rates[i - 1], daily_rates[i])
        daily_rates[i] = split_factor * daily_rates[i]

    downsampled = [0] * 1024
    for x in range(0, 1024):
        downsampled[x] = linear_sample(daily_rates, x / 1024 * len(daily_rates))
    chart = downsampled

    normalize(chart)

    return chart


def main(checkpoint_dir, proxy_url, proxy_user, proxy_password, stockflow_url, stockflow_user, stockflow_password):
    """
    :param str checkpoint_dir: Base directory for the model checkpoint
    :param int proxy_url: Proxy URL
    :param int proxy_user: Proxy user
    :param int proxy_password: Proxy password
    :param int stockflow_url: StockFlow base url
    :param str stockflow_user: StockFlow user
    :param str stockflow_password: StockFlow password
    """

    if len(proxy_user) > 0 and len(proxy_password) == 0:
        proxy_password = getpass.getpass(prompt = 'Proxy Password: ')

    if len(stockflow_user) == 0:
        stockflow_user = input("StockFlow User: ")

    if len(stockflow_password) == 0:
        stockflow_password = getpass.getpass(prompt = 'StockFlow Password: ')

    ckpt_file = checkpoint_dir + '\\'

    i = -1
    for filename in glob.iglob(ckpt_file + "*.meta", recursive=True):
        search = re.search('[^\d]+(\d+).meta$', filename, re.IGNORECASE)
        if search:
            i = max(i, int(search.group(1)))

    if i >= 0:
        print('Restoring parameters from %s' % (ckpt_file + str(i)))
        ckpt_file = ckpt_file + str(i)
    else:
        if os.path.exists(ckpt_file + "initial.meta"):
            print('Restoring parameters from %s' % (ckpt_file + 'initial'))
            ckpt_file = ckpt_file + 'initial'
        else:
            raise Exception('checkpoint not found')

    tf.logging.set_verbosity(tf.logging.INFO)

    features = tf.placeholder(tf.float32, shape=[1, 1024, 1, 1])
    labels = tf.constant([[0.0,0.0]], tf.float32)
    dataset = tf.data.Dataset.from_tensor_slices((features, labels))
    dataset = dataset.batch(1).prefetch(1).cache().repeat()
    iter = dataset.make_initializable_iterator()

    print('Model')
    model = GoogLeNet(1, iter, iter)
    #model = InceptionResNetV2(1, iter, iter)

    print('Saver')
    saver = tf.train.Saver(tf.trainable_variables())

    config = tf.ConfigProto()
    config.gpu_options.allow_growth = True
    config.gpu_options.per_process_gpu_memory_fraction = 0.9
    with tf.Session(config=config) as sess:

        print('Init')
        tf.global_variables_initializer().run()

        saver.restore(sess, ckpt_file)

        stockflow = StockFlow(proxy_url, proxy_user, proxy_password, stockflow_url)
        stockflow.login(stockflow_user, stockflow_password)

        while True:
            try:
                snapshot = stockflow.new_snapshot()
                chart = get_chart(snapshot)
                # plot(chart)

                if 'PreviousDecision' not in snapshot or snapshot['PreviousDecision'] != 'buy':
                    sess.run([iter.initializer], feed_dict={ features: np.reshape(chart, [1,1024,1,1]) })

                    #feed_dict = { model.is_train: False, model.fc_dropout_keep: 1.0, model.residual_scale: 0.1 } #InceptionResNetV2
                    feed_dict = { model.is_train: False, model.fc_dropout_keep: 1.0, model.aux_fc_dropout_keep: 1, model.aux_exit_4a_weight: 0, model.aux_exit_4e_weight: 0, model.exit_weight: 1.0 } #GoogLeNet

                    pred = sess.run([model.pred], feed_dict = feed_dict)
                    if pred[0] == 1:
                        decision = 'buy'
                    else:
                        decision = 'ignore'

                    reason = ''
                else:
                    decision = 'ignore'
                    reason = ' because it was already bought'

                print('%s %s on %s (snapshot %d)%s' % (
                    decision, snapshot['Instrument']['InstrumentName'], snapshot['Date'], snapshot['ID'], reason))

                stockflow.set_decision(stockflow_url, snapshot['ID'], decision)

            except Exception as e:
                print("Unexpected error:", str(e))

            time.sleep(300)



if __name__ == '__main__':
    tf.logging.set_verbosity(tf.logging.INFO)
    FLAGS, unparsed = parser.parse_known_args()

    main(checkpoint_dir=FLAGS.checkpoint_dir,
         proxy_url=FLAGS.proxy_url,
         proxy_user=FLAGS.proxy_user,
         proxy_password=FLAGS.proxy_password,
         stockflow_url=FLAGS.stockflow_url,
         stockflow_user=FLAGS.stockflow_user,
         stockflow_password=FLAGS.stockflow_password)
