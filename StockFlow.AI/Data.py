import tensorflow as tf


class Data(object):
    def __init__(self, file, batch_size, buy_label, first_day, last_day, repeat):
        self.batch_size = batch_size

        column_defaults = [['0'], ['0'], ['0'], ['ignore'], ['19700101']] + [[0.00] for i in range(first_day, last_day + 1)]

        with tf.name_scope('data'):

            assert tf.gfile.Exists(file), ('%s not found.' % file)

            file_count = self.__get_line_count(file)

            if file_count < self.batch_size:
                print('WARNING: batch_size is greater than available datasets. Reducing batch size to %d' % file_count)
                self.batch_size = file_count

            self.batches = int(file_count / self.batch_size)

            self.count = self.batches * self.batch_size

            def parse_csv(value):
                columns = tf.decode_csv(value, record_defaults = column_defaults, field_delim = ";")

                features = columns[5:len(columns)]
                labels = columns[3]

                features = tf.stack(features)
                features = tf.reshape(features, [features.get_shape()[0], 1, 1])

                labels = tf.cast(tf.equal(labels, buy_label), dtype = tf.int32)
                labels = tf.one_hot(indices = labels, depth = 2, on_value = 1.0, off_value = 0.0, axis = -1)

                return features, labels

            print('Preparing data: TextLineDataset')
            dataset = tf.data.TextLineDataset(file).skip(1)

            print('Preparing data: map')
            dataset = dataset.map(parse_csv, num_parallel_calls = 5)

            print('Preparing data: batch/prefetch/cache')
            self.dataset = dataset.batch(batch_size).prefetch(self.count).cache().repeat(repeat)

    def __get_line_count(self, file):

        count = 0
        with open(file, 'r', encoding = 'utf8') as f:
            i = 0
            while True:
                line = f.readline()
                if not line:
                    break
                if i > 0 and len(line) > 0:
                    count = count + 1
                i = i + 1

        return count
