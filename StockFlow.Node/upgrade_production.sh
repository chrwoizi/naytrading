#!/bin/sh
killall production.sh
killall node
rm production.sh
rm upgrade_production.sh
cd ..
git pull
cd StockFlow.Node
chmod +x production.sh
chmod +x upgrade_production.sh
./production.sh &