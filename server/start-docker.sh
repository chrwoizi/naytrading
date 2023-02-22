#!/bin/sh
set -e
npx sequelize db:migrate --config ./src/config/database.json
node ./src/server.js
