from __future__ import absolute_import
from __future__ import division
from __future__ import print_function

import os
import glob
import argparse
import sys
import re
import getpass
import datetime

sys.path.append(os.path.abspath('..\\..\\StockFlow.Common'))
from StockFlow import StockFlow

parser = argparse.ArgumentParser()

parser.add_argument('--proxy_url', type=str, default='', help='Proxy URL.')
parser.add_argument('--proxy_user', type=str, default='', help='Proxy user.')
parser.add_argument('--proxy_password', type=str, default='', help='Proxy password.')
parser.add_argument('--stockflow_url', type=str, default='http://stockflow.net', help='StockFlow base url.')
parser.add_argument('--stockflow_user', type=str, default='', help='StockFlow user.')
parser.add_argument('--stockflow_password', type=str, default='', help='StockFlow password.')


def main(proxy_url, proxy_user, proxy_password, stockflow_url, stockflow_user, stockflow_password):
    """
    :param int proxy_url: Proxy URL
    :param int proxy_user: Proxy user
    :param int proxy_password: Proxy password
    :param int stockflow_url: StockFlow base url
    :param str stockflow_user: StockFlow user
    :param str stockflow_password: StockFlow password
    """

    if len(proxy_user) > 0 and len(proxy_password) == 0:
        proxy_password = getpass.getpass(prompt = 'Proxy Password: ')

    if len(stockflow_user) == 0:
        stockflow_user = input("StockFlow User: ")

    if len(stockflow_password) == 0:
        stockflow_password = getpass.getpass(prompt = 'StockFlow Password: ')

    if not os.path.exists('data'):
        os.makedirs('data')

    max_date = datetime.datetime.min
    mask = os.path.abspath('data') + '\\*.json'
    for filename in glob.iglob(mask):
        search = re.search('[^\d]+(\d+).json$', filename, re.IGNORECASE)
        if search:
            date = datetime.datetime.strptime(search.group(1), '%Y%m%d%H%M%S')
            max_date = max(max_date, date)

    stockflow = StockFlow(proxy_url, proxy_user, proxy_password, stockflow_url)

    print('Logging in at StockFlow')
    stockflow.login(stockflow_user, stockflow_password)

    now = datetime.datetime.utcnow()
    out_path = 'data\\' + now.strftime('%Y%m%d%H%M%S') + '.json'
    max_date_str = max_date.strftime('%Y-%m-%d %H:%M:%S')
    print('Downloading snapshots from %s to %s' % (max_date_str, out_path))
    stockflow.export_snapshots(max_date, out_path)

    is_empty = False
    with open(out_path) as f:
        chars = f.read(2)
        if chars == "[]":
            is_empty = True

    if is_empty:
        print('No new snapshots available.')
        os.remove(out_path)

    print('Done.')


if __name__ == '__main__':
    FLAGS, unparsed = parser.parse_known_args()

    main(proxy_url=FLAGS.proxy_url,
         proxy_user=FLAGS.proxy_user,
         proxy_password=FLAGS.proxy_password,
         stockflow_url=FLAGS.stockflow_url,
         stockflow_user=FLAGS.stockflow_user,
         stockflow_password=FLAGS.stockflow_password)
