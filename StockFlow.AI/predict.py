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
import matplotlib.pyplot as plt

os.environ["CUDA_VISIBLE_DEVICES"]="-1"

import numpy as np
import tensorflow as tf

from GoogLeNet import GoogLeNet
#from InceptionResNetV2 import InceptionResNetV2


parser = argparse.ArgumentParser()

parser.add_argument('--checkpoint_dir', type=str, default='model', help='Base directory for the model checkpoint.')
parser.add_argument('--data_file', type=str, default='train_buying.csv', help='Data file.')
parser.add_argument('--batch_size', type=int, default=48, help='Number of examples per batch.')
parser.add_argument('--first_day', type=int, default=0, help='The first day column name e.g. -1814.')
parser.add_argument('--last_day', type=int, default=1023, help='The last day column name e.g. 0.')
parser.add_argument('--buy_label', type=str, default='buy', help='The label used if the user decided on an action for this dataset, e.g. buy')


def main(checkpoint_dir, data_file, batch_size, first_day, last_day, buy_label):
    """
    :param str checkpoint_dir: Base directory for the model checkpoint
    :param str data_file: The data file path
    """

    ckpt_file = checkpoint_dir + '\\'

    i = -1
    for filename in glob.iglob(ckpt_file + "*.meta", recursive=True):
        search = re.search('[^\d]+(\d+).meta$', filename, re.IGNORECASE)
        if search:
            i = max(i, int(search.group(1)))

    if i >= 0:
        print('Restoring parameters from %s' % (ckpt_file + str(i)))
        ckpt_file = ckpt_file + str(i)
    else:
        if os.path.exists(ckpt_file + "initial.meta"):
            print('Restoring parameters from %s' % (ckpt_file + 'initial'))
            ckpt_file = ckpt_file + 'initial'
        else:
            raise Exception('checkpoint not found')

    tf.logging.set_verbosity(tf.logging.INFO)

    class Snapshots(object):
        def __init__(self, data_file, batch_size, column_defaults, buy_label):
            self.batch_size = batch_size

            with tf.name_scope('data'):

                self.epochs_tensor = tf.placeholder(tf.int64, name='epochs')
                self.batch_size_tensor = tf.placeholder(tf.int64, name='batch_size')
                self.count_tensor = tf.placeholder(tf.int64, name='count')

                assert tf.gfile.Exists(data_file), ('%s not found.' % data_file)

                data_file_count = Snapshots.__get_line_count(data_file)

                if data_file_count > 0 and data_file_count < self.batch_size:
                    print(
                        'WARNING: batch_size is greater than available datasets. Reducing batch size to %d' % data_file_count)
                    self.batch_size = data_file_count

                self.batches = int(data_file_count / self.batch_size)

                self.count = self.batches * self.batch_size

                def parse_csv(value):
                    columns = tf.decode_csv(value, record_defaults=column_defaults, field_delim=";")

                    features = columns[4:len(columns)]
                    labels = columns[2]

                    features = tf.stack(features)
                    features = tf.reshape(features, [features.get_shape()[0], 1, 1])

                    labels = tf.cast(tf.equal(labels, buy_label), dtype=tf.int32)
                    labels = tf.one_hot(indices=labels, depth=2, on_value=1.0, off_value=0.0, axis=-1)

                    return features, labels

                print('TextLineDataset')
                dataset = tf.data.TextLineDataset(data_file).skip(1).take(self.count_tensor)

                print('map')
                self.data = dataset.map(parse_csv, num_parallel_calls=5)

                print('batch/prefetch/cache/repeat/iter')
                self.data = self.data.batch(self.batch_size_tensor).prefetch(
                    tf.maximum(self.count_tensor, tf.constant(1, tf.int64))).cache().repeat()
                self.iter = self.data.make_initializable_iterator()

        def __get_line_count(file):

            count = 0
            with open(file, 'r', encoding='utf8') as f:
                i = 0
                while True:
                    line = f.readline()
                    if not line:
                        break
                    if i > 0 and len(line) > 0:
                        count = count + 1
                    i = i + 1

            return count

    print('Loading data')
    column_defaults = [['0'], ['0'], ['19700101'], ['ignore']] + [[0.00] for i in range(first_day, last_day + 1)]
    data = Snapshots(data_file, batch_size, column_defaults, buy_label)

    print('Model')
    model = GoogLeNet(1, data.iter, data.iter)
    #model = InceptionResNetV2(2, data.iter, data.iter)

    print('Saver')
    saver = tf.train.Saver(tf.trainable_variables())

    config = tf.ConfigProto()
    config.gpu_options.allow_growth = True
    config.gpu_options.per_process_gpu_memory_fraction = 0.9
    with tf.Session(config=config) as sess:

        print('Init')
        tf.global_variables_initializer().run()

        saver.restore(sess, ckpt_file)

        sess.run([data.iter.initializer], feed_dict={
            data.epochs_tensor: 1, data.batch_size_tensor: data.batch_size,
            data.count_tensor: data.count})

        #merged = tf.summary.merge_all()

        #writer = tf.summary.FileWriter(checkpoint_dir + '\\predict')

        k = 0
        for i in range(data.batches):

            print('batch %d' % i)

            try:
                #feed_dict = { model.is_train: False, model.fc_dropout_keep: 1.0, model.residual_scale: 0.1 } #InceptionResNetV2
                feed_dict = { model.is_train: False, model.fc_dropout_keep: 1.0, model.aux_fc_dropout_keep: 1, model.aux_exit_4a_weight: 0.3, model.aux_exit_4e_weight: 0.3, model.exit_weight: 1.0 } #GoogLeNet

                preds = sess.run([model.pred], feed_dict = feed_dict)
                #preds, sum = sess.run([model.pred, merged], feed_dict = feed_dict)

                #writer.add_summary(sum, i)
                #writer.flush()

                for pred in preds[0]:
                    if pred == 1:
                        print('%d: buy' % k)
                    k+=1

            except Exception as e:
                print("Unexpected error:", str(e))



if __name__ == '__main__':
    tf.logging.set_verbosity(tf.logging.INFO)
    FLAGS, unparsed = parser.parse_known_args()

    main(checkpoint_dir=FLAGS.checkpoint_dir,
         data_file=FLAGS.data_file,
         batch_size=FLAGS.batch_size,
         first_day=FLAGS.first_day,
         last_day=FLAGS.last_day,
         buy_label=FLAGS.buy_label)
