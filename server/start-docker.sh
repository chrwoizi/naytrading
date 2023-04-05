#!/bin/sh
set -e
npx sequelize db:migrate --config ./src/config/database.json || true
node ./src/server.js
