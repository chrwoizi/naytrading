#!/bin/bash
set -e

rm -rf ./dist/src
rm -rf ./dist/plugins

npx tsc

cp -r src/config/*.json ./dist/src/config/
cp -r src/sql/*.sql ./dist/src/sql/

mkdir -p ./dist/src/processor
cp -r src/processor/*.py ./dist/src/processor/

cp -r plugins ./dist/
