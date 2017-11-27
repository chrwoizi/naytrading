namespace StockFlow
{
    using System;
    using System.Collections.Generic;
    using System.IO;
    using System.Linq;
    using System.Net;
    using System.Threading;
    using System.Windows;

    using Python.Runtime;

    using StockFlow.Properties;

    using YahooFinanceApi;
    using System.Net.Http;
    using Newtonsoft.Json;

    /// <summary>
    /// Interaction logic for MainWindow.xaml
    /// </summary>
    public partial class MainWindow : Window
    {
        private const string WallstreetOnline = "https://www.***REMOVED***/_rpc/json/instrument/chartdata/loadRawData?q%5BinstId%5D={0}&q%5BmarketId%5D={1}&q%5Bmode%5D=hist&q%5Bts%5D={2}";

        public MainWindow()
        {
            InitializeComponent();
        }
        
        private void ButtonBase_OnClick(object sender, RoutedEventArgs e)
        {
            GetWallstreetOnline("1105", "21");
            return;

            GetHistorical();
            return;

            using (Py.GIL())
            {
                dynamic learn = Py.Import("learn");

                var x_train = ToPyList(new float[] { 1, 2, 3, 4 });
                var y_train = ToPyList(new float[] { 0, -1, -2, -3 });

                dynamic result = learn.Learn(x_train, y_train);
                
                dynamic curr_W = result[0];
                dynamic curr_b = result[1];
                dynamic curr_loss = result[2];
                this.TextBlock.Text += string.Format("W: {0} b: {1} loss: {2}", curr_W, curr_b, curr_loss);
            }
        }

        private static PyList ToPyList(IEnumerable<float> v)
        {
            return new PyList(v.Select(x => new PyFloat(x)).Cast<PyObject>().ToArray());
        }
        
        public class WallstreetOnlineJson
        {
            //public string m { get; set; }
            //public string markets { get; set; }
            public decimal? o { get; set; }
            public decimal? c { get; set; }
            public long? s { get; set; }
            public long? i { get; set; }
            public bool? cached { get; set; }
            public decimal? decimals { get; set; }
            public IList<IList<decimal?>> data { get; set; }

            public decimal? GetOpen(int id)
            {
                return data[id][1];
            }
            public decimal? GetHigh(int id)
            {
                return data[id][2];
            }
            public decimal? GetLow(int id)
            {
                return data[id][3];
            }
            public decimal? GetClose(int id)
            {
                return data[id][4];
            }
            public DateTime GetDate(int id)
            {
                return new DateTime(1970,1,1).AddSeconds((long)data[id][5]);
            }
        }

        public class Rate
        {
            public DateTime Time { get; set; }
            public decimal? Open { get; set; }
            public decimal? Close { get; set; }
            public decimal? High { get; set; }
            public decimal? Low { get; set; }

            public Rate(IList<decimal?> data)
            {
                Open = data[1];
                Close = data[4];
                High = data[2];
                Low = data[3];
                Time = new DateTime(1970, 1, 1).AddSeconds((long)data[6]);
            }

            public override string ToString()
            {
                return $"{Time} {Open} {Close} {High} {Low}";
            }
        }

        private async void GetWallstreetOnline(string instrumentId, string marketId)
        {
            var seconds = (int)(DateTime.Now - new DateTime(1970, 1, 1)).TotalSeconds;
            var url = string.Format(WallstreetOnline, instrumentId, marketId, seconds);

            using (var httpClient = new HttpClient())
            {
                var json = await httpClient.GetStringAsync(url);
                var data = JsonConvert.DeserializeObject<WallstreetOnlineJson>(json);
                var rates = data.data.Where(x => x.Count == 7).Select(x => new Rate(x)).OrderBy(x => x.Time).ToLookup(x => x.Time, x => x);
                this.TextBlock.Text += $"last data: {rates.Last().First()}\n";
            }

            //using (WebClient wc = new WebClient())
            //{
            //    var json = wc.DownloadString(url);
            //}
        }

        private async void GetHistorical()
        {
            WebProxy proxy = null;
            if (!string.IsNullOrEmpty(Settings.Default.ProxyAddress))
            {
                proxy = new WebProxy(new Uri(Settings.Default.ProxyAddress, UriKind.Absolute));
                proxy.Credentials = new NetworkCredential(Settings.Default.ProxyUser, Settings.Default.ProxyPassword);
            }

            // You should be able to query data from various markets including US, HK, TW
            // The startTime & endTime here defaults to EST timezone
            var history = await Yahoo.GetHistoricalAsync("AAPL", DateTime.Today.AddMonths(-12*5), DateTime.Today.AddDays(-1), Period.Daily, default(CancellationToken), proxy);

            foreach (var candle in history)
            {
                this.TextBlock.Text += $"DateTime: {candle.DateTime}, Open: {candle.Open}, High: {candle.High}, Low: {candle.Low}, Close: {candle.Close}, Volume: {candle.Volume}, AdjustedClose: {candle.AdjustedClose}\n";
            }
        }

        private void Settings_OnClick(object sender, RoutedEventArgs e)
        {
            new SettingsWindow() { DataContext = new SettingsViewModel() }.ShowDialog();
        }
    }
}
