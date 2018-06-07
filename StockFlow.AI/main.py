import os
import argparse
import sys
import time
import shutil
import datetime
import tensorflow as tf
import platform
from shutil import copyfile
from tensorflow.contrib.tpu.python.tpu import tpu_config
from tensorflow.contrib.tpu.python.tpu import tpu_estimator
from tensorflow.contrib.tpu.python.tpu import tpu_optimizer
from tensorflow.contrib.cluster_resolver.python.training import TPUClusterResolver
from tensorflow.python.estimator.estimator import _get_default_warm_start_settings

#os.environ["CUDA_VISIBLE_DEVICES"]="-1"

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

parser.add_argument(
    '--use_tpu', type = bool, default = True,
    help = 'Whether to use the TPU for training')

parser.add_argument(
    '--model_name', type = str, default = 'GoogLeNet',
    help = 'The model name, e.g. GoogLeNet')

parser.add_argument(
    '--save_summary_steps', type = int, default = 100,
    help = 'The steps between summary saves')

parser.add_argument(
    '--save_checkpoints_steps', type = int, default = 100,
    help = 'The steps between checkpoint saves')

parser.add_argument(
    '--keep_checkpoint_max', type = int, default = 10,
    help = 'The number of checkpoints to keep')

parser.add_argument(
    '--keep_checkpoint_every_n_hours', type = int, default = 1,
    help = 'The hours between archiving a snapshot')

parser.add_argument(
    '--log_step_count_steps', type = int, default = 100,
    help = 'The steps between logging')

parser.add_argument(
    '--adam_reset', type = bool, default = False,
    help = 'Whether the optimizer parameters should be reset')

parser.add_argument(
    '--adam_learning_rate', type = float, default = 0.001,
    help = 'The learning rate')

parser.add_argument(
    '--adam_epsilon', type = float, default = 0.5,
    help = 'The AdamOptimizer epsilon')

parser.add_argument(
    '--gln_aux_exit_4a_weight', type = float, default = 0.3,
    help = 'The GoogLeNet auxiliary exit weight at 4a')

parser.add_argument(
    '--gln_aux_exit_4e_weight', type = float, default = 0.3,
    help = 'The GoogLeNet auxiliary exit weight at 4e')


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


if __name__ == '__main__':
    FLAGS, unparsed = parser.parse_known_args()
    train_file = FLAGS.train_file
    test_file = FLAGS.test_file

    tf.logging.set_verbosity(tf.logging.INFO)

    print('Preparing model directory')

    if FLAGS.load:
        if not os.path.exists(FLAGS.model_dir):
            FLAGS.load = False

    if not FLAGS.load:
        FLAGS.model_dir = FLAGS.model_dir + datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        if os.path.exists(FLAGS.model_dir):
            shutil.rmtree(FLAGS.model_dir, ignore_errors = True)
        if not os.path.exists(FLAGS.model_dir):
            os.makedirs(FLAGS.model_dir)

    ckpt_file = FLAGS.model_dir + '\\checkpoint\\'

    if not os.path.exists(ckpt_file):
        os.makedirs(ckpt_file)

    def write_resume_bat(next_epoch):
        def get_flag(flag):
            if flag == 'load':
                return True
            if flag == 'model_dir':
                return '.'
            if flag == 'test_file':
                return 'test.csv'
            if flag == 'train_file':
                return 'train.csv'
            if flag == 'start_epoch':
                return next_epoch
            else:
                return getattr(FLAGS, flag)

        def get_flag_infinity(flag):
            if flag == 'epochs':
                return 1000000
            else:
                return get_flag(flag)

        flags = [a for a in dir(FLAGS) if not a.startswith('_')]

        with open(FLAGS.model_dir + '\\resume.bat', 'w') as text_file:
            arg_str = ' '.join(['--%s=%s' % (flag, str(get_flag(flag))) for flag in flags])
            text_file.write('python main.py %s\npause' % arg_str)

        with open(FLAGS.model_dir + '\\resume_infinitely.bat', 'w') as text_file:
            arg_str = ' '.join(['--%s=%s' % (flag, str(get_flag_infinity(flag))) for flag in flags])
            text_file.write('python main.py %s\npause' % arg_str)

    if not FLAGS.load:
        copyfile(os.path.basename(__file__), FLAGS.model_dir + '\\main.py')
        copyfile('NetworkBase.py', FLAGS.model_dir + '\\NetworkBase.py')
        copyfile('GoogLeNet.py', FLAGS.model_dir + '\\GoogLeNet.py')
        copyfile('InceptionResNetV2.py', FLAGS.model_dir + '\\InceptionResNetV2.py')
        copyfile(test_file, FLAGS.model_dir + '\\test.csv')
        copyfile(train_file, FLAGS.model_dir + '\\train.csv')
        write_resume_bat(0)
        with open(FLAGS.model_dir + '\\tensorboard.bat', 'w') as text_file:
            text_file.write('tensorboard.exe --logdir=.')
        test_file = FLAGS.model_dir + '\\test.csv'
        train_file = FLAGS.model_dir + '\\train.csv'

    def input_fn(data_file, params):

        batch_size = FLAGS.batch_size
        if params:
            batch_size = params['batch_size']

        print('Loading data from %s' % data_file)
        data = Data(data_file, batch_size, FLAGS.buy_label, FLAGS.first_day, FLAGS.last_day)
        return data.dataset

    def train_input_fn(params = None):
        return input_fn(train_file, params)

    def test_input_fn(params = None):
        return input_fn(test_file, params)

    def model_fn(features, labels, mode, params):

        print('Creating model')

        if FLAGS.model_name == 'GoogLeNet':

            if mode == tf.estimator.ModeKeys.TRAIN:
                options = {
                    "is_train": True,
                    "fc_dropout_keep": 0.4,
                    "aux_fc_dropout_keep": 0.3,
                    "aux_exit_4a_weight": FLAGS.gln_aux_exit_4a_weight,
                    "aux_exit_4e_weight": FLAGS.gln_aux_exit_4e_weight,
                    "exit_weight": 1.0
                }
            else:
                options = {
                    "is_train": False,
                    "fc_dropout_keep": 1.0,
                    "aux_fc_dropout_keep": 1,
                    "aux_exit_4a_weight": FLAGS.gln_aux_exit_4a_weight,
                    "aux_exit_4e_weight": FLAGS.gln_aux_exit_4e_weight,
                    "exit_weight": 1.0
                }

            model = GoogLeNet(1, features, labels, options)

        elif FLAGS.model_name == 'InceptionResNetV2':

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
            raise Exception('Unknown model name: ' + FLAGS.model_name)

        with tf.name_scope('adam'):
            update_ops = tf.get_collection(tf.GraphKeys.UPDATE_OPS)
            with tf.control_dependencies(update_ops):
                optimizer = tf.train.AdamOptimizer(learning_rate = FLAGS.adam_learning_rate, epsilon = FLAGS.adam_epsilon)

        predictions = {
            FLAGS.buy_label: model.pred
        }

        if FLAGS.use_tpu:

            if platform.system() != 'Windows':
                print('using CrossShardOptimizer')
                optimizer = tpu_optimizer.CrossShardOptimizer(optimizer)
            else:
                print('skipping CrossShardOptimizer')

            def metric_fn(y_argmax, exit_argmax):
                return {
                  'accuracy': tf.metrics.accuracy(exit_argmax, y_argmax),
                  'precision': tf.metrics.precision(exit_argmax, y_argmax)
                }
            return tpu_estimator.TPUEstimatorSpec(
                mode = mode,
                predictions = predictions,
                loss = model.loss,
                train_op = optimizer.minimize(model.loss, tf.train.get_global_step()),
                eval_metrics = (metric_fn, {
                    'y_argmax': model.y_argmax,
                    'exit_argmax': model.exit_argmax,
                })
            )
        else:
            return tf.estimator.EstimatorSpec(
                mode = mode,
                predictions = predictions,
                loss = model.loss,
                train_op = optimizer.minimize(model.loss, tf.train.get_global_step()),
                eval_metric_ops = {
                    'accuracy': tf.metrics.accuracy(model.exit_argmax, model.y_argmax),
                    'prevision': tf.metrics.precision(model.exit_argmax, model.y_argmax)
                }
            )

    warm_start_from = ckpt_file if FLAGS.load else None

    session_config = tf.ConfigProto()
    session_config.gpu_options.allow_growth = True
    session_config.gpu_options.per_process_gpu_memory_fraction = 0.9

    if FLAGS.use_tpu:
        if 'TPU_NAME' in os.environ:
            tpu_grpc_url = TPUClusterResolver(
                tpu = [os.environ['TPU_NAME']]).get_master()
        else:
            tpu_grpc_url = None

        config = tpu_config.RunConfig(
            master = tpu_grpc_url,
            model_dir = ckpt_file,
            save_summary_steps = FLAGS.save_summary_steps,
            save_checkpoints_steps = FLAGS.save_checkpoints_steps,
            keep_checkpoint_max = FLAGS.keep_checkpoint_max,
            keep_checkpoint_every_n_hours = FLAGS.keep_checkpoint_every_n_hours,
            log_step_count_steps = FLAGS.log_step_count_steps,
            session_config = session_config,
            tpu_config = tpu_config.TPUConfig(
                iterations_per_loop = FLAGS.save_checkpoints_steps))

        estimator = tpu_estimator.TPUEstimator(
            model_fn = model_fn,
            config = config,
            params = {},
            use_tpu = False, #FLAGS.use_tpu,
            train_batch_size = FLAGS.batch_size,
            eval_batch_size = FLAGS.batch_size,
            predict_batch_size = FLAGS.batch_size)
        estimator._warm_start_settings = _get_default_warm_start_settings(warm_start_from)

    else:
        config = tf.estimator.RunConfig(
            model_dir = ckpt_file,
            save_summary_steps = FLAGS.save_summary_steps,
            save_checkpoints_steps = FLAGS.save_checkpoints_steps,
            keep_checkpoint_max = FLAGS.keep_checkpoint_max,
            keep_checkpoint_every_n_hours = FLAGS.keep_checkpoint_every_n_hours,
            log_step_count_steps = FLAGS.log_step_count_steps,
            session_config = session_config
        )

        estimator = tf.estimator.Estimator(
            model_fn = model_fn,
            warm_start_from = warm_start_from,
            config = config,
            params = {}
        )

    if FLAGS.epochs > 0:

        for epoch in range(FLAGS.start_epoch, FLAGS.epochs):
            begin = time.time()

            estimator.train(input_fn = train_input_fn)

            ev = estimator.evaluate(input_fn = test_input_fn)

            print("Epoch %d/%d, time = %ds, accuracy = %.4f" % (
                epoch + 1, FLAGS.epochs, time.time() - begin, ev['accuracy']))

            sys.stdout.flush()

            write_resume_bat(epoch + 1)

    print("done")
