from __future__ import absolute_import
from __future__ import division
from __future__ import print_function

import argparse
import shutil
import sys
import math

import tensorflow as tf

parser = argparse.ArgumentParser()

parser.add_argument(
    '--model_dir', type=str, default='/tmp/census_model',
    help='Base directory for the model.')

parser.add_argument(
    '--model_type', type=str, default='wide_deep',
    help="Valid model types: {'wide', 'deep'}.")

parser.add_argument(
    '--train_epochs', type=int, default=40, help='Number of training epochs.')

parser.add_argument(
    '--epochs_per_eval', type=int, default=2,
    help='The number of training epochs to run between evaluations.')

parser.add_argument(
    '--batch_size', type=int, default=40, help='Number of examples per batch.')

parser.add_argument(
    '--train_data', type=str, default='/tmp/census_data/adult.data',
    help='Path to the training data.')

parser.add_argument(
    '--test_data', type=str, default='/tmp/census_data/adult.test',
    help='Path to the test data.')
	
parser.add_argument(
    '--train_skip_lines', type=int, default=1,
    help='Lines to skip in the training data.')
	
parser.add_argument(
    '--test_skip_lines', type=int, default=1,
    help='Lines to skip in the test data.')
	
parser.add_argument(
    '--train_count', type=int, default=1,
    help='The number of data sets in the train_data file.')
	
parser.add_argument(
    '--test_count', type=int, default=1,
    help='The number of data sets in the test_data file.')
	
parser.add_argument(
    '--first_day', type=int, default=-1814,
    help='The first day column name e.g. -1814.')

parser.add_argument(
    '--last_day', type=int, default=-1814,
    help='The last day column name e.g. 0.')
	

def build_model_columns(first_day, last_day):
	"""Builds a set of wide and deep feature columns."""

	rates = [tf.feature_column.numeric_column(str(i)) for i in range(first_day, last_day + 1)]
	
	return rates


def build_estimator(model_dir, model_type, first_day, last_day):
	"""Build an estimator appropriate for the given model type."""
	columns = build_model_columns(first_day, last_day)

	day_count = last_day - first_day + 1
	layers = 4
	hidden_units = [1 + math.ceil(day_count * (1 - i/layers)) for i in range(0, layers)]
	
	# Create a tf.estimator.RunConfig to ensure the model is run on CPU, which
	# trains faster than GPU for this model.
	run_config = tf.estimator.RunConfig().replace(
		session_config=tf.ConfigProto(device_count={'GPU': 0}))
	
	if model_type == 'wide':
		return tf.estimator.LinearClassifier(
			model_dir=model_dir,
			feature_columns=columns,
			config=run_config)

	elif model_type == 'deep':
		return tf.estimator.DNNClassifier(
			model_dir=model_dir,
			feature_columns=columns,
			hidden_units=hidden_units,
			config=run_config)


def input_fn(data_file, skip_lines, num_epochs, shuffle, batch_size, train_count, _CSV_COLUMNS, _CSV_COLUMN_DEFAULTS):
	"""Generate an input function for the Estimator."""
	assert tf.gfile.Exists(data_file), (
		'%s not found. Please make sure you have either run data_download.py or '
		'set both arguments --train_data and --test_data.' % data_file)
	
	def parse_csv(value):
		columns = tf.decode_csv(value, record_defaults=_CSV_COLUMN_DEFAULTS, field_delim=";")
		features = dict(zip(_CSV_COLUMNS, columns))
		labels = features.pop('decision')
		return features, tf.equal(labels, 'buy')
	
	# Extract lines from input files using the Dataset API.
	dataset = tf.data.TextLineDataset(data_file).skip(skip_lines).take(train_count)
	
	if shuffle:
		dataset = dataset.shuffle(buffer_size=train_count)
	
	dataset = dataset.map(parse_csv, num_parallel_calls=5)
	
	# We call repeat after shuffling, rather than before, to prevent separate
	# epochs from blending together.
	dataset = dataset.repeat(num_epochs)
	dataset = dataset.batch(batch_size)
	
	iterator = dataset.make_one_shot_iterator()
	features, labels = iterator.get_next()
	return features, labels


def Learn(model_dir = 'model', model_type = 'wide', train_epochs = 40, epochs_per_eval = 2, batch_size = 40, train_data = 'train.csv', test_data = 'test.csv', train_skip_lines = 0, test_skip_lines = 0, train_count = 32, test_count = 0, first_day = -1814, last_day = 0):
	'''
	:param str model_dir: Base directory for the model
	:param str model_type: Valid model types: {'wide', 'deep'}
	:param int train_epochs: Number of training epochs
	:param int epochs_per_eval: The number of training epochs to run between evaluations
	:param int batch_size: Number of examples per batch
	:param str train_data: Path to the training data
	:param str test_data: Path to the test data
	:param int train_skip_lines: Lines to skip in the training data
	:param int test_skip_lines: Lines to skip in the test data
	:param int train_count: The number of data sets in the train_data file
	:param int test_count: The number of data sets in the test_data file
	:param int first_day: The first day column name e.g. -1814
	:param int last_day: The last day column name e.g. 0
   '''
   
	_CSV_COLUMNS = ['decision'] + [str(i) for i in range(first_day, last_day + 1)]

	_CSV_COLUMN_DEFAULTS = [['ignore']] + [[0.00] for i in range(first_day, last_day + 1)]


	tf.logging.set_verbosity(tf.logging.INFO)

	# Clean up the model directory if present
	shutil.rmtree(model_dir, ignore_errors=True)
	model = build_estimator(model_dir, model_type, first_day, last_day)
	
	log = ''

	# Train and evaluate the model every `epochs_per_eval` epochs.
	for n in range(train_epochs // epochs_per_eval):
		model.train(input_fn=lambda: input_fn(
			train_data, train_skip_lines, epochs_per_eval, True, batch_size, train_count, _CSV_COLUMNS, _CSV_COLUMN_DEFAULTS))
		
		results = model.evaluate(input_fn=lambda: input_fn(
			test_data, test_skip_lines, 1, False, batch_size, test_count, _CSV_COLUMNS, _CSV_COLUMN_DEFAULTS))
		
		# Display evaluation metrics
		log = log + '\n' + 'Results at epoch' + str((n + 1) * epochs_per_eval)
		log = log + '\n' + ('-' * 60)
		
		for key in sorted(results):
			log = log + '\n' + ('%s: %s' % (key, results[key]))

	return log

if __name__ == '__main__':

	tf.logging.set_verbosity(tf.logging.INFO)
	FLAGS, unparsed = parser.parse_known_args()
	
	output = Learn(model_dir = FLAGS.model_dir, 
	model_type = FLAGS.model_type, 
	train_epochs = FLAGS.train_epochs, 
	epochs_per_eval = FLAGS.epochs_per_eval, 
	batch_size = FLAGS.batch_size, 
	train_data = FLAGS.train_data, 
	test_data = FLAGS.test_data, 
	train_skip_lines = FLAGS.train_skip_lines,
	test_skip_lines = FLAGS.test_skip_lines,
	train_count = FLAGS.train_count, 
	test_count = FLAGS.test_count, 
	first_day = FLAGS.first_day, 
	last_day = FLAGS.last_day)

	print(output)

#import tensorflow as tf
#
#def LearnSample(x_train, y_train):
#
#	# Model parameters
#	W = tf.Variable([.3], dtype=tf.float32)
#	b = tf.Variable([-.3], dtype=tf.float32)
#
#	# Model input and output
#	x = tf.placeholder(tf.float32)
#	y = tf.placeholder(tf.float32)
#	
#	linear_model = W*x + b
#	
#	# loss
#	loss = tf.reduce_sum(tf.square(linear_model - y)) # sum of the squares
#
#	# optimizer
#	optimizer = tf.train.GradientDescentOptimizer(0.01)
#	train = optimizer.minimize(loss)
#	
#	# training loop
#	init = tf.global_variables_initializer()
#	sess = tf.Session()
#	sess.run(init)
#	for i in range(1000):
#		sess.run(train, {x: x_train, y: y_train})
#	
#	# evaluate training accuracy
#	curr_W, curr_b, curr_loss = sess.run([W, b, loss], {x: x_train, y: y_train})
#	
#	return [curr_W, curr_b, curr_loss]*/