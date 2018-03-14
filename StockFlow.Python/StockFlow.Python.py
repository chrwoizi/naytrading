from __future__ import absolute_import
from __future__ import division
from __future__ import print_function

import argparse
import sys
import math
import time
import csv
import shutil

import numpy as np
import tensorflow as tf


parser = argparse.ArgumentParser()

parser.add_argument(
    '--model_dir', type = str, default = 'model',
    help = 'Base directory for the model.')

parser.add_argument(
    '--load', type = bool, default = False, help = 'Whether to load an existing model.')

parser.add_argument(
    '--epochs', type = int, default = 1000, help = 'Number of cycles over the whole data.')

parser.add_argument(
    '--batch_size', type = int, default = 32, help = 'Number of examples per batch.')

parser.add_argument(
    '--buy_file', type = str, default = '..\\StockFlow\\bin\\Debug\\buy.csv',
    help = 'Path to the buy data.')

parser.add_argument(
    '--nobuy_file', type = str, default = '..\\StockFlow\\bin\\Debug\\nobuy.csv',
    help = 'Path to the nobuy data.')

parser.add_argument(
    '--buy_count', type = int, default = 171,
    help = 'Number of rows in buy_file.')

parser.add_argument(
    '--nobuy_count', type = int, default = 1194,
    help = 'Number of rows in nobuy_file.')

parser.add_argument(
    '--test_data_ratio', type = float, default = 0.25,
    help = 'The ratio between test and train data sets taken from the train_data file randomly.')

parser.add_argument(
    '--first_day', type = int, default = -1814,
    help = 'The first day column name e.g. -1814.')

parser.add_argument(
    '--last_day', type = int, default = 0,
    help = 'The last day column name e.g. 0.')

parser.add_argument(
    '--buy_label', type = str, default = 'buy',
    help = 'The label used if the user decided on an action for this dataset, e.g. buy')


class Snapshots(object):
    def __init__(self, buy_file, nobuy_file, buy_count, nobuy_count, first_day, last_day, batch_size, epochs, test_data_ratio, column_names,
                 column_defaults, buy_label):
        self.days = last_day - first_day + 1
        self.batch_size = batch_size

        assert tf.gfile.Exists(buy_file), ('%s not found.' % buy_file)
        assert tf.gfile.Exists(nobuy_file), ('%s not found.' % nobuy_file)

        def parse_csv(value):
            columns = tf.decode_csv(value, record_defaults = column_defaults, field_delim = ";")
            features = dict(zip(column_names, columns))
            features.pop('id')
            features.pop('instrument')
            features.pop('time')
            labels = features.pop('decision')
            labels = tf.cast(tf.equal(labels, buy_label), dtype = tf.float32)
            return features, labels

        print('TextLineDataset')
        buy_dataset = tf.data.TextLineDataset(buy_file).skip(1)
        nobuy_dataset = tf.data.TextLineDataset(nobuy_file).skip(1)

        print('map')
        buy_dataset = buy_dataset.map(parse_csv, num_parallel_calls = 5)
        nobuy_dataset = nobuy_dataset.map(parse_csv, num_parallel_calls = 5)

        print('shuffle')
        buy_dataset = buy_dataset.shuffle(buy_count, seed = 42)
        nobuy_dataset = nobuy_dataset.shuffle(nobuy_count, seed = 42)

        print('count')
        buy_test_count = int(test_data_ratio * buy_count)
        nobuy_test_count = int(test_data_ratio * nobuy_count)
        buy_train_count = buy_count - buy_test_count
        nobuy_train_count = nobuy_count - nobuy_test_count

        self.test_count = buy_test_count + nobuy_test_count
        self.train_count = buy_train_count + nobuy_train_count

        self.test_batches = int(math.floor(self.test_count / batch_size))
        self.train_batches = int(math.floor(self.train_count / batch_size))

        print('take/skip')
        self.train = buy_dataset.take(buy_train_count).concatenate(nobuy_dataset.take(nobuy_train_count))
        self.test = buy_dataset.skip(buy_train_count).concatenate(nobuy_dataset.skip(nobuy_train_count))

        print('take batches')
        self.train = self.train.take(self.train_batches * batch_size)
        self.test = self.test.take(self.test_batches * batch_size)

        print('shuffle')
        self.train = self.train.shuffle(self.train_count, seed = 42)
        self.test = self.test.shuffle(self.test_count, seed = 42)

        print('take/batch/repeat/iter/next')
        self.__train_iter = self.train.repeat(epochs).batch(batch_size).make_one_shot_iterator().get_next()
        self.__test_iter = self.test.repeat(epochs + 1).batch(batch_size).make_one_shot_iterator().get_next()

    def next_train_batch(self, sess):
        return self.__next_batch(sess, self.__train_iter)

    def next_test_batch(self, sess):
        return self.__next_batch(sess, self.__test_iter)

    def __next_batch(self, sess, iter):
        x, y = sess.run(iter)
        x_list = np.transpose(np.asarray(list(x.values())))
        X = tf.reshape(x_list, [self.batch_size, self.days, 1, 1]).eval(session = sess)
        Y = np.asarray(list(map(lambda x: np.array([x, 1 - x]), y)))
        return X, Y


class Model(object):
    def __init__(self, batch_size, days):
        self.x = tf.placeholder(tf.float32, shape = [batch_size, days, 1, 1])
        self.y = tf.placeholder(tf.float32, shape = [batch_size, 2])
        self.aux_fc_dropout_keep = tf.placeholder(tf.float32)
        self.fc_dropout_keep = tf.placeholder(tf.float32)

        # https://hacktilldawn.com/2016/09/25/inception-modules-explained-and-implemented/
        # https://www.cc.gatech.edu/~hic/CS7616/Papers/Szegedy-et-al-2014.pdf

        conv1 = Model.__conv_layer('conv1', self.x, 7, 2, 64, True)
        conv1_pool = Model.__max_pool_layer('conv1_pool', conv1, 3, 2)

        conv2_reduce = Model.__conv_layer('conv2_reduce', conv1_pool, 1, 1, 64, True, 'VALID')
        conv2 = Model.__conv_layer('conv2', conv2_reduce, 3, 1, 192, True)
        conv2_pool = Model.__max_pool_layer('conv2_pool', conv2, 3, 2)

        inception3a = Model.__inception_module('inception3a', conv2_pool, 64, 96, 128, 16, 32, 32)
        inception3b = Model.__inception_module('inception3b', inception3a, 128, 128, 192, 32, 96, 64)
        inception3p = Model.__max_pool_layer('inception3_pool', inception3b, 3, 2)

        inception4a = Model.__inception_module('inception4a', inception3p, 192, 96, 208, 16, 48, 64)
        inception4b = Model.__inception_module('inception4b', inception4a, 160, 112, 224, 24, 64, 64)
        inception4c = Model.__inception_module('inception4c', inception4b, 128, 128, 256, 24, 64, 64)
        inception4d = Model.__inception_module('inception4d', inception4c, 112, 144, 288, 32, 64, 64)
        inception4e = Model.__inception_module('inception4e', inception4d, 256, 160, 320, 32, 128, 128)
        inception4p = Model.__max_pool_layer('inception4_pool', inception4e, 3, 2)

        inception4a_avg = Model.__avg_pool_layer('inception4a_avg', inception4a, 5, 3)
        inception4a_reduce = Model.__conv_layer('inception4a_reduce', inception4a_avg, 1, 1, 128, True)
        inception4a_exit = Model.__exit_layer('exit_4a', inception4a_reduce, self.aux_fc_dropout_keep)

        inception4e_avg = Model.__avg_pool_layer('inception4a_avg', inception4e, 5, 3)
        inception4e_reduce = Model.__conv_layer('inception4a_reduce', inception4e_avg, 1, 1, 128, True)
        inception4e_exit = Model.__exit_layer('exit_4e', inception4e_reduce, self.aux_fc_dropout_keep)

        inception5a = Model.__inception_module('inception5a', inception4p, 256, 160, 320, 32, 128, 128)
        inception5b = Model.__inception_module('inception5b', inception5a, 384, 192, 384, 48, 128, 128)
        inception5p = Model.__avg_pool_layer('inception5_pool', inception5b, 7, 1)

        exit = Model.__exit_layer('exit', inception5p, self.fc_dropout_keep)

        with tf.variable_scope('loss'):

            y_sg = tf.stop_gradient(self.y)

            aux_scale = tf.constant([[0.3,0.3]] * batch_size)
            logits = tf.add(tf.add(tf.multiply(inception4a_exit, aux_scale), tf.multiply(inception4e_exit, aux_scale)), exit)

            softmax = tf.nn.softmax_cross_entropy_with_logits_v2(labels = y_sg, logits = logits)
            self.loss = tf.reduce_mean(softmax)
            tf.summary.scalar('loss_combined', self.loss)

            softmax_exit = tf.nn.softmax_cross_entropy_with_logits_v2(labels = y_sg, logits = exit)
            loss_exit = tf.reduce_mean(softmax_exit)
            tf.summary.scalar('loss_exit', loss_exit)

            softmax_inception4a_exit = tf.nn.softmax_cross_entropy_with_logits_v2(labels = y_sg, logits = inception4a_exit)
            loss_inception4a_exit = tf.reduce_mean(softmax_inception4a_exit)
            tf.summary.scalar('loss_inception4a_exit', loss_inception4a_exit)

            softmax_inception4a_exit = tf.nn.softmax_cross_entropy_with_logits_v2(labels = y_sg, logits = inception4e_exit)
            loss_inception4e_exit = tf.reduce_mean(softmax_inception4a_exit)
            tf.summary.scalar('loss_inception4e_exit', loss_inception4e_exit)

        with tf.variable_scope('accuracy'):
            self.correct_prediction = tf.equal(tf.argmax(exit, 1), tf.argmax(self.y, 1))
            self.accuracy = tf.reduce_mean(tf.cast(self.correct_prediction, tf.float32))
            tf.summary.scalar('accuracy', self.accuracy)

        with tf.variable_scope('pred'):
            self.pred = tf.argmax(exit, 1)

    def __exit_layer(name, x, dropout_keep):

        fc1 = Model.__full_layer(name + '_fc1', x, 1024, True)

        with tf.variable_scope(name + '_fc1_drop'):
            fc1_drop = tf.nn.dropout(fc1, dropout_keep)
            tf.summary.histogram(name + '_fc1_drop', fc1_drop)

        fc2 = Model.__full_layer(name + '_fc2', fc1_drop, 2, False)

        return fc2

    def __inception_module(name, x, out_1x1, reduce3, out_3x1, reduce5, out_5x1, out_pool):
        with tf.variable_scope(name):
            conv_reduce3 = Model.__conv_layer(name + '_conv_reduce_3x1', x, 1, 1, reduce3, True)
            conv_reduce5 = Model.__conv_layer(name + '_conv_reduce_5x1', x, 1, 1, reduce5, True)

            conv_1x1 = Model.__conv_layer(name + '_conv_1x1', x, 1, 1, out_1x1, False)
            conv_3x1 = Model.__conv_layer(name + '_conv_3x1', conv_reduce3, 3, 1, out_3x1, False)
            conv_5x1 = Model.__conv_layer(name + '_conv_5x1', conv_reduce5, 5, 1, out_5x1, False)

            maxpool = Model.__max_pool_layer(name + '_pool', x, 3, 1)
            conv_pool_reduce = Model.__conv_layer(name + '_conv_pool_reduce', maxpool, 1, 1, out_pool, False)

            return tf.nn.relu(tf.concat(axis = 3, values = [conv_1x1, conv_3x1, conv_5x1, conv_pool_reduce]))

    def __conv_layer(name, in_layer, width, stride, out_dim, relu, padding = 'SAME'):
        with tf.variable_scope(name):
            in_layer_shape = int(in_layer.get_shape()[3])

            W = tf.Variable(tf.truncated_normal([width, 1, in_layer_shape, out_dim], stddev = 0.1), name = name + '_W')
            Model.__variable_summaries(name + '_W', W)
            # __image_summary(name + '_W', W, out_dim)

            b = tf.Variable(tf.constant(0.1, shape = [out_dim]), name = name + '_b')
            Model.__variable_summaries(name, b)

            r = tf.nn.conv2d(in_layer, W, strides = [1, stride, 1, 1], padding = padding, name = name) + b
            tf.summary.histogram(name + '_r', r)

            if relu:
                r = tf.nn.relu(r)
                tf.summary.histogram(name + '_relu', r)

            return r

    def __full_layer(name, in_layer, out_dim, relu):
        with tf.variable_scope(name):
            in_layer_shape = int(np.prod(in_layer.get_shape()[1:]))

            initializer = tf.truncated_normal_initializer(dtype = tf.float32, stddev = 1e-1)
            W = tf.get_variable("weights", [in_layer_shape, out_dim], initializer = initializer, dtype = tf.float32)
            Model.__variable_summaries(name + '_W', W)

            initializer = tf.constant_initializer(0.0)
            b = tf.get_variable("biases", [out_dim], initializer = initializer, dtype = tf.float32)
            Model.__variable_summaries(name + '_b', b)

            in_layer_flat = tf.reshape(in_layer, [-1, in_layer_shape])

            r = tf.matmul(in_layer_flat, W) + b
            tf.summary.histogram(name + '_r', r)

            if relu:
                r = tf.nn.relu(r)
                tf.summary.histogram(name + '_relu', r)

            return r

    def __max_pool_layer(name, x, width, stride):
        with tf.variable_scope(name):
            pool = tf.nn.max_pool(x, ksize = [1, width, 1, 1], strides = [1, stride, 1, 1], padding = 'SAME', name = name)
            tf.summary.histogram(name, pool)
            return pool

    def __avg_pool_layer(name, x, width, stride):
        with tf.variable_scope(name):
            pool = tf.nn.avg_pool(x, ksize = [1, width, 1, 1], strides = [1, stride, 1, 1], padding = 'SAME', name = name)
            tf.summary.histogram(name, pool)
            return pool

    def __variable_summaries(name, var):
        """Attach a lot of summaries to a Tensor (for TensorBoard visualization)."""
        with tf.name_scope(name):
            mean = tf.reduce_mean(var)
            tf.summary.scalar('mean', mean)
            with tf.name_scope('stddev'):
                stddev = tf.sqrt(tf.reduce_mean(tf.square(var - mean)))
            tf.summary.scalar('stddev', stddev)
            tf.summary.scalar('max', tf.reduce_max(var))
            tf.summary.scalar('min', tf.reduce_min(var))
            tf.summary.histogram('histogram', var)

    def __image_summary(name, V, dimensions):
        ix = 5
        iy = 1
        V = tf.reshape(V, (ix, iy, dimensions))
        ix += 4
        iy += 4
        V = tf.image.resize_image_with_crop_or_pad(V, iy, ix)
        cy = 4
        cx = 8
        V = tf.reshape(V, (iy, ix, cy, cx))
        V = tf.transpose(V, (2, 0, 3, 1))  # cy,iy,cx,ix
        V = tf.reshape(V, (1, cy * iy, cx * ix, 1))
        tf.summary.image(name, V)


def train(data, sess, model, optimizer, summary, summary_writer, epoch):
    accuracies = []
    for i in range(data.train_batches):
        print("Train %d/%d" % (i + 1, data.train_batches))
        X, Y = data.next_train_batch(sess)
        feed_dict = {model.x: X, model.y: Y, model.aux_fc_dropout_keep: 0.3, model.fc_dropout_keep: 0.4}
        with tf.name_scope('train'):
            sum, _, acc = sess.run([summary, optimizer, model.accuracy], feed_dict = feed_dict)
            summary_writer.add_summary(sum, 0 if epoch == -1 else (epoch * data.train_batches + i + 1))
            summary_writer.flush()
            accuracies.append(acc)
    accuracy = np.mean(accuracies)
    return accuracy


def measure_accuracy(data, sess, model, summary, summary_writer, epoch):
    accuracies = []
    for i in range(data.test_batches):
        print("Test %d/%d" % (i + 1, data.test_batches))
        X, Y = data.next_test_batch(sess)
        feed_dict = {model.x: X, model.y: Y, model.aux_fc_dropout_keep: 1.0, model.fc_dropout_keep: 1.0}
        with tf.name_scope('test'):
            sum, acc = sess.run([summary, model.accuracy], feed_dict = feed_dict)
            summary_writer.add_summary(sum, 0 if epoch == -1 else (epoch * data.test_batches + i + 1))
            summary_writer.flush()
            accuracies.append(acc)
    accuracy = np.mean(accuracies)
    return accuracy


def predict(sess, model, test_iter, batch_size, features_shape, output_file):
    X_test_dict, y_test = sess.run(test_iter)
    X_test = np.transpose(np.asarray(list(X_test_dict.values())))
    X = tf.reshape(X_test, [batch_size, ] + features_shape).eval(session = sess)
    feed_dict = {model.x: X, model.aux_fc_dropout_keep: 1.0, model.fc_dropout_keep: 1.0}
    with tf.name_scope('prediction'):
        prediction = sess.run(model.pred, feed_dict = feed_dict)

    with open(output_file, "w") as file:
        writer = csv.writer(file, delimiter = ",")
        writer.writerow(["id", "label"])
        for i in range(len(prediction)):
            writer.writerow([str(i), str(prediction[i])])

    with open(output_file) as f:
        print("Output prediction: {0}".format(f.read()))


def main(model_dir, load_ckpt, epochs, batch_size, buy_file, nobuy_file, buy_count, nobuy_count, test_data_ratio, first_day, last_day, buy_label):
    """
    :param str model_dir: Base directory for the model
    :param int load_ckpt: Whether to load an existing model
    :param int epochs: Number of cycles over the whole data
    :param int batch_size: Number of examples per batch
    :param str buy_file: Path to the buy data
    :param int buy_count: Number of datasets in buy_file
    :param str nobuy_file: Path to the nobuy data
    :param int nobuy_count: Number of datasets in nobuy_file
    :param float test_data_ratio: The ratio between test and train data sets taken from the train_data file randomly
    :param int first_day: The first day column name e.g. -1814
    :param int last_day: The last day column name e.g. 0
    :param str buy_label: The label used if the user decided on an action for this dataset, e.g. 'buy'
    """

    ckpt_file = model_dir + '\\model.ckpt'
    output_file = model_dir + '\\prediction.txt'
    log_dir = model_dir + '\\log'

    column_names = ['id', 'instrument', 'time', 'decision'] + [str(i) for i in range(first_day, last_day + 1)]
    column_defaults = [['0'], ['0'], ['19700101'], ['ignore']] + [[0.00] for i in range(first_day, last_day + 1)]

    tf.logging.set_verbosity(tf.logging.INFO)

    print('Loading data')
    data = Snapshots(buy_file, nobuy_file, buy_count, nobuy_count, first_day, last_day, batch_size, epochs, test_data_ratio, column_names,
                     column_defaults, buy_label)

    print('Model')
    model = Model(batch_size, data.days)

    print('Optimizer')
    with tf.name_scope('adam'):
        optimizer = tf.train.AdamOptimizer().minimize(model.loss)

    print('Saver')
    saver = tf.train.Saver(tf.trainable_variables())

    with tf.Session() as sess:

        print('Init')
        tf.global_variables_initializer().run()

        if load_ckpt:
            print('Restoring parameters from', ckpt_file)
            saver.restore(sess, ckpt_file)
        else:
            shutil.rmtree(model_dir, ignore_errors = True)

        if epochs > 0:

            print('Summary writer')
            merged = tf.summary.merge_all()
            train_writer = tf.summary.FileWriter(log_dir + '/train', sess.graph)
            test_writer = tf.summary.FileWriter(log_dir + '/test')

            val_acc_mean = measure_accuracy(data, sess, model, merged, test_writer, -1)
            print("initial validation accuracy = %.4f" % val_acc_mean)

            for epoch in range(epochs):
                begin = time.time()

                train_acc_mean = train(data, sess, model, optimizer, merged, train_writer, epoch)

                val_acc_mean = measure_accuracy(data, sess, model, merged, test_writer, epoch)

                print("Epoch %d/%d, time = %ds, train accuracy = %.4f, validation accuracy = %.4f" % (
                    epoch + 1, epochs, time.time() - begin, train_acc_mean, val_acc_mean))

                saver.save(sess, ckpt_file)

                sys.stdout.flush()

        print('Predict')
        test_iter = data.test.take(data.test_batches * batch_size).batch(batch_size).make_one_shot_iterator().get_next()
        predict(sess, model, test_iter, batch_size, [data.days, 1, 1], output_file)


if __name__ == '__main__':
    tf.logging.set_verbosity(tf.logging.INFO)
    FLAGS, unparsed = parser.parse_known_args()

    main(model_dir = FLAGS.model_dir,
          load_ckpt = FLAGS.load,
          epochs = FLAGS.epochs,
          batch_size = FLAGS.batch_size,
          buy_file = FLAGS.buy_file,
          nobuy_file = FLAGS.nobuy_file,
          buy_count = FLAGS.buy_count,
          nobuy_count = FLAGS.nobuy_count,
          test_data_ratio = FLAGS.test_data_ratio,
          first_day = FLAGS.first_day,
          last_day = FLAGS.last_day,
          buy_label = FLAGS.buy_label)
