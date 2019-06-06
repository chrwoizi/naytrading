#!/bin/sh
cd server
export NODE_ENV=production
sequelize db:migrate --config config/database.json