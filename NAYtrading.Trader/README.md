# NAYtrading.Trader #
This is the broker connector of [naytrading.com](http://naytrading.com).

## :telephone: Forwarding the simulated trades to a broker ##

This web application can be used to actually buy or sell the stocks based on the recorded user decisions.

<details>
<summary>How to install</summary>

NAYtrading.Trader needs a custom broker client implementation. This repository includes an example plugin in [NAYtrading.Trader.Plugin](NAYtrading.Trader.Plugin) that can be used to quick start the development of such a client.

```sh
# install tools
root@host:~$ apt-get update
root@host:~$ apt-get install sudo
root@host:~$ apt-get install curl
root@host:~$ apt-get install git

# install nodejs
root@host:~$ curl -sL https://deb.nodesource.com/setup_8.x | bash
root@host:~$ apt-get install -y nodejs
root@host:~$ apt-get install -y build-essential
root@host:~$ npm i -g npm
root@host:~$ npm i -g node-autostart

# install chromium-driver
root@host:~$ apt-get install chromium-chromedriver

# redirect port 80 to 5010 and 443 to 5011 (or setup a reverse proxy)
root@host:~$ apt-get install iptables-persistent
root@host:~$ iptables -t nat -I PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 5010
root@host:~$ iptables -t nat -I PREROUTING -p tcp --dport 443 -j REDIRECT --to-port 5011
root@host:~$ iptables-save > /etc/iptables/rules.v4

# create user
root@host:~$ adduser naytrading-trader
[enter secure password]
[leave details empty]
root@host:~$ su naytrading-trader
naytrading-trader@host:/root$ cd ~

# setup naytrading
naytrading-trader@host:~$ git clone https://github.com/chrwoizi/naytrading-trader.git
naytrading-trader@host:~$ cd naytrading-trader
naytrading-trader@host:~/naytrading-trader$ cd NAYtrading.Trader
naytrading-trader@host:~/naytrading-trader/NAYtrading.Trader$ npm install
naytrading-trader@host:~/naytrading-trader/NAYtrading.Trader$ cd app/config
naytrading-trader@host:~/naytrading-trader/NAYtrading.Trader/app/config$ cp config.mandatory.json config.json
naytrading-trader@host:~/naytrading-trader/NAYtrading.Trader/app/config$ vi config.json
[set production.admin_user to your email address]
[set production.proxy if you access the web through a proxy]
[set production.chrome_driver to your chrome driver executable, e.g. /usr/lib/chromium-browser/chromedriver]
[add your custom stock data provider envconfig to the include array, e.g. "../../../NAYtrading.Trader.Plugin/config/envconfig"]
:wq
naytrading-trader@host:~/naytrading-trader/NAYtrading.Trader/app/config$ cd ../..
naytrading-trader@host:~/naytrading-trader/NAYtrading.Trader$ chmod +x production.sh
naytrading-trader@host:~/naytrading-trader/NAYtrading.Trader$ chmod +x upgrade_production.sh

# run naytrading-trader
naytrading-trader@host:~/naytrading-trader/NAYtrading.Trader$ autostart enable -n "naytrading-trader" -p "/home/naytrading-trader/naytrading-trader/NAYtrading.Trader" -c "./production.sh"
naytrading-trader@host:~/naytrading-trader/NAYtrading.Trader$ ./production.sh &

# back to root
naytrading-trader@host:~/naytrading-trader/NAYtrading.Trader$ exit

# optional: activate HTTPS using letsencrypt.org

# if using Debian 8 (otherwise follow the instructions on https://certbot.eff.org)
root@host:~$ echo deb http://ftp.debian.org/debian jessie-backports main>/etc/apt/sources.list.d/jessie-backports.list
root@host:~$ apt-get update
root@host:~$ apt-get install certbot -t jessie-backports

# register with letsencrypt
root@host:~$ su naytrading-trader
naytrading-trader@host:~/naytrading-trader/NAYtrading.Trader$ certbot certonly --config-dir=./letsencrypt/config --logs-dir=./letsencrypt/logs --work-dir=./letsencrypt/work-dir
[select the webroot method]
[enter your email address]
[read and agree to the terms of service]
[enter your domain name]
[select enter a new webroot]
[enter the web root /home/naytrading-trader/naytrading-trader/NAYtrading.Trader/static]

# link the certificate
naytrading-trader@host:~/naytrading-trader/NAYtrading.Trader$ ln -s ../letsencrypt/config/live/[YOUR DOMAIN]/privkey.pem ./keys/privkey.pem
naytrading-trader@host:~/naytrading-trader/NAYtrading.Trader$ ln -s ../letsencrypt/config/live/[YOUR DOMAIN]/cert.pem ./keys/cert.pem
naytrading-trader@host:~/naytrading-trader/NAYtrading.Trader$ ln -s ../letsencrypt/config/live/[YOUR DOMAIN]/chain.pem ./keys/chain.pem

# enable https
naytrading-trader@host:~/naytrading-trader/NAYtrading.Trader$ vi app/config/config.json
[add a new line] "https_enabled": true
:wq
naytrading-trader@host:~/naytrading-trader/NAYtrading.Trader$ killall production.sh
naytrading-trader@host:~/naytrading-trader/NAYtrading.Trader$ killall node
naytrading-trader@host:~/naytrading-trader/NAYtrading.Trader$ ./production.sh &
```
</details><p></p>
