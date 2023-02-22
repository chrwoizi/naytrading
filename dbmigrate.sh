#!/bin/sh
cd server
export NODE_ENV=production
npx sequelize db:migrate --config ./src/config/database.json