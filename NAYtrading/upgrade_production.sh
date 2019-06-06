#!/bin/sh
killall production.sh
killall node
cd ..
git pull
cd NAYtrading
npm install
npm run build
chmod +x dbmigrate.sh
./dbmigrate.sh
./production.sh &