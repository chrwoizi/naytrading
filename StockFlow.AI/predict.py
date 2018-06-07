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


if __name__ == '__main__':
    FLAGS, unparsed = parser.parse_known_args()

    tf.logging.set_verbosity(tf.logging.INFO)

    if not os.path.exists(FLAGS.checkpoint_dir):
        raise Exception('Could not find %s' % FLAGS.checkpoint_dir)

    def input_fn():
        print('Loading data from %s' % FLAGS.data_file)
        data = Data(FLAGS.data_file, FLAGS.batch_size, FLAGS.buy_label, FLAGS.first_day, FLAGS.last_day)
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
                "exit_weight": 1.0
            }

            model = GoogLeNet(1, features, labels, mode, options)

        elif FLAGS.model_name == 'InceptionResNetV2':

            options = {
                "is_train": False,
                "fc_dropout_keep": 1.0,
                "residual_scale": 0.1
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
        params = {}
    )

    predictions = list(estimator.predict(input_fn = input_fn))

    classes = [p[FLAGS.buy_label] for p in predictions]
    probabilities = [p['probabilities'] for p in predictions]

    k = 0
    buy = 0
    ignore = 0
    for pred in classes:
        if pred == 1:
            print('%d: %s (ignore=%d %s=%d)' % (k, FLAGS.buy_label, round(100 * probabilities[k][0]), FLAGS.buy_label, round(100 * probabilities[k][1])))
            buy += 1
        else:
            print('%d: ignore (ignore=%d %s=%d)' % (k, round(100 * probabilities[k][0]), FLAGS.buy_label, round(100 * probabilities[k][1])))
            ignore += 1
        k += 1

    print('%d %s, %d ignore' % (buy, FLAGS.buy_label, ignore))

    sys.stdout.flush()

