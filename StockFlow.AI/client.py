import os
import argparse
import sys
import time
import getpass
import datetime
import numpy as np
import tensorflow as tf
import matplotlib.pyplot as plt
import glob
import shutil
import re

os.environ["CUDA_VISIBLE_DEVICES"]="-1"

from GoogLeNet import GoogLeNet
from InceptionResNetV2 import InceptionResNetV2

sys.path.append('../StockFlow.Common')
from StockFlow import StockFlow

parser = argparse.ArgumentParser()

parser.add_argument('--checkpoint_dir', type=str, default='model20180629121604/checkpoint', help='Model checkpoint directory.')
parser.add_argument('--proxy_url', type=str, default='', help='Proxy URL.')
parser.add_argument('--proxy_user', type=str, default='', help='Proxy user.')
parser.add_argument('--proxy_password', type=str, default='', help='Proxy password.')
parser.add_argument('--stockflow_url', type=str, default='http://stockflow.net', help='StockFlow base url.')
parser.add_argument('--stockflow_user', type=str, default='', help='StockFlow user.')
parser.add_argument('--stockflow_password', type=str, default='', help='StockFlow password.')
parser.add_argument('--model_name', type = str, default = 'GoogLeNet', help = 'The model name, e.g. GoogLeNet')
parser.add_argument('--buy_label', type=str, default='buy', help='The label used if the user decided on an action for this dataset, e.g. buy')
parser.add_argument('--tf_log', type=str, default='ERROR', help='The tensorflow log level: DEBUG, INFO, WARN, ERROR, FATAL')
parser.add_argument('--sleep', type=int, default='3', help='The number of seconds to wait between snapshots')
parser.add_argument('--checkpoint_copy', type=bool, default=True, help='Whether to create a local copy of the checkpoint')
parser.add_argument('--min_buy_probability', type=float, default=0.99, help='Minimum predicted probability to decide for buy')


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


def plot(chart):
    fig_size = plt.rcParams["figure.figsize"]
    fig_size[0] = 7
    fig_size[1] = 2
    plt.rcParams["figure.figsize"] = fig_size

    plt.plot(chart)
    plt.show()


def get_chart(snapshot):
    rates = list(map(lambda x: [datetime.datetime.strptime(x['T'], '%y%m%d'), x['C']], snapshot['Rates']))

    start_date = datetime.datetime.strptime(snapshot['Rates'][0]['T'], '%y%m%d')
    end_date = datetime.datetime.strptime(snapshot['Rates'][-1]['T'], '%y%m%d')

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

    downsampled = [0] * 1024
    for x in range(0, 1024):
        downsampled[x] = linear_sample(daily_rates, x / 1024 * len(daily_rates))
    chart = downsampled

    if 'PreviousDecision' in snapshot and snapshot['PreviousDecision'] == 'buy' and 'PreviousBuyRate' in snapshot and snapshot['PreviousBuyRate'] > 0:
        chart += [snapshot['PreviousBuyRate']]

    normalize(chart)

    return chart


if __name__ == '__main__':
    FLAGS, unparsed = parser.parse_known_args()

    tf.logging.set_verbosity(getattr(tf.logging, FLAGS.tf_log))

    if not os.path.exists(FLAGS.checkpoint_dir):
        raise Exception('Could not find %s' % FLAGS.checkpoint_dir)

    checkpoint_dir = FLAGS.checkpoint_dir + "/client"
    if not os.path.exists(checkpoint_dir):
        os.makedirs(checkpoint_dir)

    proxy_user = FLAGS.proxy_user
    proxy_password = FLAGS.proxy_password
    stockflow_user = FLAGS.stockflow_user
    stockflow_password = FLAGS.stockflow_password

    if len(proxy_user) > 0 and len(proxy_password) == 0:
        proxy_password = getpass.getpass(prompt = 'Proxy Password: ')

    if len(stockflow_user) == 0:
        stockflow_user = input("StockFlow User: ")

    if len(stockflow_password) == 0:
        stockflow_password = getpass.getpass(prompt = 'StockFlow Password: ')

    def model_fn(features, labels, mode, params):

        if FLAGS.model_name == 'GoogLeNet':

            options = {
                "is_train": False,
                "fc_dropout_keep": 1.0,
                "aux_fc_dropout_keep": 1,
                "aux_exit_4a_weight": 0,
                "aux_exit_4e_weight": 0,
                "exit_weight": 1.0
            }

            model = GoogLeNet(0, features, labels, mode, options)

        elif FLAGS.model_name == 'InceptionResNetV2':

            options = {
                "is_train": False,
                "fc_dropout_keep": 1.0,
                "residual_scale": 0.1
            }

            model = InceptionResNetV2(0, features, labels, mode, options)

        else:
            raise Exception('Unknown model name: ' + FLAGS.model_name)

        predictions = {
            FLAGS.buy_label: model.exit_argmax,
            'probabilities': tf.nn.softmax(model.exit),
            'logits': model.exit,
        }

        return tf.estimator.EstimatorSpec(
            mode = mode,
            predictions = predictions
        )

    config = tf.estimator.RunConfig(
        model_dir = checkpoint_dir
    )

    estimator = tf.estimator.Estimator(
        model_fn = model_fn,
        config = config,
        params = {}
    )

    stockflow = StockFlow(FLAGS.proxy_url, proxy_user, proxy_password, FLAGS.stockflow_url)
    stockflow.login(stockflow_user, stockflow_password)
    print("logged in")

    known_checkpoint_file = ''

    while True:
        try:
            checkpoint_file = tf.train.latest_checkpoint(FLAGS.checkpoint_dir)
            if not checkpoint_file:
                print("no checkpoint found")
            else:
                checkpoint_files = glob.glob(checkpoint_file + "*")
                if checkpoint_file != known_checkpoint_file and len(checkpoint_files) <= 2:
                    print("checkpoint is incomplete")
                else:
                    print("get snapshot")
                    snapshot = stockflow.new_snapshot()
                    if snapshot is None:
                        print("no snapshot available")
                    else:
                        print("prepare snapshot")
                        chart = get_chart(snapshot)
                        # plot(chart)

                        if 'PreviousDecision' not in snapshot or snapshot['PreviousDecision'] != 'buy':

                            if checkpoint_file != known_checkpoint_file:
                                for file in glob.glob(checkpoint_dir + "/*"):
                                    os.unlink(file)

                                for file in checkpoint_files:
                                    shutil.copy(file, checkpoint_dir)

                                with open(checkpoint_dir + '/checkpoint', 'w') as text_file:
                                    text_file.write('model_checkpoint_path: \"%s\"' % os.path.basename(checkpoint_file))

                                known_checkpoint_file = checkpoint_file

                            def input_fn():
                                features = tf.constant(np.reshape(chart, [1, len(chart), 1, 1]), dtype=tf.float32, shape=[1, len(chart), 1, 1])
                                labels = tf.constant([[0.0, 0.0]], dtype=tf.float32)
                                dataset = tf.data.Dataset.from_tensor_slices((features, labels))
                                dataset = dataset.batch(1)
                                return dataset


                            print("predict")
                            predictions = list(estimator.predict(input_fn=input_fn))

                            classes = [p[FLAGS.buy_label] for p in predictions]
                            probabilities = [p['probabilities'] for p in predictions]

                            if classes[0] == 1 and probabilities[0][1] >= FLAGS.min_buy_probability:
                                decision = 'buy'
                            else:
                                decision = 'wait'

                            reason = ' (wait=%d %s=%d)' % (round(100 * probabilities[0][0]), FLAGS.buy_label, round(100 * probabilities[0][1]))

                        else:
                            decision = 'wait'
                            reason = ' because it was already bought'

                        print('%s %s on %s (snapshot %d)%s' % (
                            decision, snapshot['Instrument']['InstrumentName'], snapshot['Date'], snapshot['ID'], reason))

                        stockflow.set_decision(snapshot['ID'], decision)

        except Exception as e:
            print("Unexpected error:", str(e))

        time.sleep(FLAGS.sleep)
