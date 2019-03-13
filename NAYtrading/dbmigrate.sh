#!/bin/sh
cd app
export NODE_ENV=production
sequelize db:migrate --config config/database.json