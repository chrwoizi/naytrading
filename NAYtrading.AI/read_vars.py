import argparse
import glob
import re
from tensorflow.python import pywrap_tensorflow

parser = argparse.ArgumentParser()
parser.add_argument('--checkpoint_dir', type=str, default='model20180607082346/checkpoint', help='Model checkpoint directory.')
FLAGS, unparsed = parser.parse_known_args()

ckpt_file = FLAGS.checkpoint_dir + '\\'

i = -1
for filename in glob.iglob(ckpt_file + "model.ckpt-*.meta", recursive=True):
    search = re.search('model\.ckpt-(\d+).meta$', filename, re.IGNORECASE)
    if search:
        i = max(i, int(search.group(1)))

if i >= 0:
    ckpt_file = ckpt_file + 'model.ckpt-' + str(i)
    print('Using %s' % ckpt_file)
else:
    raise Exception('checkpoint not found')

reader = pywrap_tensorflow.NewCheckpointReader(ckpt_file)
var_to_shape_map = reader.get_variable_to_shape_map()

for key in sorted(var_to_shape_map):
    print("tensor_name: ", key)