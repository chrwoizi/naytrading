#!/bin/sh
sudo apt-get -y install libssl-dev openssl
sudo apt-get -y install build-essential checkinstall
sudo apt-get -y install libreadline-gplv2-dev libncursesw5-dev libssl-dev openssl libsqlite3-dev tk-dev libgdbm-dev libc6-dev libbz2-dev libpq-dev zlib1g-dev
sudo apt-get -y install libssl1.0-dev
export CFLAGS="-I/usr/local/opt/openssl/include -L/usr/local/opt/openssl/lib -I/usr/local/opt/zlib/include -L/usr/local/opt/zlib/lib"
wget https://www.python.org/ftp/python/3.4.9/Python-3.4.9.tar.xz
tar xf Python-3.4.9.tar.xz
cd Python-3.4.9
./configure
make -j4
sudo make altinstall
sudo pip3.4 install requests
sudo pip3.4 install tensorflow
