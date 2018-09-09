#!/bin/sh
sudo apt-get -y install build-essential checkinstall
sudo apt-get -y install libreadline-gplv2-dev libncursesw5-dev libssl-dev libssl1.0-dev openssl libsqlite3-dev tk-dev libgdbm-dev libc6-dev libbz2-dev libpq-dev zlib1g-dev
wget https://www.python.org/ftp/python/3.4.9/Python-3.4.9.tar.xz
tar xf Python-3.4.9.tar.xz
cd Python-3.4.9
./configure
make
sudo make altinstall
sudo pip3.4 install requests
sudo pip3.4 install tensorflow
