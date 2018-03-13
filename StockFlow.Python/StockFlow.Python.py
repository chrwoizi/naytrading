from __future__ import absolute_import
from __future__ import division
from __future__ import print_function

import argparse
import sys
import math
import time
import csv

import numpy as np
import tensorflow as tf


parser = argparse.ArgumentParser()

parser.add_argument(
    '--model_dir', type = str, default = 'model',
    help = 'Base directory for the model.')

parser.add_argument(
    '--batch_size', type = int, default = 32, help = 'Number of examples per batch.')

parser.add_argument(
    '--data_file', type = str, default = 'buy_dummy.csv',
    help = 'Path to the training data.')

parser.add_argument(
    '--data_count', type = int, default = 1024,
    help = 'Number of rows in data_file.')

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
    '--label_true', type = str, default = 'buy',
    help = 'The label used if the user decided on an action for this dataset, e.g. buy')


class Snapshots(object):
    def __init__(self, data_file, data_count, first_day, last_day, batch_size, epochs, test_data_ratio, column_names,
                 column_defaults, label_true):
        self.data_count = data_count
        self.data_file = data_file
        self.first_day = first_day
        self.last_day = last_day
        self.days = last_day - first_day + 1
        self.batch_size = batch_size

        assert tf.gfile.Exists(data_file), ('%s not found.' % data_file)

        def parse_csv(value):
            columns = tf.decode_csv(value, record_defaults = column_defaults, field_delim = ";")
            features = dict(zip(column_names, columns))
            features.pop('id')
            features.pop('instrument')
            features.pop('time')
            labels = features.pop('decision')
            labels = tf.cast(tf.equal(labels, label_true), dtype = tf.float32)
            return features, labels

        print('TextLineDataset')
        dataset = tf.data.TextLineDataset(data_file).skip(1)

        print('map')
        dataset = dataset.map(parse_csv, num_parallel_calls = 5)

        print('shuffle')
        dataset.shuffle(data_count)

        print('count')
        self.test_count = int(test_data_ratio * data_count)
        self.train_count = data_count - self.test_count

        self.test_batches = int(math.floor(self.test_count / batch_size))
        self.train_batches = int(math.floor(self.train_count / batch_size))

        print('take/skip')
        self.train = dataset.take(self.train_count)
        self.test = dataset.skip(self.train_count)

        print('take/batch/repeat/iter/next')
        self.__train_iter = self.train.take(self.train_batches * batch_size).batch(batch_size).repeat(
            epochs).make_one_shot_iterator().get_next()
        self.__test_iter = self.test.take(self.test_batches * batch_size).batch(batch_size).repeat(
            epochs).make_one_shot_iterator().get_next()

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
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.dropout_keep = tf.placeholder(tf.float32)

        conv1 = Model.__conv_layer('conv1', self.x, 16, 32, True, True)

        conv2 = Model.__conv_layer('conv2', conv1, 16, 64, True, True)

        conv3 = Model.__conv_layer('conv3', conv2, 16, 128, True, True)

        conv4 = Model.__conv_layer('conv4', conv3, 16, 256, True, True)

        conv5 = Model.__conv_layer('conv5', conv4, 16, 512, True, True)

        fc1 = Model.__full_layer('fc1', conv5, 1024, True, self.dropout_keep)

        fc2 = Model.__full_layer('fc2', fc1, 2, False, None)

        with tf.variable_scope('loss'):
            y_sg = tf.stop_gradient(self.y)
            self.loss = tf.reduce_mean(tf.nn.softmax_cross_entropy_with_logits_v2(labels = y_sg, logits = fc2))
            tf.summary.histogram('self.loss', self.loss)

        with tf.variable_scope('pred'):
            self.pred = tf.argmax(fc2, 1)
            tf.summary.histogram('self.pred', self.pred)

        with tf.variable_scope('accuracy'):
            self.correct_prediction = tf.equal(tf.argmax(fc2, 1), tf.argmax(self.y, 1))
            self.accuracy = tf.reduce_mean(tf.cast(self.correct_prediction, tf.float32))
            tf.summary.histogram('self.accuracy', self.accuracy)

    def __conv_layer(name, in_layer, width, out_dim, relu, pool):
        with tf.variable_scope(name):
            in_layer_shape = int(in_layer.get_shape()[3])

            W = Model.__weight_variable([width, 1, in_layer_shape, out_dim])
            Model.__variable_summaries(name + 'W', W)
            # __image_summary(name + '_W', W, out_dim)

            b = Model.__bias_variable([out_dim])
            Model.__variable_summaries(name + '_b', b)

            r = Model.__conv2d(in_layer, W) + b
            tf.summary.histogram(name + '_r', r)

            if relu:
                r = tf.nn.relu(r)
                tf.summary.histogram(name + '_relu', r)

            if pool:
                r = Model.__max_pool_2(r)
                tf.summary.histogram(name + '_pool', r)

            return r

    def __full_layer(name, in_layer, out_dim, relu, dropout_keep):
        with tf.variable_scope(name):
            in_layer_shape = int(np.prod(in_layer.get_shape()[1:]))

            W = Model.__weight_variable([in_layer_shape, out_dim])
            Model.__variable_summaries(name + '_W', W)

            b = Model.__bias_variable([out_dim])
            Model.__variable_summaries(name + '_b', b)

            in_layer_flat = tf.reshape(in_layer, [-1, in_layer_shape])

            r = tf.matmul(in_layer_flat, W) + b
            tf.summary.histogram(name + '_r', r)

            if relu:
                r = tf.nn.relu(r)
                tf.summary.histogram(name + '_relu', r)

            if dropout_keep is not None:
                r = tf.nn.dropout(r, dropout_keep)
                tf.summary.histogram(name + '_drop', r)

            return r

    def __weight_variable(shape):
        initializer = tf.truncated_normal_initializer(dtype = tf.float32, stddev = 1e-1)
        return tf.get_variable("weights", shape, initializer = initializer, dtype = tf.float32)

    def __bias_variable(shape):
        initializer = tf.constant_initializer(0.0)
        return tf.get_variable("biases", shape, initializer = initializer, dtype = tf.float32)

    def __conv2d(x, W):
        return tf.nn.conv2d(x, W, strides = [1, 1, 1, 1], padding = 'SAME')

    def __max_pool_2(x):
        return tf.nn.max_pool(x, ksize = [1, 2, 1, 1], strides = [1, 2, 1, 1], padding = 'SAME')

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


def predict(sess, x, dropout_keep, pred, test_iter, batch_size, features_shape, output_file):
    X_test_dict, y_test = sess.run(test_iter)
    X_test = np.transpose(np.asarray(list(X_test_dict.values())))
    X = tf.reshape(X_test, [batch_size, ] + features_shape).eval(session = sess)
    feed_dict = {x: X, dropout_keep: 1.0}
    with tf.name_scope('prediction'):
        prediction = sess.run(pred, feed_dict = feed_dict)

    with open(output_file, "w") as file:
        writer = csv.writer(file, delimiter = ",")
        writer.writerow(["id", "label"])
        for i in range(len(prediction)):
            writer.writerow([str(i), str(prediction[i])])

    with open(output_file) as f:
        print("Output prediction: {0}".format(f.read()))


def main(model_dir, batch_size, data_file, data_count, test_data_ratio, first_day, last_day, label_true):
    """
    :param str model_dir: Base directory for the model
    :param int batch_size: Number of examples per batch
    :param str data_file: Path to the data
    :param int data_count: Number of datasets in data_file
    :param float test_data_ratio: The ratio between test and train data sets taken from the train_data file randomly
    :param int first_day: The first day column name e.g. -1814
    :param int last_day: The last day column name e.g. 0
    :param str label_true: The label used if the user decided on an action for this dataset, e.g. 'buy'
    """

    load_ckpt = False
    ckpt_file = model_dir + '\\model.ckpt'
    epochs = 1
    output_file = model_dir + '\\prediction.txt'
    log_dir = model_dir + '\\log'

    column_names = ['id', 'instrument', 'time', 'decision'] + [str(i) for i in range(first_day, last_day + 1)]
    column_defaults = [['0'], ['0'], ['19700101'], ['ignore']] + [[0.00] for i in range(first_day, last_day + 1)]

    tf.logging.set_verbosity(tf.logging.INFO)

    print('Loading data')
    data = Snapshots(data_file, data_count, first_day, last_day, batch_size, epochs, test_data_ratio, column_names,
                     column_defaults, label_true)

    print('Model')
    x = tf.placeholder(tf.float32, shape = [batch_size, data.days, 1, 1])
    y = tf.placeholder(tf.float32, shape = [batch_size, 2])
    model = Model(x, y)

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

        if epochs > 0:

            print('Summary writer')
            merged = tf.summary.merge_all()
            train_writer = tf.summary.FileWriter(log_dir + '/train', sess.graph)
            test_writer = tf.summary.FileWriter(log_dir + '/test')

            for epoch in range(epochs):
                begin = time.time()

                # train
                train_accuracies = []
                for i in range(data.train_batches):
                    print("Train %d/%d" % (i + 1, data.train_batches))
                    X, Y = data.next_train_batch(sess)
                    feed_dict = {x: X, y: Y, model.dropout_keep: 0.5}
                    with tf.name_scope('train'):
                        summary, _, acc = sess.run([merged, optimizer, model.accuracy], feed_dict = feed_dict)
                        train_writer.add_summary(summary, epoch * data.train_batches + i)
                        train_writer.flush()
                    train_accuracies.append(acc)
                train_acc_mean = np.mean(train_accuracies)

                # compute loss over validation data
                val_accuracies = []
                for i in range(data.test_batches):
                    print("Test %d/%d" % (i + 1, data.test_batches))
                    X, Y = data.next_test_batch(sess)
                    feed_dict = {x: X, y: Y, model.dropout_keep: 1.0}
                    with tf.name_scope('test'):
                        summary, acc = sess.run([merged, model.accuracy], feed_dict = feed_dict)
                        test_writer.add_summary(summary, epoch * data.test_batches + i)
                        test_writer.flush()
                    val_accuracies.append(acc)
                val_acc_mean = np.mean(val_accuracies)

                # log progress to console
                print("Epoch %d/%d, time = %ds, train accuracy = %.4f, validation accuracy = %.4f" % (
                    epoch + 1, epochs, time.time() - begin, train_acc_mean, val_acc_mean))

                saver.save(sess, ckpt_file)

                sys.stdout.flush()

        # predict test data
        print('Predict')
        test_iter = data.test.take(data.test_batches * batch_size).batch(batch_size).make_one_shot_iterator().get_next()
        predict(sess, x, model.dropout_keep, model.pred, test_iter, batch_size, [data.days, 1, 1], output_file)


if __name__ == '__main__':
    tf.logging.set_verbosity(tf.logging.INFO)
    FLAGS, unparsed = parser.parse_known_args()

    main(model_dir = FLAGS.model_dir,
          batch_size = FLAGS.batch_size,
          data_file = FLAGS.data_file,
          data_count = FLAGS.data_count,
          test_data_ratio = FLAGS.test_data_ratio,
          first_day = FLAGS.first_day,
          last_day = FLAGS.last_day,
          label_true = FLAGS.label_true)
