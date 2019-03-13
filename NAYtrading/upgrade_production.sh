#!/bin/sh
killall production.sh
killall node
cd ..
git pull
cd NAYtrading
npm install
chmod +x dbmigrate.sh
./dbmigrate.sh
./production.sh &