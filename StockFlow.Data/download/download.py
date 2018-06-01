import os
import glob
import argparse
import sys
import re
import getpass
import datetime

sys.path.append(os.path.abspath('..\\..\\StockFlow.Common'))
from WriteFileProgress import *
from StockFlow import *
from KillFileMonitor import *

parser = argparse.ArgumentParser()

parser.add_argument('--proxy_url', type=str, default='', help='Proxy URL.')
parser.add_argument('--proxy_user', type=str, default='', help='Proxy user.')
parser.add_argument('--proxy_password', type=str, default='', help='Proxy password.')
parser.add_argument('--stockflow_url', type=str, default='http://stockflow.net', help='StockFlow base url.')
parser.add_argument('--stockflow_user', type=str, default='', help='StockFlow user.')
parser.add_argument('--stockflow_password', type=str, default='', help='StockFlow password.')
parser.add_argument('--output_dir', type=str, default='data', help='Output directory.')

def main(proxy_url, proxy_user, proxy_password, stockflow_url, stockflow_user, stockflow_password, output_dir):

    if len(proxy_user) > 0 and len(proxy_password) == 0:
        proxy_password = getpass.getpass(prompt = 'Proxy Password: ')

    if len(stockflow_user) == 0:
        stockflow_user = input("StockFlow User: ")

    if len(stockflow_password) == 0:
        stockflow_password = getpass.getpass(prompt = 'StockFlow Password: ')

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    kill_path = output_dir + '\\kill'
    killfile_monitor = KillFileMonitor(kill_path, 1)

    max_date = datetime.datetime.min
    mask = os.path.abspath(output_dir) + '\\*.json'
    for filename in glob.iglob(mask):
        killfile_monitor.maybe_check_killfile()
        search = re.search('[^\d]+(\d+).json$', filename, re.IGNORECASE)
        if search:
            date = datetime.datetime.strptime(search.group(1), '%Y%m%d%H%M%S')
            max_date = max(max_date, date)

    now = datetime.datetime.utcnow()
    out_path = output_dir + '\\' + now.strftime('%Y%m%d%H%M%S') + '.json'
    max_date_str = max_date.strftime('%Y-%m-%d %H:%M:%S')

    print('Logging in at StockFlow')
    stockflow = StockFlow(proxy_url, proxy_user, proxy_password, stockflow_url)
    stockflow.login(stockflow_user, stockflow_password)

    killfile_monitor.maybe_check_killfile()

    print('Counting snapshots from %s' % (max_date_str))
    count = stockflow.count_snapshots(max_date)

    killfile_monitor.maybe_check_killfile()

    progress = WriteFileProgress(1)
    def report_progress(bytes):
        progress.set_items(bytes)
        progress.maybe_print()
        killfile_monitor.maybe_check_killfile()

    print('Downloading %d snapshots from %s to %s' % (count, max_date_str, out_path))
    out_path_temp = out_path + '.incomplete'
    try:
        stockflow.export_snapshots(max_date, out_path_temp, report_progress)

        if os.path.exists(out_path):
            os.remove(out_path)
        os.rename(out_path_temp, out_path)

        is_empty = False
        with open(out_path) as f:
            chars = f.read(2)
            if chars == "[]":
                is_empty = True

        if is_empty:
            print('No new snapshots available.')
            os.remove(out_path)

        print('Done.')

    except KilledException:
        killfile_monitor.delete_killfile()
        if os.path.exists(out_path_temp):
            os.remove(out_path_temp)
        print('Killed.')


if __name__ == '__main__':
    FLAGS, unparsed = parser.parse_known_args()

    main(proxy_url=FLAGS.proxy_url,
         proxy_user=FLAGS.proxy_user,
         proxy_password=FLAGS.proxy_password,
         stockflow_url=FLAGS.stockflow_url,
         stockflow_user=FLAGS.stockflow_user,
         stockflow_password=FLAGS.stockflow_password,
         output_dir=FLAGS.output_dir)
