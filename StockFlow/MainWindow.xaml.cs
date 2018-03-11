namespace StockFlow
{
    using System.Collections.Generic;
    using System.Linq;
    using System.Windows;

    using Python.Runtime;
    using System.Net.Http;
    using StockFlow.Properties;
    using System.Net;
    using System;
    using System.Threading.Tasks;
    using System.IO;
    using StockFlow.Common;
    using StockFlow.Web.Models;
    using System.Text;
    using System.Globalization;
    using System.Diagnostics;
    using Microsoft.Win32;

    /// <summary>
    /// Interaction logic for MainWindow.xaml
    /// </summary>
    public partial class MainWindow : Window
    {
        const string TemporaryModelDir = "model";

        private Process process;

        public MainWindow()
        {
            InitializeComponent();
            UpdateDumpFileInfo();
            UpdateSplitFileInfo();
        }

        private void Settings_OnClick(object sender, RoutedEventArgs e)
        {
            new SettingsWindow() { DataContext = new SettingsViewModel() }.ShowDialog();
        }

        private void DisableUI()
        {
            DownloadButton.IsEnabled = false;
            LoadFileButton.IsEnabled = false;
            SplitFileButton.IsEnabled = false;
            LearnButton.IsEnabled = false;
        }

        private void EnableUI()
        {
            DownloadButton.IsEnabled = true;
            LoadFileButton.IsEnabled = true;
            SplitFileButton.IsEnabled = true;
            LearnButton.IsEnabled = true;
        }

        private void DownloadButton_Click(object sender, RoutedEventArgs e)
        {
            DisableUI();

            Task.Run(() =>
            {
                try
                {
                    var download = Download(UrlTextBox.Text);
                    download.Wait();

                    var stream = download.Result;
                    if (stream != null)
                    {
                        using (stream)
                        {
                            DumpProcessor.Flatten(stream, ReportProgress);
                        }
                    }
                }
                finally
                {
                    Dispatcher.BeginInvoke(new Action(() =>
                    {
                        EnableUI();
                        UpdateDumpFileInfo();
                    }));
                }
            });
        }

        private void LoadFileButton_Click(object sender, RoutedEventArgs e)
        {
            DisableUI();

            var stream = LoadFile();

            Task.Run(() =>
            {
                try
                {
                    if (stream != null)
                    {
                        using (stream)
                        {
                            DumpProcessor.Flatten(stream, ReportProgress);
                        }
                    }
                }
                finally
                {
                    Dispatcher.BeginInvoke(new Action(() =>
                    {
                        EnableUI();
                        UpdateDumpFileInfo();
                    }));
                }
            });
        }

        private void SplitFileButton_Click(object sender, RoutedEventArgs e)
        {
            DisableUI();
            
            Task.Run(() =>
            {
                try
                {
                    DumpProcessor.SplitByDecision();
                }
                finally
                {
                    Dispatcher.BeginInvoke(new Action(() =>
                    {
                        EnableUI();
                        UpdateSplitFileInfo();
                    }));
                }
            });
        }

        private async Task<Stream> Download(string url)
        {
            using (var handler = new HttpClientHandler())
            {
                var proxyAddress = Settings.Default.ProxyAddress;
                if (!string.IsNullOrEmpty(proxyAddress))
                {
                    handler.Proxy = new WebProxy(new Uri(proxyAddress, UriKind.Absolute));
                    handler.Proxy.Credentials = new NetworkCredential(Settings.Default.ProxyUser, Settings.Default.ProxyPassword);
                    handler.UseProxy = true;
                }

                using (var httpClient = new HttpClient(handler))
                {
                    httpClient.Timeout = TimeSpan.FromMinutes(2);
                    var stream = await httpClient.GetStreamAsync(url);
                    return stream;
                }
            }
        }

        private Stream LoadFile()
        {
            var dialog = new OpenFileDialog();
            if (dialog.ShowDialog(this) == true)
            {
                return dialog.OpenFile();
            }

            return null;
        }
        
        private void ReportProgress(double progress)
        {
            Dispatcher.BeginInvoke(new Action(() =>
            {
                ProgressBar.Value = progress;
            }));
        }

        private void UpdateDumpFileInfo()
        {
            DumpFileInfoTextBlock.Text = string.Format(
                "{0} datasets available",
                DumpProcessor.CountLines(DumpProcessor.FlatDumpFile, line => true) - 1);
        }

        private void UpdateSplitFileInfo()
        {
            SplitFileInfoTextBlock.Text = string.Format(
                "{0}/{1} buy\n{2}/{3} sell",
                DumpProcessor.CountLines(DumpProcessor.FlatBuyFile, line => DumpProcessor.ContainsDecision(line, "buy")) - 1,
                DumpProcessor.CountLines(DumpProcessor.FlatBuyFile, line => true) - 1,
                DumpProcessor.CountLines(DumpProcessor.FlatSellFile, line => DumpProcessor.ContainsDecision(line, "sell")) - 1,
                DumpProcessor.CountLines(DumpProcessor.FlatSellFile, line => true) - 1);
        }

        private void LearnButton_OnClick(object sender, RoutedEventArgs e)
        {
            DisableUI();
            TextBlock.Clear();

            try
            {
                if (!Directory.Exists(Path.GetFullPath(TemporaryModelDir)))
                {
                    Directory.CreateDirectory(Path.GetFullPath(TemporaryModelDir));
                }

                var lineCount = File.ReadLines(DumpProcessor.FlatDumpFile).Count();
                var snapshotCount = lineCount - 1;
                var trainCount = (int)Math.Round((TrainPercentageSlider.Value / 100) * snapshotCount);
                var testCount = snapshotCount - trainCount;

                LearnBat(trainCount, testCount);
                //LearnPyNet(trainCount, testCount);
            }
            catch (Exception ex)
            {
                EnableUI();
                TextBlock.Text += "\n" + ex.ToString();
            }
        }

        private void LearnPyNet(int trainCount, int testCount)
        {
            using (Py.GIL())
            {
                dynamic learn = Py.Import("learn");

                dynamic result = learn.Learn(
                    model_dir: Path.GetFullPath(TemporaryModelDir),
                    model_type: "deep",
                    train_epochs: 10,
                    epochs_per_eval: 2,
                    batch_size: 10,
                    train_data: Path.GetFullPath(DumpProcessor.FlatDumpFile),
                    test_data: Path.GetFullPath(DumpProcessor.FlatDumpFile),
                    train_skip_lines: 1,
                    test_skip_lines: 1 + trainCount,
                    train_count: trainCount,
                    test_count: testCount,
                    first_day: -DumpProcessor.Days + 1,
                    last_day: 0);

                this.TextBlock.Text += result;
            }

            //using (Py.GIL())
            //{
            //    dynamic learn = Py.Import("learn");

            //    var x_train = ToPyList(new float[] { 1, 2, 3, 4 });
            //    var y_train = ToPyList(new float[] { 0, -1, -2, -3 });

            //    dynamic result = learn.Learn(x_train, y_train);

            //    dynamic curr_W = result[0];
            //    dynamic curr_b = result[1];
            //    dynamic curr_loss = result[2];
            //    this.TextBlock.Text += string.Format("W: {0} b: {1} loss: {2}", curr_W, curr_b, curr_loss);
            //}

            EnableUI();
        }

        private static PyList ToPyList(IEnumerable<float> v)
        {
            return new PyList(v.Select(x => new PyFloat(x)).Cast<PyObject>().ToArray());
        }

        public void LearnBat(int trainCount, int testCount)
        {
            Execute(
                Path.GetFullPath("."),
                Settings.Default.Python,
                "\"" + Path.GetFullPath("learn.py") + "\"" +
                " --model_dir \"" + Path.GetFullPath(TemporaryModelDir) + "\"" +
                " --model_type wide" +
                " --train_epochs 10" +
                " --epochs_per_eval 2" +
                " --batch_size 10" +
                " --train_data \"" + Path.GetFullPath(DumpProcessor.FlatDumpFile) + "\"" +
                " --test_data \"" + Path.GetFullPath(DumpProcessor.FlatDumpFile) + "\"" +
                " --train_skip_lines 1" +
                " --test_skip_lines " + (1 + trainCount) +
                " --train_count " + trainCount +
                " --test_count " + testCount +
                " --first_day " + (-DumpProcessor.Days + 1) +
                " --last_day 0");
        }

        public void Execute(string workingDirectory, string file, string arguments)
        {
            // create the ProcessStartInfo using "cmd" as the program to be run, and "/c " as the parameters.
            // Incidentally, /c tells cmd that we want it to execute the command that follows, and then exit.
            ProcessStartInfo procStartInfo = new ProcessStartInfo(file, arguments);

            procStartInfo.WorkingDirectory = workingDirectory;

            //This means that it will be redirected to the Process.StandardOutput StreamReader.
            procStartInfo.RedirectStandardOutput = true;
            //This means that it will be redirected to the Process.StandardError StreamReader. (same as StdOutput)
            procStartInfo.RedirectStandardError = true;

            procStartInfo.UseShellExecute = false;
            // Do not create the black window.
            procStartInfo.CreateNoWindow = true;

            // Now we create a process, assign its ProcessStartInfo and start it
            process = new Process();

            //This is importend, else some Events will not fire!
            process.EnableRaisingEvents = true;

            // passing the Startinfo to the process
            process.StartInfo = procStartInfo;

            // The given Funktion will be raised if the Process wants to print an output to consol                    
            process.OutputDataReceived += DoSomething;
            // Std Error
            process.ErrorDataReceived += DoSomethingHorrible;
            // If Batch File is finished this Event will be raised
            process.Exited += Exited;

            try
            {
                process.Start();
                process.BeginOutputReadLine();
                process.BeginErrorReadLine();
            }
            catch (Exception ex)
            {
                TextBlock.Text += ex.ToString();
                EnableUI();
                process = null;
            }
        }

        private void Exited(object sender, EventArgs e)
        {
            Dispatcher.Invoke(() =>
            {
                EnableUI();
                process = null;
            });
        }

        private void DoSomethingHorrible(object sender, DataReceivedEventArgs e)
        {
            Dispatcher.Invoke(() =>
            {
                TextBlock.Text += "\n" + e.Data;
                TextBlock.ScrollToEnd();
            });
        }

        private void DoSomething(object sender, DataReceivedEventArgs e)
        {
            Dispatcher.Invoke(() =>
            {
                TextBlock.Text += "\n" + e.Data;
                TextBlock.ScrollToEnd();
            });
        }

        private void Window_Closing(object sender, System.ComponentModel.CancelEventArgs e)
        {
            if (process != null)
            {
                process.Kill();
                process = null;
            }
        }
    }
}
