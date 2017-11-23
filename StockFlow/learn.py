import tensorflow as tf

def Learn(x_train, y_train):

	# Model parameters
	W = tf.Variable([.3], dtype=tf.float32)
	b = tf.Variable([-.3], dtype=tf.float32)

	# Model input and output
	x = tf.placeholder(tf.float32)
	y = tf.placeholder(tf.float32)
	
	linear_model = W*x + b
	
	# loss
	loss = tf.reduce_sum(tf.square(linear_model - y)) # sum of the squares

	# optimizer
	optimizer = tf.train.GradientDescentOptimizer(0.01)
	train = optimizer.minimize(loss)
	
	# training loop
	init = tf.global_variables_initializer()
	sess = tf.Session()
	sess.run(init)
	for i in range(1000):
		sess.run(train, {x: x_train, y: y_train})
	
	# evaluate training accuracy
	curr_W, curr_b, curr_loss = sess.run([W, b, loss], {x: x_train, y: y_train})
	
	return [curr_W, curr_b, curr_loss]