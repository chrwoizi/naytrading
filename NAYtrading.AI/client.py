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
from Data import shape_features

sys.path.append('../NAYtrading.Common')
from NAYtrading import NAYtrading

parser = argparse.ArgumentParser()

parser.add_argument('--buy_checkpoint_dir', type=str, default='model20180629121604/checkpoint', help='Buying model checkpoint directory.')
parser.add_argument('--sell_checkpoint_dir', type=str, default='', help='Selling model checkpoint directory.')
parser.add_argument('--proxy_url', type=str, default='', help='Proxy URL.')
parser.add_argument('--proxy_user', type=str, default='', help='Proxy user.')
parser.add_argument('--proxy_password', type=str, default='', help='Proxy password.')
parser.add_argument('--naytrading_url', type=str, default='http://naytrading.com', help='NAYtrading base url.')
parser.add_argument('--naytrading_user', type=str, default='', help='NAYtrading AI user.')
parser.add_argument('--naytrading_password', type=str, default='', help='NAYtrading password.')
parser.add_argument('--model_name', type = str, default = 'GoogLeNet', help = 'The model name, e.g. GoogLeNet')
parser.add_argument('--buy_label', type=str, default='buy', help='The label used if the user decided on a buy action for this dataset, e.g. buy')
parser.add_argument('--sell_label', type=str, default='sell', help='The label used if the user decided on a sell action for this dataset, e.g. sell')
parser.add_argument('--tf_log', type=str, default='ERROR', help='The tensorflow log level: DEBUG, INFO, WARN, ERROR, FATAL')
parser.add_argument('--sleep', type=int, default='3', help='The number of seconds to wait between snapshots')
parser.add_argument('--no_snapshot_sleep', type=int, default='60', help='The number of seconds to wait after no snapshot is available')
parser.add_argument('--checkpoint_copy', type=bool, default=True, help='Whether to create a local copy of the checkpoint')
parser.add_argument('--min_buy_probability', type=float, default=0.99, help='Minimum predicted probability to decide for buy')
parser.add_argument('--min_sell_probability', type=float, default=0.99, help='Minimum predicted probability to decide for sell')
parser.add_argument('--min_loss', type=float, default=0.1, help='Wait automatically if the loss is less than this value. Set 0 to disable.')
parser.add_argument('--min_gain', type=float, default=0.04, help='Wait automatically if the gain is less than this value. Set 0 to disable.')
parser.add_argument('--max_loss', type=float, default=0.3, help='Sell automatically if the loss is greater than this value. Set 0 to disable.')
parser.add_argument('--max_gain', type=float, default=0.15, help='Sell automatically if the gain is greater than this value. Set 0 to disable.')
parser.add_argument('--sell_at_max_factor', type=float, default=1, help='Sell automatically if the current price is at the historic maximum multiplied by this value. Set 0 to disable.')


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

    if 'PreviousDecision' in snapshot and snapshot['PreviousDecision'] == FLAGS.buy_label:
        buy_time = datetime.datetime.strptime(snapshot['PreviousTime'], '%y%m%d')
    else:
        buy_time = None

    total_days = (end_date - start_date).days + 1
    daily_rates = [[None, 0]] * total_days
    index = 0
    i = 0
    buy_day = 0
    for d in (rates[0][0] + datetime.timedelta(days = n) for n in range(total_days)):
        while index < len(rates) - 1 and rates[index + 1][0] <= d:
            index += 1
        daily_rates[i] = [d, rates[index][1]]
        if buy_time:
            if buy_day == 0 and rates[index][0] >= buy_time:
                buy_day = int(round(1023 * i / (total_days - 1)))
        i += 1

    daily_rates = list(map(lambda x: x[1], daily_rates))

    downsampled = [0] * 1024
    for x in range(0, 1024):
        downsampled[x] = linear_sample(daily_rates, x / 1024 * len(daily_rates))
    chart = downsampled

    if buy_day > 0:
        chart += [buy_day]

    normalize(chart)

    return chart


if __name__ == '__main__':
    FLAGS, unparsed = parser.parse_known_args()

    tf.logging.set_verbosity(getattr(tf.logging, FLAGS.tf_log))

    if not os.path.exists(FLAGS.buy_checkpoint_dir):
        raise Exception('Could not find buy checkpoint at %s' % FLAGS.buy_checkpoint_dir)

    buy_checkpoint_dir = FLAGS.buy_checkpoint_dir + "/client"
    if not os.path.exists(buy_checkpoint_dir):
        os.makedirs(buy_checkpoint_dir)

    if not os.path.exists(FLAGS.sell_checkpoint_dir):
        sell_checkpoint_dir = None
        print('Could not find sell checkpoint at %s' % FLAGS.sell_checkpoint_dir)
        print('Using thresholds to determine sell decision.')
    else:
        sell_checkpoint_dir = FLAGS.sell_checkpoint_dir + "/client"
        if not os.path.exists(sell_checkpoint_dir):
            os.makedirs(sell_checkpoint_dir)

    proxy_user = FLAGS.proxy_user
    proxy_password = FLAGS.proxy_password
    naytrading_user = FLAGS.naytrading_user
    naytrading_password = FLAGS.naytrading_password

    if len(proxy_user) > 0 and len(proxy_password) == 0:
        proxy_password = getpass.getpass(prompt = 'Proxy Password: ')

    if len(naytrading_user) == 0:
        naytrading_user = input("NAYtrading AI User: ")

    if not naytrading_user.endswith('.ai'):
        input("WARNING - User does not end with .ai - type override to continue: ")

    if len(naytrading_password) == 0:
        naytrading_password = getpass.getpass(prompt = 'NAYtrading Password: ')

    def model_fn(features, labels, mode, params):

        if FLAGS.model_name == 'GoogLeNet':

            options = {
                "is_train": False,
                "fc_dropout_keep": 1.0,
                "aux_fc_dropout_keep": 1,
                "aux_exit_4a_weight": 0,
                "aux_exit_4e_weight": 0,
                "exit_weight": 1.0,
                "action": params['action']
            }

            model = GoogLeNet(0, features, labels, mode, options)

        elif FLAGS.model_name == 'InceptionResNetV2':

            options = {
                "is_train": False,
                "fc_dropout_keep": 1.0,
                "residual_scale": 0.1,
                "action": params['action']
            }

            model = InceptionResNetV2(0, features, labels, mode, options)

        else:
            raise Exception('Unknown model name: ' + FLAGS.model_name)

        predictions = {
            params['action']: model.exit_argmax,
            'probabilities': tf.nn.softmax(model.exit),
            'logits': model.exit
        }

        return tf.estimator.EstimatorSpec(
            mode = mode,
            predictions = predictions
        )

    buy_estimator = tf.estimator.Estimator(
        model_fn = model_fn,
        config = tf.estimator.RunConfig(
            model_dir = buy_checkpoint_dir
        ),
        params = {'action': FLAGS.buy_label}
    )

    if sell_checkpoint_dir:
        sell_estimator = tf.estimator.Estimator(
            model_fn = model_fn,
            config = tf.estimator.RunConfig(
                model_dir = sell_checkpoint_dir
            ),
            params = {'action': FLAGS.sell_label}
        )
    else:
        sell_estimator = None

    naytrading = NAYtrading(FLAGS.proxy_url, proxy_user, proxy_password, FLAGS.naytrading_url)
    naytrading.login(naytrading_user, naytrading_password)
    print("logged in")

    known_checkpoint_file = {
        FLAGS.buy_label: '',
        FLAGS.sell_label: ''
    }

    def refresh_checkpoint(checkpoint_dir, checkpoint_files, checkpoint_file, action):
        if checkpoint_file != known_checkpoint_file[action]:
            for file in glob.glob(checkpoint_dir + "/*"):
                os.unlink(file)

            for file in checkpoint_files:
                shutil.copy(file, checkpoint_dir)

            with open(checkpoint_dir + '/checkpoint', 'w') as text_file:
                text_file.write('model_checkpoint_path: \"%s\"' % os.path.basename(checkpoint_file))

            known_checkpoint_file[action] = checkpoint_file


    def input_fn_factory(chart, other_features):
        def input_fn():
            features = tf.constant(chart, dtype=tf.float32)
            features = shape_features(features, other_features)
            features = tf.expand_dims(features, 0)

            labels = tf.constant([[0.0, 0.0]], dtype=tf.float32)

            dataset = tf.data.Dataset.from_tensor_slices((features, labels))
            dataset = dataset.batch(1)
            return dataset

        return input_fn


    def predict(estimator, action, min_probability, input_fn):

        print("predict")
        predictions = list(estimator.predict(input_fn=input_fn))

        classes = [p[action] for p in predictions]
        probabilities = [p['probabilities'] for p in predictions]

        if classes[0] == 1 and probabilities[0][1] >= min_probability:
            decision = action
        else:
            decision = 'wait'

        reason = ' (wait=%d %s=%d)' % (round(100 * probabilities[0][0]), action, round(100 * probabilities[0][1]))

        return decision, reason


    while True:
        sleep = FLAGS.sleep
        try:
            buy_checkpoint_file = tf.train.latest_checkpoint(FLAGS.buy_checkpoint_dir)

            if sell_estimator:
                sell_checkpoint_file = tf.train.latest_checkpoint(FLAGS.sell_checkpoint_dir)
            else:
                sell_checkpoint_file = None

            if not buy_checkpoint_file:
                print("no " + FLAGS.buy_label + " checkpoint found")
            elif sell_estimator is not None and not sell_checkpoint_file:
                print("no " + FLAGS.sell_label + " checkpoint found")
            else:

                buy_checkpoint_files = glob.glob(buy_checkpoint_file + "*")
                if sell_estimator:
                    sell_checkpoint_files = glob.glob(sell_checkpoint_file + "*")
                else:
                    sell_checkpoint_files = None

                if buy_checkpoint_file != known_checkpoint_file[FLAGS.buy_label] and len(buy_checkpoint_files) <= 2:
                    print(FLAGS.buy_label + " checkpoint is incomplete")
                elif sell_estimator is not None and sell_checkpoint_file != known_checkpoint_file[FLAGS.sell_label] and len(sell_checkpoint_files) <= 2:
                    print(FLAGS.sell_label + " checkpoint is incomplete")
                else:
                    print("get snapshot")
                    snapshot = naytrading.new_snapshot()
                    if snapshot is None:
                        sleep = FLAGS.no_snapshot_sleep
                        print("no snapshot available")
                    else:
                        sleep = FLAGS.sleep
                        print("prepare snapshot")
                        chart = get_chart(snapshot)
                        # plot(chart)

                        if 'PreviousDecision' in snapshot and snapshot['PreviousDecision'] == FLAGS.buy_label:

                            close = float(snapshot['Rates'][-1]['C'])
                            max_close = max(float(x['C']) for x in snapshot['Rates'])

                            diff = (close - float(snapshot['PreviousBuyRate'])) / float(snapshot['PreviousBuyRate'])
                            if FLAGS.min_loss > 0 and FLAGS.min_gain > 0 and diff > -FLAGS.min_loss and diff < FLAGS.min_gain:
                                decision = 'wait'
                                reason = ' no significant change since it was bought'
                            elif FLAGS.max_loss > 0 and -diff >= FLAGS.max_loss:
                                decision = 'sell'
                                reason = ' loss threshold'
                            elif FLAGS.max_gain > 0 and diff >= FLAGS.max_gain:
                                decision = 'sell'
                                reason = ' gain threshold'
                            elif FLAGS.sell_at_max_factor > 0 and close >= max_close * FLAGS.sell_at_max_factor:
                                decision = 'sell'
                                reason = ' reached maximum'
                            elif sell_estimator:
                                refresh_checkpoint(sell_checkpoint_dir, sell_checkpoint_files, sell_checkpoint_file, FLAGS.sell_label)
                                decision, reason = predict(sell_estimator, FLAGS.sell_label, FLAGS.min_sell_probability, input_fn_factory(chart, 1))
                            else:
                                decision = 'wait'
                                reason = ' no checkpoint given and no threshold reached'

                        else:
                            refresh_checkpoint(buy_checkpoint_dir, buy_checkpoint_files, buy_checkpoint_file, FLAGS.buy_label)
                            decision, reason = predict(buy_estimator, FLAGS.buy_label, FLAGS.min_buy_probability, input_fn_factory(chart, 0))

                        print('%s %s on %s (snapshot %d)%s' % (
                            decision, snapshot['Instrument']['InstrumentName'], snapshot['Date'], snapshot['ID'], reason))

                        naytrading.set_decision(snapshot['ID'], decision)

        except Exception as e:
            print("Unexpected error:", str(e))

        time.sleep(sleep)
