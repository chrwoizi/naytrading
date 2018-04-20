#!/bin/sh
killall production.sh
killall node
cd ..
git pull
cd StockFlow.Node
./production.sh &