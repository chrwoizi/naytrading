import os
import argparse
import sys
import tensorflow as tf

os.environ["CUDA_VISIBLE_DEVICES"]="-1"

from Data import Data
from GoogLeNet import GoogLeNet
from InceptionResNetV2 import InceptionResNetV2

parser = argparse.ArgumentParser()

parser.add_argument('--checkpoint_dir', type=str, default='model20180607082346/checkpoint', help='Model checkpoint directory.')
parser.add_argument('--data_file', type=str, default='predict.csv', help='Data file.')
parser.add_argument('--batch_size', type=int, default=48, help='Number of examples per batch.')
parser.add_argument('--first_day', type=int, default=0, help='The first day column name e.g. -1814.')
parser.add_argument('--last_day', type=int, default=1023, help='The last day column name e.g. 0.')
parser.add_argument('--buy_label', type=str, default='buy', help='The label used if the user decided on an action for this dataset, e.g. buy')
parser.add_argument('--model_name', type = str, default = 'GoogLeNet', help = 'The model name, e.g. GoogLeNet')
parser.add_argument('--additional_columns', type = int, default = 0, help = 'Number of additional columns after the rate columns')
parser.add_argument('--out_file', type=str, default='predict_buy.csv', help='Output data file.')
parser.add_argument('--out_filter_buy', type=float, default=0.5, help='Minimum buy probability to write a row to the output file.')
parser.add_argument('--out_filter_wait', type=float, default=2, help='Minimum wait probability to write a row to the output file.')


if __name__ == '__main__':
    FLAGS, unparsed = parser.parse_known_args()

    tf.logging.set_verbosity(tf.logging.INFO)

    if not os.path.exists(FLAGS.checkpoint_dir):
        raise Exception('Could not find %s' % FLAGS.checkpoint_dir)

    def input_fn():
        print('Loading data from %s' % FLAGS.data_file)
        data = Data(FLAGS.data_file, FLAGS.batch_size, FLAGS.buy_label, FLAGS.first_day, FLAGS.last_day, 1, FLAGS.additional_columns, False)
        return data.dataset

    def model_fn(features, labels, mode, params):

        print('Creating model')

        if FLAGS.model_name == 'GoogLeNet':

            options = {
                "is_train": False,
                "fc_dropout_keep": 1.0,
                "aux_fc_dropout_keep": 1,
                "aux_exit_4a_weight": 0,
                "aux_exit_4e_weight": 0,
                "exit_weight": 1.0,
                "action": FLAGS.buy_label
            }

            model = GoogLeNet(1, features, labels, mode, options)

        elif FLAGS.model_name == 'InceptionResNetV2':

            options = {
                "is_train": False,
                "fc_dropout_keep": 1.0,
                "residual_scale": 0.1,
                "action": FLAGS.buy_label
            }

            model = InceptionResNetV2(1, features, labels, mode, options)

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
        model_dir = FLAGS.checkpoint_dir
    )

    estimator = tf.estimator.Estimator(
        model_fn = model_fn,
        config = config,
        params = {'days': FLAGS.last_day - FLAGS.first_day + 1}
    )

    predictions = list(estimator.predict(input_fn = input_fn))

    classes = [p[FLAGS.buy_label] for p in predictions]
    probabilities = [p['probabilities'] for p in predictions]

    with open(FLAGS.data_file, 'r', encoding='utf8') as in_file:
        with (open(FLAGS.out_file, 'w', encoding='utf8') if FLAGS.out_file else None) as out_file:
            header = in_file.readline()
            out_file.writelines([header])
            k = 0
            buy = 0
            wait = 0
            for pred in classes:
                line = in_file.readline()
                if pred == 1:
                    print('%d: %s (wait=%d %s=%d)' % (k, FLAGS.buy_label, round(100 * probabilities[k][0]), FLAGS.buy_label, round(100 * probabilities[k][1])))
                    buy += 1
                    if out_file and probabilities[k][1] > FLAGS.out_filter_buy:
                        out_file.writelines([line])
                else:
                    print('%d: wait (wait=%d %s=%d)' % (k, round(100 * probabilities[k][0]), FLAGS.buy_label, round(100 * probabilities[k][1])))
                    wait += 1
                    if out_file and probabilities[k][0] > FLAGS.out_filter_wait:
                        out_file.writelines([line])
                k += 1

    print('%d %s, %d wait' % (buy, FLAGS.buy_label, wait))

    sys.stdout.flush()

