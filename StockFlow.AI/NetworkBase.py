
import numpy as np
import tensorflow as tf

class NetworkBase:

    def __init__(self, summary_level, train_iter, test_iter):
        self.summary_level = summary_level
        self.fc_dropout_keep = tf.placeholder(tf.float32)
        self.is_train = tf.placeholder(tf.bool)

        with tf.name_scope('input_switch'):
            def get_train_data():
                return train_iter.get_next()

            def get_test_data():
                return test_iter.get_next()

            self.x, self.y = tf.cond(tf.equal(self.is_train, True), lambda: get_train_data(), lambda: get_test_data())

        # days = tf.shape(x)[1]
        # o = tf.one_hot(indices=tf.cast(tf.multiply(tf.reshape(x,[tf.shape(x)[0],days]),100), tf.int32), depth=100, on_value=1.0, off_value=0.0, axis=-1)
        # self.__image_summary('x', o, days, 100, 1)

    def resnet_sum(self, x, residual):
        residual_scaled = tf.divide(residual, self.residual_scale, 'scale')
        sum1 = tf.add(residual_scaled, x, 'addition')
        return sum1

    def exit_layer(self, name, x, dropout_keep):
        with tf.name_scope(name):
            fc1 = self.full_layer('fc1', x, 1024, True)

            fc1_drop = tf.nn.dropout(fc1, dropout_keep)
            if self.summary_level >= 2:
                tf.summary.histogram('fc1_drop', fc1_drop)

            fc2 = self.full_layer('fc2', fc1_drop, 2, False)

            return fc2

    def conv_layer(self, name, in_layer, width, stride, out_dim, relu, batch_norm, padding='SAME'):
        with tf.name_scope(name):
            in_layer_shape = int(in_layer.get_shape()[3])

            initializer = tf.contrib.layers.xavier_initializer(uniform=False)
            W = tf.Variable(initializer([width, 1, in_layer_shape, out_dim]))
            self.variable_summaries('W', W)
            # image_summary('W', W, 5, 1 out_dim)

            initializer = tf.constant_initializer(0.0)
            b = tf.Variable(initializer([out_dim]))
            self.variable_summaries(name, b)

            r = tf.nn.conv2d(in_layer, W, strides=[1, stride, 1, 1], padding=padding, name=name) + b
            if self.summary_level >= 2:
                tf.summary.histogram('r', r)

            result = r

            if batch_norm:
                result = tf.contrib.layers.batch_norm(result, center=True, scale=True, is_training=self.is_train, decay=0.9, updates_collections=None, scope=tf.get_default_graph().get_name_scope())

            if relu:
                result = tf.nn.leaky_relu(result)
                if self.summary_level >= 2:
                    tf.summary.histogram('relu', result)

            return result

    def full_layer(self, name, in_layer, out_dim, relu):
        with tf.name_scope(name):
            in_layer_shape = int(np.prod(in_layer.get_shape()[1:]))

            initializer = tf.contrib.layers.xavier_initializer(uniform=False)
            W = tf.Variable(initializer([in_layer_shape, out_dim]))
            self.variable_summaries('W', W)

            initializer = tf.constant_initializer(0.0)
            b = tf.Variable(initializer([out_dim]))
            self.variable_summaries('b', b)

            in_layer_flat = tf.reshape(in_layer, [-1, in_layer_shape])

            r = tf.matmul(in_layer_flat, W) + b
            if self.summary_level >= 2:
                tf.summary.histogram('r', r)

            if relu:
                r = tf.nn.leaky_relu(r)
                if self.summary_level >= 2:
                    tf.summary.histogram('relu', r)

            return r

    def max_pool_layer(self, name, x, width, stride, padding='SAME'):
        with tf.variable_scope(name):
            pool = tf.nn.max_pool(x, ksize=[1, width, 1, 1], strides=[1, stride, 1, 1], padding=padding, name=name)
            if self.summary_level >= 2:
                tf.summary.histogram('value', pool)
            return pool

    def avg_pool_layer(self, name, x, width, stride, padding='SAME'):
        with tf.variable_scope(name):
            pool = tf.nn.avg_pool(x, ksize=[1, width, 1, 1], strides=[1, stride, 1, 1], padding=padding, name=name)
            if self.summary_level >= 2:
                tf.summary.histogram('value', pool)
            return pool

    def variable_summaries(self, name, var):
        if self.summary_level >= 2:
            with tf.variable_scope(name):
                mean = tf.reduce_mean(var)
                tf.summary.scalar('mean', mean)
                with tf.variable_scope('stddev'):
                    stddev = tf.sqrt(tf.reduce_mean(tf.square(var - mean)))
                tf.summary.scalar('stddev', stddev)
                tf.summary.scalar('max', tf.reduce_max(var))
                tf.summary.scalar('min', tf.reduce_min(var))
                tf.summary.histogram('histogram', var)

    def image_summary(self, name, V, width, height, dimensions):
        V = tf.reshape(V, (tf.shape(V)[0], width, height, dimensions))
        V = tf.transpose(V, (0, 2, 1, 3))
        tf.summary.image(name, V, max_outputs=tf.shape(V)[0])
