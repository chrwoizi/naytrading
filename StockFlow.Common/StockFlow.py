import requests

class StockFlow:

    def __init__(self, proxy_url, proxy_user, proxy_password, stockflow_url):
        if len(proxy_url) > 0:
            if len(proxy_user) > 0:
                self.proxies = {
                    'http': proxy_url % (proxy_user, proxy_password)
                }
            else:
                self.proxies = {
                    'http': proxy_url
                }
        else:
            self.proxies = None

        self.stockflow_url = stockflow_url

        self.session = requests.Session()


    def login(self, stockflow_user, stockflow_password):
        url = self.stockflow_url + '/signin'

        r = self.session.post(url, {
            'email': stockflow_user,
            'password': stockflow_password
        }, proxies = self.proxies)

        if r.status_code != 200:
            raise Exception('%s returned %d' % (url, r.status_code))


    def new_snapshot(self):
        url = self.stockflow_url + '/api/snapshot/new/random'
        r = self.session.get(url, proxies = self.proxies, timeout = 30)

        if r.status_code != 200:
            raise Exception('%s returned %d' %(url, r.status_code))

        data = r.json()
        return data


    def set_decision(self, snapshot_id, decision):
        url = self.stockflow_url + '/api/snapshot/%d/set/%s'
        r = self.session.get(url % (snapshot_id, decision), proxies = self.proxies, timeout = 30)

        if r.status_code != 200:
            raise Exception('%s returned %d' % (url, r.status_code))

        data = r.json()

        if 'status' not in data:
            raise Exception('%s returned no status' % (url))

        if data['status'] != 'ok':
            raise Exception('%s returned status %d' % (url, data['status']))


    def export_snapshots(self, from_date, file_path, report_progress):
        url = self.stockflow_url + '/api/export/user/snapshots/' + from_date.strftime('%Y%m%d%H%M%S')
        r = self.session.get(url, proxies = self.proxies, timeout = 600, stream = True)

        if r.status_code != 200:
            raise Exception('%s returned %d' %(url, r.status_code))

        with open(file_path, 'wb') as f:
            for chunk in r.iter_content(chunk_size = 1024):
                if chunk:  # filter out keep-alive new chunks
                    report_progress(f.tell())
                    f.write(chunk)

    def count_snapshots(self, from_date):
        url = self.stockflow_url + '/api/count/snapshots/' + from_date.strftime('%Y%m%d%H%M%S')
        r = self.session.get(url, proxies = self.proxies, timeout = 600)

        if r.status_code != 200:
            raise Exception('%s returned %d' %(url, r.status_code))

        return int(r.text)