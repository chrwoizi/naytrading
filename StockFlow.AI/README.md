# StockFlow.AI #
This is the machine learning part of [StockFlow](https://github.com/chrwoizi/stockflow).

## :mortar_board: Training a Convolutional Neural Network on the recorded data ##

<details>
<summary>How to install StockFlow.AI</summary>

Install [Python 3.6](https://www.python.org/downloads/release/python-366/). Include PIP if asked by the setup.

If you have an NVIDIA graphics card: Follow the instructions by [NVIDIA](https://www.nvidia.com/en-us/data-center/gpu-accelerated-applications/tensorflow/) to install CUDA and cuDNN.

Install the python modules:
```sh
# install modules for training (Used by main.py)
root@host:~$ pip install numpy
root@host:~$ pip install tensorflow
root@host:~$ pip install tensorflow-gpu
root@host:~$ pip install matplotlib

# install modules for running the trained model as a StockFlow AI account (Used by client.py)
root@host:~$ pip install requests

# install modules for generating synthetic data (Optional. Used by synth.py)
root@host:~$ pip install noise
```
<p></p>

Download the sources of [StockFlow.AI](https://github.com/chrwoizi/stockflow/tree/master/StockFlow.AI) and [StockFlow.Common](https://github.com/chrwoizi/stockflow/tree/master/StockFlow.Common) or the whole [StockFlow](https://github.com/chrwoizi/stockflow/tree/master) repository.

</details>

Go to your account page ([use this link if you are logged into stockflow.net](http://stockflow.net/manage)) and download your processed trade decisions as CSV files using the download buttons in the *Export preprocessed training data for neural networks* section.
Save the files in the StockFlow.AI folder (next to the main.py file).

Run [main_buying_train_norm.bat](https://github.com/chrwoizi/stockflow/blob/master/StockFlow.AI/main_buying_train_norm.bat) or [main_selling_train_norm.bat](https://github.com/chrwoizi/stockflow/blob/master/StockFlow.AI/main_selling_train_norm.bat).

A folder with the name modelXXX will be created where XXX is the current time. Open that folder and run *tensorboard.bat*. Go to [Tensorboard](http://localhost:6006/#scalars&run=log%5Ctrain&_smoothingWeight=0&tagFilter=%5Eloss%24%7C%5Eloss%2Fcombined%7C(buy%7Csell)s_detected%7C(buy%7Csell)s_correct&_ignoreYOutliers=false) to monitor the training progress.

In the top section of Tensorboard it will show three red graphs. These are the statistics of how well your trained network performs on the training data.
- The graph containing the word *loss* in its title (e.g. *loss/combined/value*) shows a metric about how different the network's current decision making is from the given training data. This will go down over time. 0 meaning that the trained network reproduces all given decisions correctly.
- The graph containing the word *buys_correct* or *sells_correct* in its title (e.g. *imitations/buys_correct/value*) shows a metric about how many buy or sell decisions by the trained network are also buy or sell decisions in your training data. The values range between 0 and 1. 1 meaning that 100% of the network's buy or sell decisions are (presumably) correct.
- The graph containing the word *buys_detected* or *sells_detected* in its title (e.g. *imitations/buys_detected/value*) shows a metric about how many of your buy or sell decisions were also classified as buy or sell by the trained network. The values range between 0 and 1. 1 meaning that 100% of your buy or sell decisions were reproduced by the trained network.

Later, when the first evaluation of the trained model occurs (automatically), three blue graphs will appear. These are the statistics of how well your trained network performs on unseen data (the evaluation CSV file). You want this to be as good as possible. If your network performs poorly, you need more training data.

The training optimum is reached when the blue loss curve is at its lowest point. You need to estimate that by observing Tensorboard regularly throughout the training process. It takes a couple of minutes between updates of the curve, so don't feel rushed. 

Training is a hardware demanding process. If you are using a graphics card, it can take hours or days to reach the optimum. If you are only using your CPU, good luck ;).
