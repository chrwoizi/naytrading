import os
import glob
import argparse
import sys
import re
import getpass
import datetime

sys.path.append(os.path.abspath('..\\..\\NAYtrading.Common'))
from FileBinaryProgress import *
from NAYtrading import *
from KillFileMonitor import *

parser = argparse.ArgumentParser()

parser.add_argument('--proxy_url', type=str, default='', help='Proxy URL.')
parser.add_argument('--proxy_user', type=str, default='', help='Proxy user.')
parser.add_argument('--proxy_password', type=str, default='', help='Proxy password.')
parser.add_argument('--naytrading_url', type=str, default='http://naytrading.com', help='NAYtrading base url.')
parser.add_argument('--naytrading_user', type=str, default='', help='NAYtrading user.')
parser.add_argument('--naytrading_password', type=str, default='', help='NAYtrading password.')
parser.add_argument('--output_dir', type=str, default='data', help='Output directory.')

def main(proxy_url, proxy_user, proxy_password, naytrading_url, naytrading_user, naytrading_password, output_dir):

    if len(proxy_user) > 0 and len(proxy_password) == 0:
        proxy_password = getpass.getpass(prompt = 'Proxy Password: ')

    if len(naytrading_user) == 0:
        naytrading_user = input("NAYtrading User: ")

    if len(naytrading_password) == 0:
        naytrading_password = getpass.getpass(prompt = 'NAYtrading Password: ')

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

    print('Logging in at NAYtrading')
    naytrading = NAYtrading(proxy_url, proxy_user, proxy_password, naytrading_url)
    naytrading.login(naytrading_user, naytrading_password)

    killfile_monitor.maybe_check_killfile()

    print('Counting snapshots from %s' % (max_date_str))
    count = naytrading.count_snapshots(max_date)

    killfile_monitor.maybe_check_killfile()

    progress = FileBinaryProgress('download: ', 1, out_path, None)
    def report_progress(bytes):
        progress.set_items(bytes)
        progress.maybe_print()
        killfile_monitor.maybe_check_killfile()

    print('Downloading %d snapshots from %s to %s' % (count, max_date_str, out_path))
    out_path_temp = out_path + '.incomplete'
    try:
        naytrading.export_snapshots(max_date, out_path_temp, report_progress)

        if os.path.exists(out_path):
            os.remove(out_path)
        os.rename(out_path_temp, out_path)

        is_empty = False
        with open(out_path, 'r', encoding='utf8') as f:
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
         naytrading_url=FLAGS.naytrading_url,
         naytrading_user=FLAGS.naytrading_user,
         naytrading_password=FLAGS.naytrading_password,
         output_dir=FLAGS.output_dir)