from tensorflow.python import pywrap_tensorflow
model_path = 'model20180512175033\\checkpoint\\initial'
reader = pywrap_tensorflow.NewCheckpointReader(model_path)
var_to_shape_map = reader.get_variable_to_shape_map()

for key in sorted(var_to_shape_map):
    print("tensor_name: ", key)