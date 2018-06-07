import os
import argparse
import sys
import time
import shutil
import datetime
from shutil import copyfile

#os.environ["CUDA_VISIBLE_DEVICES"]="-1"
model_name = 'GoogLeNet'
save_summary_steps = 100
save_checkpoints_secs = 60
keep_checkpoint_max = 10
keep_checkpoint_every_n_hours = 1
log_step_count_steps = 100
adam_reset = False
adam_learning_rate = 0.001
adam_epsilon = 0.5
gln_aux_exit_4a_weight = 0.3
gln_aux_exit_4e_weight = 0.3

import tensorflow as tf

from GoogLeNet import GoogLeNet
from InceptionResNetV2 import InceptionResNetV2

parser = argparse.ArgumentParser()

parser.add_argument(
    '--model_dir', type = str, default = 'model',
    help = 'Base directory for the model.')

parser.add_argument(
    '--load', type = bool, default = False, help = 'Whether to load an existing model.')

parser.add_argument(
    '--epochs', type = int, default = 1000, help = 'Number of cycles over the whole data.')

parser.add_argument(
    '--start_epoch', type = int, default = 0, help = 'Start index in epochs.')

parser.add_argument(
    '--batch_size', type = int, default = 48, help = 'Number of examples per batch.')

parser.add_argument(
    '--test_file', type = str, default = 'buying_test_aug_norm.csv',
    help = 'Path to the test data.')

parser.add_argument(
    '--train_file', type = str, default = 'buying_train_aug_norm.csv',
    help = 'Path to the train data.')

parser.add_argument(
    '--first_day', type = int, default = 0,
    help = 'The first day column name e.g. -1814.')

parser.add_argument(
    '--last_day', type = int, default = 1023,
    help = 'The last day column name e.g. 0.')

parser.add_argument(
    '--buy_label', type = str, default = 'buy',
    help = 'The label used if the user decided on an action for this dataset, e.g. buy')


class Data(object):
    def __init__(self, file, batch_size, buy_label, first_day, last_day):
        self.batch_size = batch_size

        column_defaults = [['0'], ['0'], ['0'], ['ignore'], ['19700101']] + [[0.00] for i in range(first_day, last_day + 1)]

        with tf.name_scope('data'):

            assert tf.gfile.Exists(file), ('%s not found.' % file)

            file_count = self.__get_line_count(file)

            if file_count < self.batch_size:
                print('WARNING: batch_size is greater than available datasets. Reducing batch size to %d' % file_count)
                self.batch_size = file_count

            self.batches = int(file_count / self.batch_size)

            self.count = self.batches * self.batch_size

            def parse_csv(value):
                columns = tf.decode_csv(value, record_defaults = column_defaults, field_delim = ";")

                features = columns[5:len(columns)]
                labels = columns[3]

                features = tf.stack(features)
                features = tf.reshape(features, [features.get_shape()[0], 1, 1])

                labels = tf.cast(tf.equal(labels, buy_label), dtype = tf.int32)
                labels = tf.one_hot(indices = labels, depth = 2, on_value = 1.0, off_value = 0.0, axis = -1)

                return features, labels

            print('Preparing data: TextLineDataset')
            dataset = tf.data.TextLineDataset(file).skip(1)

            print('Preparing data: map')
            dataset = dataset.map(parse_csv, num_parallel_calls = 5)

            print('Preparing data: batch/prefetch/cache')
            self.dataset = dataset.batch(batch_size).prefetch(self.count).cache()

    def __get_line_count(self, file):

        count = 0
        with open(file, 'r', encoding = 'utf8') as f:
            i = 0
            while True:
                line = f.readline()
                if not line:
                    break
                if i > 0 and len(line) > 0:
                    count = count + 1
                i = i + 1

        return count


def main(model_dir, load_ckpt, epochs, start_epoch, batch_size, test_file, train_file, first_day, last_day, buy_label):
    print('Preparing model directory')

    if load_ckpt:
        if not os.path.exists(model_dir):
            load_ckpt = False

    if not load_ckpt:
        model_dir = model_dir + datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        if os.path.exists(model_dir):
            shutil.rmtree(model_dir, ignore_errors = True)
        if not os.path.exists(model_dir):
            os.makedirs(model_dir)

    ckpt_file = model_dir + '\\checkpoint\\'

    if not os.path.exists(ckpt_file):
        os.makedirs(ckpt_file)

    def write_resume_bat(next_epoch):
        with open(model_dir + '\\resume.bat', 'w') as text_file:
            text_file.write(
                'python main.py --load=True --model_dir=. --test_file=test.csv --train_file=train.csv --start_epoch=%s --epochs=%d --batch_size=%d --first_day=%d --last_day=%d --buy_label=%s\npause' % (
                    next_epoch, epochs, batch_size, first_day, last_day, buy_label))
        with open(model_dir + '\\resume_infinitely.bat', 'w') as text_file:
            text_file.write(
                'python main.py --load=True --model_dir=. --test_file=test.csv --train_file=train.csv --start_epoch=%s --epochs=1000000 --batch_size=%d --first_day=%d --last_day=%d --buy_label=%s\npause' % (
                    next_epoch, batch_size, first_day, last_day, buy_label))

    if not load_ckpt:
        copyfile(os.path.basename(__file__), model_dir + '\\main.py')
        copyfile('NetworkBase.py', model_dir + '\\NetworkBase.py')
        copyfile('GoogLeNet.py', model_dir + '\\GoogLeNet.py')
        copyfile('InceptionResNetV2.py', model_dir + '\\InceptionResNetV2.py')
        copyfile(test_file, model_dir + '\\test.csv')
        copyfile(train_file, model_dir + '\\train.csv')
        write_resume_bat(0)
        with open(model_dir + '\\tensorboard.bat', 'w') as text_file:
            text_file.write('tensorboard.exe --logdir=.')
        test_file = model_dir + '\\test.csv'
        train_file = model_dir + '\\train.csv'

    def input_fn(data_file):
        print('Loading data from %s' % data_file)
        data = Data(data_file, batch_size, buy_label, first_day, last_day)
        return data.dataset

    tf.logging.set_verbosity(tf.logging.INFO)

    def model_fn(features, labels, mode, params):

        print('Creating model')

        if model_name == 'GoogLeNet':

            if mode == tf.estimator.ModeKeys.TRAIN:
                options = {
                    "is_train": True,
                    "fc_dropout_keep": 0.4,
                    "aux_fc_dropout_keep": 0.3,
                    "aux_exit_4a_weight": gln_aux_exit_4a_weight,
                    "aux_exit_4e_weight": gln_aux_exit_4e_weight,
                    "exit_weight": 1.0
                }
            else:
                options = {
                    "is_train": False,
                    "fc_dropout_keep": 1.0,
                    "aux_fc_dropout_keep": 1,
                    "aux_exit_4a_weight": gln_aux_exit_4a_weight,
                    "aux_exit_4e_weight": gln_aux_exit_4e_weight,
                    "exit_weight": 1.0
                }

            model = GoogLeNet(1, features, labels, options)

        elif model_name == 'InceptionResNetV2':

            if mode == tf.estimator.ModeKeys.TRAIN:
                options = {
                    "is_train": True,
                    "fc_dropout_keep": 0.8,
                    "residual_scale": 0.1
                }
            else:
                options = {
                    "is_train": False,
                    "fc_dropout_keep": 1.0,
                    "residual_scale": 0.1
                }

            model = InceptionResNetV2(1, features, labels, options)

        else:
            raise Exception('Unknown model name: ' + model_name)

        with tf.name_scope('adam'):
            update_ops = tf.get_collection(tf.GraphKeys.UPDATE_OPS)
            with tf.control_dependencies(update_ops):
                optimizer = tf.train.AdamOptimizer(learning_rate = adam_learning_rate, epsilon = adam_epsilon).minimize(
                    model.loss, global_step = tf.train.get_global_step())

        predictions = {
            buy_label: model.pred
        }

        eval_metric_ops = {
            "accuracy": model.accuracy_metric
        }

        return tf.estimator.EstimatorSpec(mode = mode, predictions = predictions, loss = model.loss, train_op = optimizer, eval_metric_ops = eval_metric_ops)

    warm_start_from = ckpt_file if load_ckpt else None

    session_config = tf.ConfigProto()
    session_config.gpu_options.allow_growth = True
    session_config.gpu_options.per_process_gpu_memory_fraction = 0.9

    config = tf.estimator.RunConfig(
        model_dir = ckpt_file,
        save_summary_steps = save_summary_steps,
        save_checkpoints_secs = save_checkpoints_secs,
        keep_checkpoint_max = keep_checkpoint_max,
        keep_checkpoint_every_n_hours = keep_checkpoint_every_n_hours,
        log_step_count_steps = log_step_count_steps,
        session_config = session_config
    )

    nn = tf.estimator.Estimator(model_fn = model_fn, warm_start_from = warm_start_from, config = config, params = {})

    if epochs > 0:

        for epoch in range(start_epoch, epochs):
            begin = time.time()

            nn.train(input_fn = lambda: input_fn(train_file))

            ev = nn.evaluate(input_fn = lambda: input_fn(test_file))

            print("Epoch %d/%d, time = %ds, accuracy = %.4f" % (
                epoch + 1, epochs, time.time() - begin, ev['accuracy']))

            sys.stdout.flush()

            write_resume_bat(epoch + 1)

    print("done")

if __name__ == '__main__':
    FLAGS, unparsed = parser.parse_known_args()
    main(model_dir = FLAGS.model_dir,
         load_ckpt = FLAGS.load,
         epochs = FLAGS.epochs,
         start_epoch = FLAGS.start_epoch,
         batch_size = FLAGS.batch_size,
         test_file = FLAGS.test_file,
         train_file = FLAGS.train_file,
         first_day = FLAGS.first_day,
         last_day = FLAGS.last_day,
         buy_label = FLAGS.buy_label)
