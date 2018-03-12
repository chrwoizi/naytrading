from __future__ import absolute_import
from __future__ import division
from __future__ import print_function

import argparse
import shutil
import sys
import math
import time
import csv

import numpy as np
import tensorflow as tf
import tensorflow.contrib.slim as slim

parser = argparse.ArgumentParser()

parser.add_argument(
    '--model_dir', type=str, default='model',
    help='Base directory for the model.')

parser.add_argument(
    '--batch_size', type=int, default=32, help='Number of examples per batch.')

parser.add_argument(
    '--data_file', type=str, default='buy.csv',
    help='Path to the training data.')

parser.add_argument(
    '--data_count', type=int, default=1388,
    help='Number of rows in data_file.')

parser.add_argument(
    '--test_data_ratio', type=float, default=0.2,
    help='The ratio between test and train data sets taken from the train_data file randomly.')
	
parser.add_argument(
    '--first_day', type=int, default=-1814,
    help='The first day column name e.g. -1814.')

parser.add_argument(
    '--last_day', type=int, default=0,
    help='The last day column name e.g. 0.')
	
parser.add_argument(
    '--label_true', type=str, default='buy',
    help='The label used if the user decided on an action for this dataset, e.g. buy')
	
def weight_variable(shape):
    initializer = tf.truncated_normal_initializer(dtype=tf.float32, stddev=1e-1)
    return tf.get_variable("weights", shape,initializer=initializer, dtype=tf.float32)

def bias_variable(shape):
    initializer = tf.constant_initializer(0.0)
    return tf.get_variable("biases", shape, initializer=initializer, dtype=tf.float32)

def conv2d(x, W):
    return tf.nn.conv2d(x, W, strides=[1, 1, 1, 1], padding='SAME')

def max_pool_2x2(x):
    return tf.nn.max_pool(x, ksize=[1, 2, 1, 1], strides=[1, 2, 1, 1], padding='SAME')

def variable_summaries(name, var):
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
		
def image_summary(name, V, dimensions):
	ix = 5
	iy = 1
	V = tf.reshape(V,(ix,iy,dimensions))
	ix += 4
	iy += 4
	V = tf.image.resize_image_with_crop_or_pad(V, iy, ix)
	cy = 4
	cx = 8
	V = tf.reshape(V,(iy,ix,cy,cx))
	V = tf.transpose(V,(2,0,3,1)) #cy,iy,cx,ix
	V = tf.reshape(V,(1,cy*iy,cx*ix,1))
	tf.summary.image(name, V)


class Snapshots(object):
	def __init__(self, data_file, data_count, first_day, last_day, batch_size, epochs, test_data_ratio, column_names, column_defaults, label_true):
		
		self.data_count = data_count
		self.data_file = data_file
		self.first_day = first_day
		self.last_day = last_day
		self.days = last_day - first_day + 1

		assert tf.gfile.Exists(data_file), ('%s not found.' % data_file)
	
		def parse_csv(value):
			columns = tf.decode_csv(value, record_defaults=column_defaults, field_delim=";")
			features = dict(zip(column_names, columns))
			features.pop('id')
			features.pop('instrument')
			features.pop('time')
			labels = features.pop('decision')
			labels = tf.cast(tf.equal(labels, label_true), dtype=tf.float32)
			return features, labels
	
		print('TextLineDataset')
		dataset = tf.data.TextLineDataset(data_file).skip(1)
	
		print('map')
		dataset = dataset.map(parse_csv, num_parallel_calls=5)
	
		self.test_count = int(test_data_ratio * data_count)
		self.train_count = data_count - self.test_count
		
		self.test_batches = math.floor(self.test_count / batch_size)
		self.train_batches = math.floor(self.train_count / batch_size)
		
		print('take/skip')
		self.train = dataset.take(self.train_count)
		self.test = dataset.skip(self.train_count)
		
		print('take/batch/repeat/iter/next')
		self.train_iter = self.train.take(self.train_batches * batch_size).batch(batch_size).repeat(epochs).make_one_shot_iterator().get_next()
		self.test_iter = self.test.take(self.test_batches * batch_size).batch(batch_size).repeat(epochs).make_one_shot_iterator().get_next()
		

class MNISTcnn(object):
	def __init__(self, x, y, conf):
		self.x = x
		self.y = y
		self.keep_prob = tf.placeholder(tf.float32)

		# conv1
		with tf.variable_scope('conv1'):

			W_conv1 = weight_variable([5, 1, 1, 32])
			variable_summaries('W_conv1', W_conv1)
			image_summary('W_conv1', W_conv1, 32)

			b_conv1 = bias_variable([32])
			variable_summaries('b_conv1', b_conv1)

			h_conv1 = tf.nn.relu(conv2d(self.x, W_conv1) + b_conv1)
			tf.summary.histogram('h_conv1', h_conv1)

			h_pool1 = max_pool_2x2(h_conv1)
			tf.summary.histogram('h_pool1', h_pool1)

		# conv2
		with tf.variable_scope('conv2'):

			W_conv2 = weight_variable([5, 1, 32, 64])
			variable_summaries('W_conv2', W_conv2)
			#image_summary('W_conv2', W_conv2, 64)

			b_conv2 = bias_variable([64])
			variable_summaries('b_conv2', b_conv2)

			h_conv2 = tf.nn.relu(conv2d(h_pool1, W_conv2) + b_conv2)
			tf.summary.histogram('h_conv2', h_conv2)

			h_pool2 = max_pool_2x2(h_conv2)
			tf.summary.histogram('h_pool2', h_pool2)

		# fc1
		with tf.variable_scope("fc1"):

			shape = int(np.prod(h_pool2.get_shape()[1:]))
			W_fc1 = weight_variable([shape, 1024])
			variable_summaries('W_fc1', W_fc1)

			b_fc1 = bias_variable([1024])
			variable_summaries('b_fc1', b_fc1)

			h_pool2_flat = tf.reshape(h_pool2, [-1, shape])
			
			h_fc1 = tf.nn.relu(tf.matmul(h_pool2_flat, W_fc1) + b_fc1)
			tf.summary.histogram('h_fc1', h_fc1)

		# dropout
		with tf.name_scope("dropout"):

			h_fc1_drop = tf.nn.dropout(h_fc1, self.keep_prob)
			tf.summary.histogram('h_fc1_drop', h_fc1_drop)

		# fc2
		with tf.variable_scope("fc2"):

			W_fc2 = weight_variable([1024, 2])
			variable_summaries('W_fc2', W_fc2)

			b_fc2 = bias_variable([2])
			variable_summaries('b_fc2', b_fc2)

			y_conv = tf.matmul(h_fc1_drop, W_fc2) + b_fc2
			tf.summary.histogram('y_conv', y_conv)

		self.loss = tf.reduce_mean(tf.nn.softmax_cross_entropy_with_logits(labels=self.y, logits=y_conv))
		tf.summary.histogram('self.loss', self.loss)

		self.pred = tf.argmax(y_conv, 1)
		tf.summary.histogram('self.pred', self.pred)

		self.correct_prediction = tf.equal(tf.argmax(y_conv,1), tf.argmax(self.y,1))

		self.accuracy = tf.reduce_mean(tf.cast(self.correct_prediction, tf.float32))
		tf.summary.histogram('self.accuracy', self.accuracy)


def predict(sess, x, keep_prob, pred, test_iter, batch_size, features_shape, output_file):
	X_test_dict, y_test = sess.run(test_iter)
	X_test = np.transpose(np.asarray(list(X_test_dict.values())))
	X = tf.reshape(X_test, [batch_size,] + features_shape).eval(session=sess)
	feed_dict = {x:X, keep_prob: 1.0}
	with tf.name_scope('prediction'):
		prediction = sess.run(pred, feed_dict=feed_dict)
	
	with open(output_file, "w") as file:
		writer = csv.writer(file, delimiter = ",")
		writer.writerow(["id","label"])
		for i in range(len(prediction)):
			writer.writerow([str(i), str(prediction[i])])
	
	print("Output prediction: {0}". format(output_file))


def train(data_file, data_count, first_day, last_day, batch_size, test_data_ratio, column_names, column_defaults, label_true, load_ckpt, ckpt_file, epochs, output_file, log_dir):
	
	print('Loading data')
	data = Snapshots(data_file, data_count, first_day, last_day, batch_size, epochs, test_data_ratio, column_names, column_defaults, label_true)

	print('Model')
	x = tf.placeholder(tf.float32, shape=[batch_size, data.days, 1, 1])
	y = tf.placeholder(tf.float32, shape=[batch_size, 2])
	model = MNISTcnn(x, y, None)
	
	print('Optimizer')
	with tf.name_scope('adam'):
		optimizer = tf.train.AdamOptimizer(1e-4).minimize(model.loss)
	
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
					print("Train %d/%d" % (i+1, data.train_batches))
					X_train_dict, y_train = sess.run(data.train_iter)
					X_train = np.transpose(np.asarray(list(X_train_dict.values())))
					X = tf.reshape(X_train, [batch_size, data.days, 1, 1]).eval(session=sess)
					Y = np.asarray(list(map(lambda x: np.array([x, 1 - x]), y_train)))
					feed_dict = {x:X, y:Y, model.keep_prob: 0.5}
					with tf.name_scope('train'):
						summary, _, acc = sess.run([merged, optimizer, model.accuracy], feed_dict=feed_dict)
						train_writer.add_summary(summary, epoch * data.train_batches + i)
						train_writer.flush()
					train_accuracies.append(acc)
				train_acc_mean = np.mean(train_accuracies)
			
			
				# compute loss over validation data
				val_accuracies = []
				for i in range(data.test_batches):
					print("Test %d/%d" % (i+1, data.test_batches))
					X_test_dict, y_test = sess.run(data.test_iter)
					X_test = np.transpose(np.asarray(list(X_test_dict.values())))
					X = tf.reshape(X_test, [batch_size, data.days, 1, 1]).eval(session=sess)
					Y = np.asarray(list(map(lambda x: np.array([x, 1 - x]), y_test)))
					feed_dict = {x:X, y:Y, model.keep_prob: 1.0}
					with tf.name_scope('test'):
						summary, acc = sess.run([merged, model.accuracy], feed_dict=feed_dict)
						test_writer.add_summary(summary, epoch * data.test_batches + i)
						test_writer.flush()
					val_accuracies.append(acc)
				val_acc_mean = np.mean(val_accuracies)
				
				# log progress to console
				print("Epoch %d, time = %ds, train accuracy = %.4f, validation accuracy = %.4f" % (epoch, time.time()-begin, train_acc_mean, val_acc_mean))

				sys.stdout.flush()
			
				if (epoch + 1) % 10 == 0:
					saver.save(sess, ckpt_file)
		
			saver.save(sess, ckpt_file)

		# predict test data
		print('Predict')
		test_iter = data.test.take(data.test_batches * batch_size).batch(batch_size).make_one_shot_iterator().get_next()
		predict(sess, x, model.keep_prob, model.pred, test_iter, batch_size, [data.days, 1, 1], output_file)


def Learn(model_dir = 'model', batch_size = 32, data_file = 'buy.csv', data_count = 1388, test_data_ratio = 0.2, first_day = -1814, last_day = 0, label_true = 'buy'):
	'''
	:param str model_dir: Base directory for the model
	:param int batch_size: Number of examples per batch
	:param str data_file: Path to the data
	:param int data_count: Number of datasets in data_file
	:param float test_data_ratio: The ratio between test and train data sets taken from the train_data file randomly
	:param int first_day: The first day column name e.g. -1814
	:param int last_day: The last day column name e.g. 0
	:param str label_true: The label used if the user decided on an action for this dataset, e.g. 'buy'
    '''

	column_names = ['id', 'instrument', 'time', 'decision'] + [str(i) for i in range(first_day, last_day + 1)]
	column_defaults = [['0'], ['0'], ['19700101'], ['ignore']] + [[0.00] for i in range(first_day, last_day + 1)]
	
	tf.logging.set_verbosity(tf.logging.INFO)

	load_ckpt = False
	ckpt_file = model_dir + '\\model.ckpt'
	epochs = 10
	output_file = model_dir + '\\prediction.txt'
	log_dir = model_dir + '\\log'

	train(data_file, data_count, first_day, last_day, batch_size, test_data_ratio, column_names, column_defaults, label_true, load_ckpt, ckpt_file, epochs, output_file, log_dir)


if __name__ == '__main__':

	tf.logging.set_verbosity(tf.logging.INFO)
	FLAGS, unparsed = parser.parse_known_args()
	
	output = Learn(model_dir = FLAGS.model_dir, 
	batch_size = FLAGS.batch_size, 
	data_file = FLAGS.data_file, 
	data_count = FLAGS.data_count,
	test_data_ratio = FLAGS.test_data_ratio, 
	first_day = FLAGS.first_day, 
	last_day = FLAGS.last_day, 
	label_true = FLAGS.label_true)

	print(output)
