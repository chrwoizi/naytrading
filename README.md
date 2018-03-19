# StockFlow
StockFlow is a machine learning application that mimics stock trading decisions of the user. 

The user's analysis philosophy must be purely technical, i.e. the only resource data for a buy/sell decision is the price history of the past 5 years. No stock name, no news, no ratings.

The website StockFlow.Web shows current stock charts to the users and lets them choose whether to buy, ignore, or sell the stock. The price history and the decision are stored in a database. 

In StockFlow.Python, a convolutional neural network is trained on the recorded data, using the price history as input and the user decision as desired output.

Currently, I am trying to record trade decisions to have enough training data for selecting a suitable network architecture. This may take a few months.

Down the road, current stock prices are going to be fed into the network regularly to find stocks that can be bought or sold based on the user's analysis pattern.

Meanwhile, the console application StockFlow.Trader can be used to actually buy or sell the stocks based on the recorded user decisions.
