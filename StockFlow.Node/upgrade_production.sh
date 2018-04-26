#!/bin/sh
killall production.sh
killall node
cd ..
git pull
cd StockFlow.Node
chmod +x dbmigrate.sh
./dbmigrate.sh
./production.sh &