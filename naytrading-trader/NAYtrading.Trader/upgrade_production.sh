#!/bin/sh
killall production.sh
killall node
cd ..
git pull
cd NAYtrading.Trader
npm install
./production.sh &