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

    /// <summary>
    /// Interaction logic for MainWindow.xaml
    /// </summary>
    public partial class MainWindow : Window
    {
        public MainWindow()
        {
            InitializeComponent();
        }
        
        private void ButtonBase_OnClick(object sender, RoutedEventArgs e)
        {
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
            var history = await Yahoo.GetHistoricalAsync("AAPL", DateTime.Today.AddMonths(-1), DateTime.Today.AddDays(-1), Period.Daily, default(CancellationToken), proxy);

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
