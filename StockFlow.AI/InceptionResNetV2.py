
import tensorflow as tf
import numpy as np
from NetworkBase import NetworkBase

class InceptionResNetV2(NetworkBase):

    def __init__(self, summary_level, features, labels, mode, options):
        super().__init__(summary_level, features, labels, mode, options)

        self.residual_scale = tf.constant(options["residual_scale"], dtype=tf.float32, shape=())

        stem = self.__inception_resnet_stem(self.x)

        with tf.name_scope('inception_resnet_a'):
            inception_resnet_a_1 = self.__inception_resnet_a(stem, 1)
            inception_resnet_a_2 = self.__inception_resnet_a(inception_resnet_a_1, 2)
            inception_resnet_a_3 = self.__inception_resnet_a(inception_resnet_a_2, 3)
            inception_resnet_a_4 = self.__inception_resnet_a(inception_resnet_a_3, 4)
            inception_resnet_a_5 = self.__inception_resnet_a(inception_resnet_a_4, 5)

        reduction_a = self.__inception_resnet_reduction_a(inception_resnet_a_5)

        with tf.name_scope('inception_resnet_b'):
            inception_resnet_b_1 = self.__inception_resnet_b(reduction_a, 1)
            inception_resnet_b_2 = self.__inception_resnet_b(inception_resnet_b_1, 2)
            inception_resnet_b_3 = self.__inception_resnet_b(inception_resnet_b_2, 3)
            inception_resnet_b_4 = self.__inception_resnet_b(inception_resnet_b_3, 4)
            inception_resnet_b_5 = self.__inception_resnet_b(inception_resnet_b_4, 5)
            inception_resnet_b_6 = self.__inception_resnet_b(inception_resnet_b_5, 6)
            inception_resnet_b_7 = self.__inception_resnet_b(inception_resnet_b_6, 7)
            inception_resnet_b_8 = self.__inception_resnet_b(inception_resnet_b_7, 8)
            inception_resnet_b_9 = self.__inception_resnet_b(inception_resnet_b_8, 9)
            inception_resnet_b_10 = self.__inception_resnet_b(inception_resnet_b_9, 10)

        reduction_b = self.__inception_resnet_reduction_b(inception_resnet_b_10)

        with tf.name_scope('inception_resnet_c'):
            inception_resnet_c_1 = self.__inception_resnet_c(reduction_b, 1)
            inception_resnet_c_2 = self.__inception_resnet_c(inception_resnet_c_1, 2)
            inception_resnet_c_3 = self.__inception_resnet_c(inception_resnet_c_2, 3)
            inception_resnet_c_4 = self.__inception_resnet_c(inception_resnet_c_3, 4)
            inception_resnet_c_5 = self.__inception_resnet_c(inception_resnet_c_4, 5)

        average_pooling = self.avg_pool_layer('average_pooling', inception_resnet_c_5, 4, 1, padding='VALID')

        dropout = tf.nn.dropout(average_pooling, self.fc_dropout_keep, name='dropout')

        self.exit = self.full_layer('exit', dropout, 2, False)

        if mode == tf.estimator.ModeKeys.PREDICT:
            with tf.variable_scope('predict'):
                self.exit_argmax = tf.argmax(self.exit, 1)
                if self.summary_level >= 1:
                    tf.summary.scalar('value', self.exit_argmax)

        else:
            with tf.variable_scope('loss'):
                y_sg = tf.stop_gradient(self.y)
                softmax_exit = tf.nn.softmax_cross_entropy_with_logits_v2(labels=y_sg, logits=self.exit)
                self.loss = tf.reduce_mean(softmax_exit)
                if self.summary_level >= 1:
                    tf.summary.scalar('value', self.loss)

            with tf.variable_scope('accuracy'):
                self.exit_argmax = tf.argmax(self.exit, 1)
                self.y_argmax = tf.argmax(self.y, 1)
                self.correct_prediction = tf.equal(self.exit_argmax, self.y_argmax)
                self.accuracy = tf.reduce_mean(tf.cast(self.correct_prediction, tf.float32))
                if self.summary_level >= 1:
                    tf.summary.scalar('value', self.accuracy)

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

    def resnet_sum(self, x, residual):
        residual_scaled = tf.divide(residual, self.residual_scale, 'scale')
        sum1 = tf.add(residual_scaled, x, 'addition')
        return sum1

    def __inception_resnet_stem(self, x):

        with tf.name_scope('stem'):
            layer1_a1 = self.conv_layer('layer1_a1', x, 3, 2, 32, True, True, padding='VALID')
            layer1_a2 = self.conv_layer('layer1_a2', layer1_a1, 3, 1, 32, True, True, padding='VALID')
            layer1_a3 = self.conv_layer('layer1_a3', layer1_a2, 3, 1, 64, True, True)

            layer1_aa4 = self.max_pool_layer('layer1_aa4', layer1_a3, 3, 2, padding='VALID')

            layer1_ab4 = self.conv_layer('layer1_ab4', layer1_a3, 3, 2, 96, True, True, padding='VALID')

            filter1_a1 = tf.concat(axis=3, values=[layer1_aa4, layer1_ab4])
            filter1_a2 = tf.nn.leaky_relu(filter1_a1)

            layer2_a1 = self.conv_layer('layer2_a1', filter1_a2, 1, 1, 64, True, True)
            layer2_a2 = self.conv_layer('layer2_a2', layer2_a1, 3, 1, 96, True, True, padding='VALID')

            layer2_b1 = self.conv_layer('layer2_b1', filter1_a2, 1, 1, 64, True, True)
            layer2_b2 = self.conv_layer('layer2_b2', layer2_b1, 7, 1, 64, True, True)
            layer2_b3 = self.conv_layer('layer2_b3', layer2_b2, 1, 1, 64, True, True)
            layer2_b4 = self.conv_layer('layer2_b4', layer2_b3, 3, 1, 96, True, True, padding='VALID')

            filter2_a1 = tf.concat(axis=3, values=[layer2_a2, layer2_b4])
            filter2_a2 = tf.nn.leaky_relu(filter2_a1)

            layer3_a1 = self.conv_layer('layer3_a1', filter2_a2, 3, 2, 192, True, True, padding='VALID')

            layer3_b1 = self.max_pool_layer('layer3_b1', filter2_a2, 3, 2, padding='VALID')

            filter3_a1 = tf.concat(axis=3, values=[layer3_a1, layer3_b1])
            filter3_a2 = tf.nn.leaky_relu(filter3_a1)

            return filter3_a2

    def __inception_resnet_reduction_a(self, x):

        with tf.name_scope('reduction_a'):
            layer1_a1 = self.max_pool_layer('layer1_a1', x, 3, 2, padding='VALID')

            layer1_b1 = self.conv_layer('layer1_b1', x, 3, 2, 384, True, True, padding='VALID')

            layer1_c1 = self.conv_layer('layer1_c1', x, 1, 1, 256, True, True)
            layer1_c2 = self.conv_layer('layer1_c2', layer1_c1, 3, 1, 256, True, True)
            layer1_c3 = self.conv_layer('layer1_c3', layer1_c2, 3, 2, 384, True, True, padding='VALID')

            filter1_a1 = tf.concat(axis=3, values=[layer1_a1, layer1_b1, layer1_c3])
            filter1_a2 = tf.nn.leaky_relu(filter1_a1)

            return filter1_a2

    def __inception_resnet_reduction_b(self, x):

        with tf.name_scope('reduction_b'):
            layer1_a1 = self.max_pool_layer('layer1_a1', x, 3, 2, padding='VALID')

            layer1_b1 = self.conv_layer('layer1_b1', x, 1, 1, 256, True, True)
            layer1_b2 = self.conv_layer('layer1_b2', layer1_b1, 3, 2, 384, True, True, padding='VALID')

            layer1_c1 = self.conv_layer('layer1_c1', x, 1, 1, 256, True, True)
            layer1_c2 = self.conv_layer('layer1_c2', layer1_c1, 3, 2, 256, True, True, padding='VALID')

            layer1_d1 = self.conv_layer('layer1_d1', x, 1, 1, 256, True, True)
            layer1_d2 = self.conv_layer('layer1_d2', layer1_d1, 3, 1, 256, True, True)
            layer1_d3 = self.conv_layer('layer1_d3', layer1_d2, 3, 2, 256, True, True, padding='VALID')

            filter1_a1 = tf.concat(axis=3, values=[layer1_a1, layer1_b2, layer1_c2, layer1_d3])
            filter1_a2 = tf.nn.leaky_relu(filter1_a1)

            return filter1_a2

    def __inception_resnet_a(self, x, index):

        with tf.name_scope('inception_resnet_a_' + str(index)):
            layer1_a1 = self.conv_layer('layer1_a1', x, 1, 1, 32, True, True)

            layer1_b1 = self.conv_layer('layer1_b1', x, 1, 1, 32, True, True)
            layer1_b2 = self.conv_layer('layer1_b2', layer1_b1, 3, 1, 32, True, True)

            layer1_c1 = self.conv_layer('layer1_c1', x, 1, 1, 32, True, True)
            layer1_c2 = self.conv_layer('layer1_c2', layer1_c1, 3, 1, 48, True, True)
            layer1_c3 = self.conv_layer('layer1_c3', layer1_c2, 3, 1, 64, True, True)

            layer1_concat = tf.concat(axis=3, values=[layer1_a1, layer1_b2, layer1_c3])

            layer2_a1 = self.conv_layer('layer2_a1', layer1_concat, 1, 1, 384, False, False)

            sum1 = self.resnet_sum(x, layer2_a1)

            relu2_a1 = tf.nn.leaky_relu(sum1, name='relu2_a1')

            return relu2_a1

    def __inception_resnet_b(self, x, index):

        with tf.name_scope('inception_resnet_b_' + str(index)):
            layer1_a1 = self.conv_layer('layer1_a1', x, 1, 1, 192, True, True)

            layer1_b1 = self.conv_layer('layer1_b1', x, 1, 1, 128, True, True)
            layer1_b2 = self.conv_layer('layer1_b2', layer1_b1, 1, 1, 160, True, True)
            layer1_b3 = self.conv_layer('layer1_b3', layer1_b2, 1, 1, 192, True, True)

            layer1_concat = tf.concat(axis=3, values=[layer1_a1, layer1_b3])

            layer2_a1 = self.conv_layer('layer2_a1', layer1_concat, 1, 1, 1152, False, False)

            sum1 = self.resnet_sum(x, layer2_a1)

            relu2_a1 = tf.nn.leaky_relu(sum1, name='relu2_a1')

            return relu2_a1

    def __inception_resnet_c(self, x, index):

        with tf.name_scope('inception_resnet_c_' + str(index)):
            layer1_a1 = self.conv_layer('layer1_a1', x, 1, 1, 192, True, True)

            layer1_b1 = self.conv_layer('layer1_b1', x, 1, 1, 128, True, True)
            layer1_b2 = self.conv_layer('layer1_b2', layer1_b1, 1, 1, 224, True, True)
            layer1_b3 = self.conv_layer('layer1_b3', layer1_b2, 1, 1, 256, True, True)

            layer1_concat = tf.concat(axis=3, values=[layer1_a1, layer1_b3])

            layer2_a1 = self.conv_layer('layer2_a1', layer1_concat, 1, 1, 2048, False, False)

            sum1 = self.resnet_sum(x, layer2_a1)

            relu2_a1 = tf.nn.leaky_relu(sum1, name='relu2_a1')

            return relu2_a1
