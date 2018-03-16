from __future__ import absolute_import
from __future__ import division
from __future__ import print_function

import os
import argparse
import sys
import math
import time
import csv
import shutil
import datetime
from shutil import copyfile

# os.environ["CUDA_VISIBLE_DEVICES"]="-1"

import numpy as np
import tensorflow as tf

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
    '--test_file', type=str, default='..\\StockFlow\\bin\\Debug\\test_buying.csv',
    help='Path to the test data.')

parser.add_argument(
    '--train_file', type=str, default='..\\StockFlow\\bin\\Debug\\train_buying.csv',
    help='Path to the train data.')

parser.add_argument(
    '--first_day', type=int, default=-1814,
    help='The first day column name e.g. -1814.')

parser.add_argument(
    '--last_day', type=int, default=0,
    help='The last day column name e.g. 0.')

parser.add_argument(
    '--buy_label', type=str, default='buy',
    help='The label used if the user decided on an action for this dataset, e.g. buy')


class Snapshots(object):
    def __init__(self, test_file, train_file, batch_size, column_defaults, buy_label):
        self.batch_size = batch_size

        self.epochs_tensor = tf.placeholder(tf.int64, name='epochs')
        self.batch_size_tensor = tf.placeholder(tf.int64, name='batch_size')
        self.test_count_tensor = tf.placeholder(tf.int64, name='test_count')
        self.train_count_tensor = tf.placeholder(tf.int64, name='train_count')

        assert tf.gfile.Exists(test_file), ('%s not found.' % test_file)
        assert tf.gfile.Exists(train_file), ('%s not found.' % train_file)

        test_file_count = Snapshots.__get_line_count(test_file)
        train_file_count = Snapshots.__get_line_count(train_file)

        if test_file_count < self.batch_size:
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

        print('repeat/batch/iter/next')
        self.test = self.test.repeat(tf.add(self.epochs_tensor, tf.constant(2, tf.int64))).batch(self.batch_size_tensor)
        self.train = self.train.repeat(self.epochs_tensor).batch(self.batch_size_tensor)
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


class Model(object):
    def __init__(self, summary_level, train_iter, test_iter):
        self.summary_level = summary_level
        self.aux_fc_dropout_keep = tf.placeholder(tf.float32)
        self.fc_dropout_keep = tf.placeholder(tf.float32)
        self.is_train = tf.placeholder(tf.bool)

        def get_train_data():
            return train_iter.get_next()

        def get_test_data():
            return test_iter.get_next()

        x, y = tf.cond(tf.equal(self.is_train, True), lambda: get_train_data(), lambda: get_test_data())

        # days = tf.shape(x)[1]
        # o = tf.one_hot(indices=tf.cast(tf.multiply(tf.reshape(x,[tf.shape(x)[0],days]),100), tf.int32), depth=100, on_value=1.0, off_value=0.0, axis=-1)
        # self.__image_summary('x', o, days, 100, 1)

        # https://hacktilldawn.com/2016/09/25/inception-modules-explained-and-implemented/
        # https://www.cc.gatech.edu/~hic/CS7616/Papers/Szegedy-et-al-2014.pdf

        conv1 = self.__conv_layer('conv1', x, 7, 2, 64, True)
        conv1_pool = self.__max_pool_layer('conv1_pool', conv1, 3, 2)

        conv2_reduce = self.__conv_layer('conv2_reduce', conv1_pool, 1, 1, 64, True, 'VALID')
        conv2 = self.__conv_layer('conv2', conv2_reduce, 3, 1, 192, True)
        conv2_pool = self.__max_pool_layer('conv2_pool', conv2, 3, 2)

        inception3a = self.__inception_module('inception3a', conv2_pool, 64, 96, 128, 16, 32, 32)
        inception3b = self.__inception_module('inception3b', inception3a, 128, 128, 192, 32, 96, 64)
        inception3p = self.__max_pool_layer('inception3_pool', inception3b, 3, 2)

        inception4a = self.__inception_module('inception4a', inception3p, 192, 96, 208, 16, 48, 64)
        inception4b = self.__inception_module('inception4b', inception4a, 160, 112, 224, 24, 64, 64)
        inception4c = self.__inception_module('inception4c', inception4b, 128, 128, 256, 24, 64, 64)
        inception4d = self.__inception_module('inception4d', inception4c, 112, 144, 288, 32, 64, 64)
        inception4e = self.__inception_module('inception4e', inception4d, 256, 160, 320, 32, 128, 128)
        inception4p = self.__max_pool_layer('inception4_pool', inception4e, 3, 2)

        inception4a_avg = self.__avg_pool_layer('inception4a_avg', inception4a, 5, 3)
        inception4a_reduce = self.__conv_layer('inception4a_reduce', inception4a_avg, 1, 1, 128, True)
        inception4a_exit = self.__exit_layer('exit_4a', inception4a_reduce, self.aux_fc_dropout_keep)

        inception4e_avg = self.__avg_pool_layer('inception4a_avg', inception4e, 5, 3)
        inception4e_reduce = self.__conv_layer('inception4a_reduce', inception4e_avg, 1, 1, 128, True)
        inception4e_exit = self.__exit_layer('exit_4e', inception4e_reduce, self.aux_fc_dropout_keep)

        inception5a = self.__inception_module('inception5a', inception4p, 256, 160, 320, 32, 128, 128)
        inception5b = self.__inception_module('inception5b', inception5a, 384, 192, 384, 48, 128, 128)
        inception5p = self.__avg_pool_layer('inception5_pool', inception5b, 7, 1)

        exit = self.__exit_layer('exit', inception5p, self.fc_dropout_keep)

        aux_scale = tf.constant(0.3, tf.float32)
        logits = tf.add(tf.add(tf.scalar_mul(aux_scale, inception4a_exit), tf.scalar_mul(aux_scale, inception4e_exit)),
                        exit)

        with tf.variable_scope('loss'):

            y_sg = tf.stop_gradient(y)

            softmax = tf.nn.softmax_cross_entropy_with_logits_v2(labels=y_sg, logits=logits)
            self.loss = tf.reduce_mean(softmax)
            if self.summary_level >= 1:
                tf.summary.scalar('loss_combined', self.loss)

            if self.summary_level >= 1:
                softmax_exit = tf.nn.softmax_cross_entropy_with_logits_v2(labels=y_sg, logits=exit)
                loss_exit = tf.reduce_mean(softmax_exit)
                tf.summary.scalar('loss_exit', loss_exit)

                softmax_inception4a_exit = tf.nn.softmax_cross_entropy_with_logits_v2(labels=y_sg,
                                                                                      logits=inception4a_exit)
                loss_inception4a_exit = tf.reduce_mean(softmax_inception4a_exit)
                tf.summary.scalar('loss_inception4a_exit', loss_inception4a_exit)

                softmax_inception4a_exit = tf.nn.softmax_cross_entropy_with_logits_v2(labels=y_sg,
                                                                                      logits=inception4e_exit)
                loss_inception4e_exit = tf.reduce_mean(softmax_inception4a_exit)
                tf.summary.scalar('loss_inception4e_exit', loss_inception4e_exit)

        with tf.variable_scope('accuracy'):
            self.correct_prediction = tf.equal(tf.argmax(exit, 1), tf.argmax(y, 1))
            self.accuracy = tf.reduce_mean(tf.cast(self.correct_prediction, tf.float32))
            if self.summary_level >= 1:
                tf.summary.scalar('accuracy_exit', self.accuracy)

            if self.summary_level >= 1:
                correct_prediction_inception4a_exit = tf.equal(tf.argmax(inception4a_exit, 1), tf.argmax(y, 1))
                accuracy_inception4a_exit = tf.reduce_mean(tf.cast(correct_prediction_inception4a_exit, tf.float32))
                tf.summary.scalar('accuracy_inception4a_exit', accuracy_inception4a_exit)

                correct_prediction_inception4e_exit = tf.equal(tf.argmax(inception4e_exit, 1), tf.argmax(y, 1))
                accuracy_inception4e_exit = tf.reduce_mean(tf.cast(correct_prediction_inception4e_exit, tf.float32))
                tf.summary.scalar('accuracy_inception4e_exit', accuracy_inception4e_exit)

                correct_prediction_combined = tf.equal(tf.argmax(logits, 1), tf.argmax(y, 1))
                accuracy_combined = tf.reduce_mean(tf.cast(correct_prediction_combined, tf.float32))
                tf.summary.scalar('accuracy_combined', accuracy_combined)

        with tf.variable_scope('pred'):
            self.pred = tf.argmax(exit, 1)

    def __exit_layer(self, name, x, dropout_keep):

        fc1 = self.__full_layer(name + '_fc1', x, 1024, True)

        with tf.variable_scope(name + '_fc1_drop'):
            fc1_drop = tf.nn.dropout(fc1, dropout_keep)
            if self.summary_level >= 2:
                tf.summary.histogram(name + '_fc1_drop', fc1_drop)

        fc2 = self.__full_layer(name + '_fc2', fc1_drop, 2, False)

        return fc2

    def __inception_module(self, name, x, out_1x1, reduce3, out_3x1, reduce5, out_5x1, out_pool):
        with tf.variable_scope(name):
            conv_reduce3 = self.__conv_layer(name + '_conv_reduce_3x1', x, 1, 1, reduce3, True)
            conv_reduce5 = self.__conv_layer(name + '_conv_reduce_5x1', x, 1, 1, reduce5, True)

            conv_1x1 = self.__conv_layer(name + '_conv_1x1', x, 1, 1, out_1x1, False)
            conv_3x1 = self.__conv_layer(name + '_conv_3x1', conv_reduce3, 3, 1, out_3x1, False)
            conv_5x1 = self.__conv_layer(name + '_conv_5x1', conv_reduce5, 5, 1, out_5x1, False)

            maxpool = self.__max_pool_layer(name + '_pool', x, 3, 1)
            conv_pool_reduce = self.__conv_layer(name + '_conv_pool_reduce', maxpool, 1, 1, out_pool, False)

            return tf.nn.relu(tf.concat(axis=3, values=[conv_1x1, conv_3x1, conv_5x1, conv_pool_reduce]))

    def __conv_layer(self, name, in_layer, width, stride, out_dim, relu, padding='SAME'):
        with tf.variable_scope(name):
            in_layer_shape = int(in_layer.get_shape()[3])

            W = tf.Variable(tf.truncated_normal([width, 1, in_layer_shape, out_dim], stddev=0.1), name=name + '_W')
            self.__variable_summaries(name + '_W', W)
            # __image_summary(name + '_W', W, 5, 1 out_dim)

            b = tf.Variable(tf.constant(0.1, shape=[out_dim]), name=name + '_b')
            self.__variable_summaries(name, b)

            r = tf.nn.conv2d(in_layer, W, strides=[1, stride, 1, 1], padding=padding, name=name) + b
            if self.summary_level >= 2:
                tf.summary.histogram(name + '_r', r)

            if relu:
                r = tf.nn.relu(r)
                if self.summary_level >= 2:
                    tf.summary.histogram(name + '_relu', r)

            return r

    def __full_layer(self, name, in_layer, out_dim, relu):
        with tf.variable_scope(name):
            in_layer_shape = int(np.prod(in_layer.get_shape()[1:]))

            initializer = tf.truncated_normal_initializer(dtype=tf.float32, stddev=1e-1)
            W = tf.get_variable("weights", [in_layer_shape, out_dim], initializer=initializer, dtype=tf.float32)
            self.__variable_summaries(name + '_W', W)

            initializer = tf.constant_initializer(0.0)
            b = tf.get_variable("biases", [out_dim], initializer=initializer, dtype=tf.float32)
            self.__variable_summaries(name + '_b', b)

            in_layer_flat = tf.reshape(in_layer, [-1, in_layer_shape])

            r = tf.matmul(in_layer_flat, W) + b
            if self.summary_level >= 2:
                tf.summary.histogram(name + '_r', r)

            if relu:
                r = tf.nn.relu(r)
                if self.summary_level >= 2:
                    tf.summary.histogram(name + '_relu', r)

            return r

    def __max_pool_layer(self, name, x, width, stride):
        with tf.variable_scope(name):
            pool = tf.nn.max_pool(x, ksize=[1, width, 1, 1], strides=[1, stride, 1, 1], padding='SAME', name=name)
            if self.summary_level >= 2:
                tf.summary.histogram(name, pool)
            return pool

    def __avg_pool_layer(self, name, x, width, stride):
        with tf.variable_scope(name):
            pool = tf.nn.avg_pool(x, ksize=[1, width, 1, 1], strides=[1, stride, 1, 1], padding='SAME', name=name)
            if self.summary_level >= 2:
                tf.summary.histogram(name, pool)
            return pool

    def __variable_summaries(self, name, var):
        if self.summary_level >= 2:
            with tf.name_scope(name):
                mean = tf.reduce_mean(var)
                tf.summary.scalar('mean', mean)
                with tf.name_scope('stddev'):
                    stddev = tf.sqrt(tf.reduce_mean(tf.square(var - mean)))
                tf.summary.scalar('stddev', stddev)
                tf.summary.scalar('max', tf.reduce_max(var))
                tf.summary.scalar('min', tf.reduce_min(var))
                tf.summary.histogram('histogram', var)

    def __image_summary(self, name, V, width, height, dimensions):
        V = tf.reshape(V, (tf.shape(V)[0], width, height, dimensions))
        V = tf.transpose(V, (0, 2, 1, 3))
        tf.summary.image(name, V, max_outputs=tf.shape(V)[0])


def dump_step_data(name, x, y, epoch, i, batches):
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


def run(name, sess, model, data, epoch, epochs, optimizer, batches, aux_fc_dropout_keep, fc_dropout_keep, summary,
        summary_writer):
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
            if optimizer is not None:
                remaining_epoch = seconds_per_batch * (batches - i)
                remaining_total = remaining_epoch + seconds_per_batch * batches * (epochs - epoch - 1)
                print("%s %d/%d # %.2f rows/s # %s remaining in epoch # %s remaining in training" % (
                    name, i + 1, batches, rows_per_second, datetime.timedelta(seconds=remaining_epoch),
                    datetime.timedelta(seconds=remaining_total)))
            else:
                print("%s %d/%d avg=%.2frows/s" % (name, i + 1, batches, rows_per_second))

        with tf.name_scope(name):

            # x, y = sess.run(data.train_iter)
            # dump_step_data(name, x, y, epoch, i, data.train_batches)

            feed_dict = {model.aux_fc_dropout_keep: aux_fc_dropout_keep, model.fc_dropout_keep: fc_dropout_keep,
                         model.is_train: optimizer is not None}

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


def train(data, sess, model, optimizer, summary, summary_writer, epoch, epochs):
    return run('Train', sess, model, data, epoch, epochs, optimizer, data.train_batches, 0.3, 0.4, summary,
               summary_writer)


def measure_accuracy(data, sess, model, summary, summary_writer, epoch, epochs):
    return run('Test', sess, model, data, epoch, epochs, None, data.test_batches, 1, 1, summary, summary_writer)


def predict(sess, model, output_file):
    feed_dict = {model.aux_fc_dropout_keep: 1.0, model.fc_dropout_keep: 1.0, model.is_train: False}
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

    ckpt_file = model_dir + '\\model.ckpt'
    output_file = model_dir + '\\prediction.txt'
    log_dir = model_dir + '\\log'

    def write_resume_bat(next_epoch):
        with open(model_dir + '\\resume.bat', 'w') as text_file:
            text_file.write(
                'python main.py --load=True --model_dir=. --test_file=test.csv --train_file=train.csv --start_epoch=%s\npause' % next_epoch)

    if not load_ckpt:
        print('Copying data to model dir')
        copyfile('StockFlow.Python.py', model_dir + '\\main.py')
        copyfile(test_file, model_dir + '\\test.csv')
        copyfile(train_file, model_dir + '\\train.csv')
        write_resume_bat(0)
        with open(model_dir + '\\tensorboard.bat', 'w') as text_file:
            text_file.write('tensorboard.exe --logdir=.')

    test_file = model_dir + '\\test.csv'
    train_file = model_dir + '\\train.csv'

    column_defaults = [['0'], ['0'], ['19700101'], ['ignore']] + [[0.00] for i in range(first_day, last_day + 1)]

    tf.logging.set_verbosity(tf.logging.INFO)

    print('Loading data')
    data = Snapshots(test_file, train_file, batch_size, column_defaults, buy_label)

    print('Model')
    model = Model(1, data.train_iter, data.test_iter)

    print('Optimizer')
    with tf.name_scope('adam'):
        optimizer = tf.train.AdamOptimizer().minimize(model.loss)

    print('Saver')
    saver = tf.train.Saver(tf.trainable_variables())

    config = tf.ConfigProto()
    config.gpu_options.allow_growth = True
    config.gpu_options.per_process_gpu_memory_fraction = 0.9
    with tf.Session(config=config) as sess:

        print('Init')
        tf.global_variables_initializer().run()

        if load_ckpt:
            print('Restoring parameters from', ckpt_file)
            saver.restore(sess, ckpt_file)

        sess.run([data.test_iter.initializer, data.train_iter.initializer], feed_dict={
            data.epochs_tensor: epochs, data.batch_size_tensor: data.batch_size,
            data.test_count_tensor: data.test_count, data.train_count_tensor: data.train_count})

        if epochs > 0:

            print('Summary writer')
            merged = tf.summary.merge_all()
            train_writer = tf.summary.FileWriter(log_dir + '/train', sess.graph)
            test_writer = tf.summary.FileWriter(log_dir + '/test')

            saver.save(sess, ckpt_file)

            val_acc_mean = measure_accuracy(data, sess, model, merged, test_writer, 0, epochs)
            print("initial validation accuracy = %.4f" % val_acc_mean)

            for epoch in range(start_epoch, epochs):
                begin = time.time()

                train_acc_mean = train(data, sess, model, optimizer, merged, train_writer, epoch, epochs)

                val_acc_mean = measure_accuracy(data, sess, model, merged, test_writer, epoch + 1, epochs)

                print("Epoch %d/%d, time = %ds, train accuracy = %.4f, validation accuracy = %.4f" % (
                    epoch + 1, epochs, time.time() - begin, train_acc_mean, val_acc_mean))

                saver.save(sess, ckpt_file)

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
