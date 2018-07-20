
import tensorflow as tf
from NetworkBase import NetworkBase

class GoogLeNet(NetworkBase):

    def __init__(self, summary_level, features, labels, mode, options):
        super().__init__(summary_level, features, labels, mode, options)

        # https://hacktilldawn.com/2016/09/25/inception-modules-explained-and-implemented/
        # https://www.cc.gatech.edu/~hic/CS7616/Papers/Szegedy-et-al-2014.pdf

        self.aux_fc_dropout_keep = tf.constant(options["aux_fc_dropout_keep"], dtype=tf.float32)
        self.aux_exit_4a_weight = tf.constant(options["aux_exit_4a_weight"], dtype=tf.float32, shape=())
        self.aux_exit_4e_weight = tf.constant(options["aux_exit_4e_weight"], dtype=tf.float32, shape=())
        self.exit_weight = tf.constant(options["exit_weight"], dtype=tf.float32, shape=())

        conv1 = self.conv_layer('conv1', self.x, 7, 2, 64, True, False)
        conv1_pool = self.max_pool_layer('conv1_pool', conv1, 3, 2)
        conv1_norm = tf.nn.local_response_normalization(conv1_pool, name='conv1_norm')

        conv2_reduce = self.conv_layer('conv2_reduce', conv1_norm, 1, 1, 64, True, False, 'VALID')
        conv2 = self.conv_layer('conv2', conv2_reduce, 3, 1, 192, True, False)
        conv2_norm = tf.nn.local_response_normalization(conv2, name='conv2_norm')
        conv2_pool = self.max_pool_layer('conv2_pool', conv2_norm, 3, 2)

        inception3a = self.__inception_module('inception3a', conv2_pool, 64, 96, 128, 16, 32, 32)
        inception3b = self.__inception_module('inception3b', inception3a, 128, 128, 192, 32, 96, 64)
        inception3p = self.max_pool_layer('inception3_pool', inception3b, 3, 2)

        inception4a = self.__inception_module('inception4a', inception3p, 192, 96, 208, 16, 48, 64)
        inception4b = self.__inception_module('inception4b', inception4a, 160, 112, 224, 24, 64, 64)
        inception4c = self.__inception_module('inception4c', inception4b, 128, 128, 256, 24, 64, 64)
        inception4d = self.__inception_module('inception4d', inception4c, 112, 144, 288, 32, 64, 64)
        inception4e = self.__inception_module('inception4e', inception4d, 256, 160, 320, 32, 128, 128)
        inception4p = self.max_pool_layer('inception4_pool', inception4e, 3, 2)

        inception4a_avg = self.avg_pool_layer('inception4a_avg', inception4a, 5, 3)
        inception4a_reduce = self.conv_layer('inception4a_reduce', inception4a_avg, 1, 1, 128, True, False)
        inception4a_exit = self.exit_layer('exit_4a', inception4a_reduce, self.aux_fc_dropout_keep)

        inception4e_avg = self.avg_pool_layer('inception4a_avg', inception4e, 5, 3)
        inception4e_reduce = self.conv_layer('inception4e_reduce', inception4e_avg, 1, 1, 128, True, False)
        inception4e_exit = self.exit_layer('exit_4e', inception4e_reduce, self.aux_fc_dropout_keep)

        inception5a = self.__inception_module('inception5a', inception4p, 256, 160, 320, 32, 128, 128)
        inception5b = self.__inception_module('inception5b', inception5a, 384, 192, 384, 48, 128, 128)
        inception5p = self.avg_pool_layer('inception5_pool', inception5b, 7, 1)

        self.exit = self.exit_layer('exit', inception5p, self.fc_dropout_keep)

        if mode == tf.estimator.ModeKeys.PREDICT:
            with tf.variable_scope('predict'):

                self.exit_argmax = tf.argmax(self.exit, 1)
                if self.summary_level >= 1:
                    tf.summary.scalar('value', self.exit_argmax)
        
        else:
            with tf.variable_scope('loss'):

                y_sg = tf.stop_gradient(self.y)

                with tf.variable_scope('inception4a_exit'):
                    softmax_inception4a_exit = tf.nn.softmax_cross_entropy_with_logits_v2(labels=y_sg,
                                                                                          logits=inception4a_exit)
                    loss_inception4a_exit = tf.reduce_mean(softmax_inception4a_exit)
                    if self.summary_level >= 1:
                        tf.summary.scalar('value', loss_inception4a_exit)

                with tf.variable_scope('inception4e_exit'):
                    softmax_inception4a_exit = tf.nn.softmax_cross_entropy_with_logits_v2(labels=y_sg,
                                                                                          logits=inception4e_exit)
                    loss_inception4e_exit = tf.reduce_mean(softmax_inception4a_exit)
                    if self.summary_level >= 1:
                        tf.summary.scalar('value', loss_inception4e_exit)

                with tf.variable_scope('exit'):
                    softmax_exit = tf.nn.softmax_cross_entropy_with_logits_v2(labels=y_sg, logits=self.exit)
                    loss_exit = tf.reduce_mean(softmax_exit)
                    if self.summary_level >= 1:
                        tf.summary.scalar('value', loss_exit)

                with tf.variable_scope('combined'):
                    self.loss = tf.add(tf.add(tf.scalar_mul(self.aux_exit_4a_weight, loss_inception4a_exit),
                                              tf.scalar_mul(self.aux_exit_4e_weight, loss_inception4e_exit)),
                                       tf.scalar_mul(self.exit_weight, loss_exit))
                    if self.summary_level >= 1:
                        tf.summary.scalar('value', self.loss)

            with tf.variable_scope('accuracy'):

                with tf.variable_scope('inception4a_exit'):
                    correct_prediction_inception4a_exit = tf.equal(tf.argmax(inception4a_exit, 1), tf.argmax(self.y, 1))
                    accuracy_inception4a_exit = tf.reduce_mean(tf.cast(correct_prediction_inception4a_exit, tf.float32))
                    if self.summary_level >= 1:
                        tf.summary.scalar('value', accuracy_inception4a_exit)

                with tf.variable_scope('inception4e_exit'):
                    correct_prediction_inception4e_exit = tf.equal(tf.argmax(inception4e_exit, 1), tf.argmax(self.y, 1))
                    accuracy_inception4e_exit = tf.reduce_mean(tf.cast(correct_prediction_inception4e_exit, tf.float32))
                    if self.summary_level >= 1:
                        tf.summary.scalar('value', accuracy_inception4e_exit)

                with tf.variable_scope('exit'):
                    self.exit_argmax = tf.argmax(self.exit, 1)
                    self.y_argmax = tf.argmax(self.y, 1)
                    self.correct_prediction = tf.equal(self.exit_argmax, self.y_argmax)
                    self.accuracy = tf.reduce_mean(tf.cast(self.correct_prediction, tf.float32))
                    if self.summary_level >= 1:
                        tf.summary.scalar('value', self.accuracy)

                with tf.variable_scope('combined'):
                    accuracy_combined = tf.divide(
                        tf.add(tf.add(tf.scalar_mul(self.aux_exit_4a_weight, accuracy_inception4a_exit),
                                      tf.scalar_mul(self.aux_exit_4e_weight, accuracy_inception4e_exit)),
                               tf.scalar_mul(self.exit_weight, self.accuracy)),
                        tf.add(tf.add(self.aux_exit_4a_weight, self.aux_exit_4e_weight), self.exit_weight))
                    if self.summary_level >= 1:
                        tf.summary.scalar('value', accuracy_combined)

            with tf.variable_scope('imitations'):

                expected_one = tf.cast(self.y_argmax, tf.float32)
                expected_zero = tf.subtract(float(1), expected_one)
                actual_one = tf.cast(self.exit_argmax, tf.float32)
                actual_zero = tf.subtract(float(1), actual_one)

                with tf.variable_scope(options['action'] + 's_detected'):
                    self.positives_detected = tf.divide(
                        tf.reduce_sum(tf.multiply(expected_one, actual_one)),
                        tf.maximum(float(1), tf.reduce_sum(expected_one)))
                    if self.summary_level >= 1:
                        tf.summary.scalar('value', self.positives_detected)

                with tf.variable_scope('waits_detected'):
                    self.negatives_detected = tf.divide(
                        tf.reduce_sum(tf.multiply(expected_zero, actual_zero)),
                        tf.maximum(float(1), tf.reduce_sum(expected_zero)))
                    if self.summary_level >= 1:
                        tf.summary.scalar('value', self.negatives_detected)

                with tf.variable_scope(options['action'] + 's_correct'):
                    self.positives_correct = tf.divide(
                        tf.reduce_sum(tf.multiply(expected_one, actual_one)),
                        tf.maximum(float(1), tf.reduce_sum(actual_one)))
                    if self.summary_level >= 1:
                        tf.summary.scalar('value', self.positives_correct)

                with tf.variable_scope('waits_correct'):
                    self.negatives_correct = tf.divide(
                        tf.reduce_sum(tf.multiply(expected_zero, actual_zero)),
                        tf.maximum(float(1), tf.reduce_sum(actual_zero)))
                    if self.summary_level >= 1:
                        tf.summary.scalar('value', self.negatives_correct)

    def __inception_module(self, name, x, out_1x1, reduce3, out_3x1, reduce5, out_5x1, out_pool):
        with tf.variable_scope(name):
            conv_reduce3 = self.conv_layer('conv_reduce_3x1', x, 1, 1, reduce3, True, False)
            conv_reduce5 = self.conv_layer('conv_reduce_5x1', x, 1, 1, reduce5, True, False)

            conv_1x1 = self.conv_layer('conv_1x1', x, 1, 1, out_1x1, False, False)
            conv_3x1 = self.conv_layer('conv_3x1', conv_reduce3, 3, 1, out_3x1, False, False)
            conv_5x1 = self.conv_layer('conv_5x1', conv_reduce5, 5, 1, out_5x1, False, False)

            maxpool = self.max_pool_layer('pool', x, 3, 1)
            conv_pool_reduce = self.conv_layer('conv_pool_reduce', maxpool, 1, 1, out_pool, False, False)

            return tf.nn.leaky_relu(tf.concat(axis=3, values=[conv_1x1, conv_3x1, conv_5x1, conv_pool_reduce]))
