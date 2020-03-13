#!/bin/sh
export NODE_ENV=production
node server.js 2>&1 | tee naytrading.log