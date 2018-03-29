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
import datetime
from shutil import copyfile
from subprocess import Popen

#os.environ["CUDA_VISIBLE_DEVICES"]="-1"

import numpy as np
import tensorflow as tf

#from GoogLeNet import GoogLeNet
from InceptionResNetV2 import InceptionResNetV2

parser = argparse.ArgumentParser()

parser.add_argument(
    '--model_dir', type=str, default='model',
    help='Base directory for the model.')

parser.add_argument(
    '--load', type=bool, default=False, help='Whether to load an existing model.')

parser.add_argument(
    '--epochs', type=int, default=1000, help='Number of cycles over the whole data.')

parser.add_argument(
    '--start_epoch', type=int, default=0, help='Start index in epochs.')

parser.add_argument(
    '--batch_size', type=int, default=48, help='Number of examples per batch.')

parser.add_argument(
    '--test_file', type=str, default='..\\StockFlow.WPF\\bin\\Debug\\test_buying.csv',
    help='Path to the test data.')

parser.add_argument(
    '--train_file', type=str, default='..\\StockFlow.WPF\\bin\\Debug\\train_buying.csv',
    help='Path to the train data.')

parser.add_argument(
    '--first_day', type=int, default=0,
    help='The first day column name e.g. -1814.')

parser.add_argument(
    '--last_day', type=int, default=1023,
    help='The last day column name e.g. 0.')

parser.add_argument(
    '--buy_label', type=str, default='buy',
    help='The label used if the user decided on an action for this dataset, e.g. buy')


class Snapshots(object):
    def __init__(self, test_file, train_file, batch_size, column_defaults, buy_label):
        self.batch_size = batch_size

        with tf.name_scope('data'):

            self.epochs_tensor = tf.placeholder(tf.int64, name='epochs')
            self.batch_size_tensor = tf.placeholder(tf.int64, name='batch_size')
            self.test_count_tensor = tf.placeholder(tf.int64, name='test_count')
            self.train_count_tensor = tf.placeholder(tf.int64, name='train_count')

            assert tf.gfile.Exists(test_file), ('%s not found.' % test_file)
            assert tf.gfile.Exists(train_file), ('%s not found.' % train_file)

            test_file_count = Snapshots.__get_line_count(test_file)
            train_file_count = Snapshots.__get_line_count(train_file)

            if test_file_count > 0 and test_file_count < self.batch_size:
                print(
                    'WARNING: batch_size is greater than available test datasets. Reducing batch size to %d' % test_file_count)
                self.batch_size = test_file_count

            if train_file_count < self.batch_size:
                print(
                    'WARNING: batch_size is greater than available train datasets. Reducing batch size to %d' % train_file_count)
                self.batch_size = train_file_count

            self.test_batches = int(test_file_count / self.batch_size)
            self.train_batches = int(train_file_count / self.batch_size)

            self.test_count = self.test_batches * self.batch_size
            self.train_count = self.train_batches * self.batch_size

            def parse_csv(value):
                columns = tf.decode_csv(value, record_defaults=column_defaults, field_delim=";")

                features = columns[4:len(columns)]
                labels = columns[3]

                features = tf.stack(features)
                features = tf.reshape(features, [features.get_shape()[0], 1, 1])

                labels = tf.cast(tf.equal(labels, buy_label), dtype=tf.int32)
                labels = tf.one_hot(indices=labels, depth=2, on_value=1.0, off_value=0.0, axis=-1)

                return features, labels

            print('TextLineDataset')
            test_dataset = tf.data.TextLineDataset(test_file).skip(1).take(self.test_count_tensor)
            train_dataset = tf.data.TextLineDataset(train_file).skip(1).take(self.train_count_tensor)

            print('map')
            self.test = test_dataset.map(parse_csv, num_parallel_calls=5)
            self.train = train_dataset.map(parse_csv, num_parallel_calls=5)

            print('batch/prefetch/cache/repeat/iter')
            self.test = self.test.batch(self.batch_size_tensor).prefetch(tf.maximum(self.test_count_tensor, tf.constant(1, tf.int64))).cache().repeat(tf.add(self.epochs_tensor, tf.constant(1, tf.int64)))
            self.train = self.train.batch(self.batch_size_tensor).prefetch(tf.maximum(self.train_count_tensor, tf.constant(1, tf.int64))).cache().repeat(self.epochs_tensor)
            self.test_iter = self.test.make_initializable_iterator()
            self.train_iter = self.train.make_initializable_iterator()

    def __get_line_count(file):

        count = 0
        with open(file) as f:
            i = 0
            while True:
                line = f.readline()
                if not line:
                    break
                if i > 0 and len(line) > 0:
                    count = count + 1
                i = i + 1

        return count


def dump_step_data(name, x, y, epoch, i):
    print(np.shape(x))
    print(np.shape(y))
    x = np.reshape(x, [np.shape(x)[0], np.shape(x)[1]])
    with open('%s_%i_%i.csv' % (name, epoch, i), 'w') as text_file:
        text_file.write('decision;')
        text_file.write(';'.join(str(i) for i in range(-1814, 1)))
        text_file.write('\n')
        for row_index, row in enumerate(x):
            text_file.write('buy' if y[row_index][1] == 1 else 'ignore')
            text_file.write(';')
            text_file.write(';'.join(str(i) for i in row))
            text_file.write('\n')


def run(name, sess, model, data, epoch, optimizer, batches, feed_dict, summary, summary_writer):
    accuracies = []
    durations = []
    last_log = datetime.datetime.now()
    last_step = datetime.datetime.now()

    for i in range(batches):

        if i == 0 or i == batches - 1 or (datetime.datetime.now() - last_log).total_seconds() > 1:
            last_log = datetime.datetime.now()
            seconds_per_batch = np.mean(durations) if len(durations) > 0 else 0
            seconds_per_row = seconds_per_batch / data.batch_size
            rows_per_second = (1 / seconds_per_row) if seconds_per_row > 0 else 0
            remaining_epoch = seconds_per_batch * (batches - i)
            accuracy = accuracies[len(accuracies)-1] if len(accuracies) > 0 else 0
            print("%s %d/%d # %.2f rows/s # %s remaining # previous accuracy %.4f" % (
                name, i + 1, batches, rows_per_second, datetime.timedelta(seconds=int(remaining_epoch)), accuracy))

        with tf.name_scope(name):

            # x, y = sess.run(data.train_iter)
            # dump_step_data(name, x, y, epoch, i, data.train_batches)

            if optimizer is not None:
                _, acc, sum = sess.run([optimizer, model.accuracy, summary], feed_dict=feed_dict)
            else:
                acc, sum = sess.run([model.accuracy, summary], feed_dict=feed_dict)

            summary_writer.add_summary(sum, 0 if epoch == -1 else (epoch * batches + i + 1))
            summary_writer.flush()
            accuracies.append(acc)

        durations.append((datetime.datetime.now() - last_step).total_seconds())
        last_step = datetime.datetime.now()

        if len(durations) > 10:
            durations.pop(0)

    accuracy = np.mean(accuracies)
    return accuracy


def train(data, sess, model, optimizer, summary, summary_writer, epoch):
    feed_dict = { model.is_train: True, model.fc_dropout_keep: 0.8, model.residual_scale: 0.1 }
    #feed_dict = { model.is_train: True, model.fc_dropout_keep: 0.4, model.aux_fc_dropout_keep: 0.3, model.aux_exit_4a_weight: 0.3, model.aux_exit_4e_weight: 0.3, model.exit_weight: 1.0 }
    return run('Train', sess, model, data, epoch, optimizer, data.train_batches, feed_dict, summary, summary_writer)


def measure_accuracy(data, sess, model, summary, summary_writer, epoch):
    feed_dict = { model.is_train: False, model.fc_dropout_keep: 1.0, model.residual_scale: 0.1 }
    #feed_dict = { model.is_train: False, model.fc_dropout_keep: 1.0, model.aux_fc_dropout_keep: 1, model.aux_exit_4a_weight: 0.3, model.aux_exit_4e_weight: 0.3, model.exit_weight: 1.0 }
    return run('Test', sess, model, data, epoch, None, data.test_batches, feed_dict, summary, summary_writer)


def predict(sess, model, output_file):
    feed_dict = {model.fc_dropout_keep: 1.0, model.residual_scale: 0.1, model.is_train: False}
    with tf.name_scope('prediction'):
        prediction = sess.run(model.pred, feed_dict=feed_dict)

    with open(output_file, 'w') as text_file:
        text_file.write('id;label\n')
        for i in range(len(prediction)):
            text_file.write('%d;%d\n' % (i, prediction[i]))

    with open(output_file) as f:
        print("Output prediction: {0}".format(f.read()))


def main(model_dir, load_ckpt, epochs, start_epoch, batch_size, test_file, train_file, first_day, last_day, buy_label):
    """
    :param str model_dir: Base directory for the model
    :param int load_ckpt: Whether to load an existing model
    :param int epochs: Number of cycles over the whole data
    :param int start_epoch: Start index in epochs
    :param int batch_size: Number of examples per batch
    :param str test_file: Path to the test data
    :param str train_file: Path to the train data
    :param int first_day: The first day column name e.g. -1814
    :param int last_day: The last day column name e.g. 0
    :param str buy_label: The label used if the user decided on an action for this dataset, e.g. 'buy'
    """

    if load_ckpt:
        if not os.path.exists(model_dir):
            load_ckpt = False

    if not load_ckpt:
        model_dir = model_dir + datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        if os.path.exists(model_dir):
            shutil.rmtree(model_dir, ignore_errors=True)
        if not os.path.exists(model_dir):
            os.makedirs(model_dir)

    ckpt_file = model_dir + '\\checkpoint\\'
    output_file = model_dir + '\\prediction.txt'
    log_dir = model_dir + '\\logs\\'

    if not os.path.exists(ckpt_file):
        os.makedirs(ckpt_file)
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)

    i = 0
    while os.path.exists(log_dir + str(i)):
        i += 1
    log_dir = log_dir + str(i)

    def write_resume_bat(next_epoch):
        with open(model_dir + '\\resume.bat', 'w') as text_file:
            text_file.write(
                'python main.py --load=True --model_dir=. --test_file=test.csv --train_file=train.csv --start_epoch=%s\npause' % next_epoch)

    if not load_ckpt:
        print('Copying data to model dir')
        copyfile('main.py', model_dir + '\\main.py')
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

    if load_ckpt:
        last_checkpoint_index = -1
        for filename in glob.iglob(ckpt_file + "*.meta", recursive=False):
            search = re.search('[^\d]+(\d+).meta$', filename, re.IGNORECASE)
            if search:
                last_checkpoint_index = max(last_checkpoint_index, int(search.group(1)))
        if last_checkpoint_index >= 0:
            load_ckpt_file = ckpt_file + str(last_checkpoint_index)
        else:
            if os.path.exists(ckpt_file + "initial.meta"):
                load_ckpt_file = ckpt_file + 'initial'
            else:
                raise Exception('checkpoint not found')

    column_defaults = [['0'], ['0'], ['19700101'], ['ignore']] + [[0.00] for i in range(first_day, last_day + 1)]

    tf.logging.set_verbosity(tf.logging.INFO)

    print('Loading data')
    data = Snapshots(test_file, train_file, batch_size, column_defaults, buy_label)

    print('Model')
    #model = GoogLeNet(1, data.train_iter, data.test_iter)
    model = InceptionResNetV2(1, data.train_iter, data.test_iter)

    print('Optimizer')
    with tf.name_scope('adam'):  
        update_ops = tf.get_collection(tf.GraphKeys.UPDATE_OPS)
        with tf.control_dependencies(update_ops):
            optimizer = tf.train.AdamOptimizer(learning_rate=0.0001, epsilon=0.1).minimize(model.loss)

    print('Saver')
    saver = tf.train.Saver(tf.trainable_variables())

    Popen('tensorboard.exe --logdir=%s' % model_dir, shell=True,
          stdin=None, stdout=None, stderr=None, close_fds=True)

    config = tf.ConfigProto()
    config.gpu_options.allow_growth = True
    config.gpu_options.per_process_gpu_memory_fraction = 0.9
    with tf.Session(config=config) as sess:

        print('Init')
        tf.global_variables_initializer().run()

        if load_ckpt:
            print('Restoring parameters from %s' % (load_ckpt_file))
            saver.restore(sess, load_ckpt_file)

        sess.run([data.test_iter.initializer, data.train_iter.initializer], feed_dict={
            data.epochs_tensor: epochs, data.batch_size_tensor: data.batch_size,
            data.test_count_tensor: data.test_count, data.train_count_tensor: data.train_count})

        if epochs > 0:

            print('Summary writer')
            merged = tf.summary.merge_all()

            if not load_ckpt:
                print('Save model')
                saver.save(sess, ckpt_file + "initial")

            for epoch in range(start_epoch, epochs):
                begin = time.time()

                train_writer = tf.summary.FileWriter(log_dir + '/train', sess.graph)
                test_writer = tf.summary.FileWriter(log_dir + '/test')

                train_acc_mean = train(data, sess, model, optimizer, merged, train_writer, epoch)

                val_acc_mean = measure_accuracy(data, sess, model, merged, test_writer, epoch)

                print("Epoch %d/%d, time = %ds, train accuracy = %.4f, validation accuracy = %.4f" % (
                    epoch + 1, epochs, time.time() - begin, train_acc_mean, val_acc_mean))

                print('Save model')
                saver.save(sess, ckpt_file + str(epoch))

                sys.stdout.flush()

                write_resume_bat(epoch + 1)

        print('Predict')
        predict(sess, model, output_file)


if __name__ == '__main__':
    tf.logging.set_verbosity(tf.logging.INFO)
    FLAGS, unparsed = parser.parse_known_args()

    main(model_dir=FLAGS.model_dir,
         load_ckpt=FLAGS.load,
         epochs=FLAGS.epochs,
         start_epoch=FLAGS.start_epoch,
         batch_size=FLAGS.batch_size,
         test_file=FLAGS.test_file,
         train_file=FLAGS.train_file,
         first_day=FLAGS.first_day,
         last_day=FLAGS.last_day,
         buy_label=FLAGS.buy_label)
