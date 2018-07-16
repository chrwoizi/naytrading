import tensorflow as tf


class Data(object):
    def __init__(self, file, batch_size, buy_label, first_day, last_day, repeat, other_features, shuffle):
        self.batch_size = batch_size

        column_defaults = [['0'], ['0'], ['0'], ['wait'], ['19700101']] + [[0.00] for i in range(first_day, last_day + 1)] + [[0.00] for i in range(0, other_features)]

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
                features = shape_features(features, other_features)

                labels = tf.cast(tf.equal(labels, buy_label), dtype = tf.int32)
                labels = tf.one_hot(indices = labels, depth = 2, on_value = 1.0, off_value = 0.0, axis = -1)

                return features, labels

            print('Preparing data: TextLineDataset')
            dataset = tf.data.TextLineDataset(file).skip(1)

            print('Preparing data: map')
            dataset = dataset.map(parse_csv, num_parallel_calls = 5)

            print('Preparing data: batch/prefetch/cache')
            self.dataset = dataset.batch(batch_size).prefetch(self.count).cache().repeat(repeat)
            if shuffle:
                self.dataset = self.dataset.shuffle(self.count)

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


def get_invested_diff(rates, other, rates_len, buy_day_index):
    buy_day = tf.cast(other[buy_day_index:buy_day_index + 1], tf.int32)
    buy_rate = tf.gather(rates, buy_day)

    invested = tf.cast(tf.greater(tf.range(0, rates_len), tf.cast(buy_day, tf.int32)), tf.float32)
    buy_rate_repeated = tf.tile(buy_rate, [rates_len])
    diff = tf.subtract(rates, buy_rate_repeated)
    invested_diff = tf.add(float(0.5), tf.divide(tf.multiply(invested, diff), float(2)))

    return invested_diff


def shape_features(features, other_features):
    rates_len = features.get_shape()[0] - other_features
    rates = features[:rates_len]
    other = features[rates_len:rates_len + other_features]

    dimensions = [rates]

    if other_features == 1:
        invested_diff = get_invested_diff(rates, other, rates_len, 0)
        dimensions += [invested_diff]

    features = tf.stack(dimensions, 1)

    features = tf.reshape(features, [rates_len, 1, len(dimensions)])

    return features
