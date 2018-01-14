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
        const string TemporarySnapshotsFile = "snapshots.csv";
        const int Days = 30;//5 * 365 - 10;
        private Process process;

        public MainWindow()
        {
            InitializeComponent();
            UpdateFileInfo();
        }

        private void Settings_OnClick(object sender, RoutedEventArgs e)
        {
            new SettingsWindow() { DataContext = new SettingsViewModel() }.ShowDialog();
        }

        private void UpdateFileInfo()
        {
            if (File.Exists(TemporarySnapshotsFile))
            {
                var lines = 0;
                using (var stream = File.OpenRead(TemporarySnapshotsFile))
                {
                    using (var reader = new StreamReader(stream))
                    {
                        while (reader.ReadLine() != null)
                        {
                            lines++;
                        }
                    }
                }

                FileInfoTextBlock.Text = lines + " datasets available";
            }
            else
            {
                FileInfoTextBlock.Text = "No dataset file";
            }
        }

        private async void DownloadButton_Click(object sender, RoutedEventArgs e)
        {
            DownloadButton.IsEnabled = false;
            LoadFileButton.IsEnabled = false;
            LearnButton.IsEnabled = false;

            try
            {
                var stream = await Download(UrlTextBox.Text);
                if (stream != null)
                {
                    DumpSnapshotsToFile(stream, TemporarySnapshotsFile);
                }
            }
            finally
            {
                DownloadButton.IsEnabled = true;
                LoadFileButton.IsEnabled = true;
                LearnButton.IsEnabled = true;
            }
        }

        private void LoadFileButton_Click(object sender, RoutedEventArgs e)
        {
            DownloadButton.IsEnabled = false;
            LoadFileButton.IsEnabled = false;
            LearnButton.IsEnabled = false;

            try
            {
                var stream = LoadFile();
                if (stream != null)
                {
                    DumpSnapshotsToFile(stream, TemporarySnapshotsFile);
                }
            }
            finally
            {
                DownloadButton.IsEnabled = true;
                LoadFileButton.IsEnabled = true;
                LearnButton.IsEnabled = true;
            }
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

        private void DumpSnapshotsToFile(Stream stream, string filePath)
        {
            using (var writer = new StreamWriter(File.Open(filePath, FileMode.Create)))
            {
                writer.Write("decision;");
                for (var day = -Days + 1; day <= 0; ++day)
                {
                    writer.Write(day.ToString());
                    if (day < 0)
                    {
                        writer.Write(";");
                    }
                }
                writer.Flush();

                Importer.Import<Snapshot>(stream, snapshot =>
                {
                    if (!string.IsNullOrEmpty(snapshot.Decision) && snapshot.Rates != null)
                    {
                        var rates = snapshot.Rates.Where(x => x.Close.HasValue).ToList();

                        var firstDate = snapshot.Time.Date.AddDays(-Days + 1);

                        if (rates.Any() && rates.First().Time.Date <= firstDate)
                        {
                            writer.WriteLine();
                            writer.Write(snapshot.Decision);
                            writer.Write(";");

                            var remainingRates = snapshot.Rates;
                            var previousRate = remainingRates.First();
                            for (DateTime date = firstDate; date <= snapshot.Time.Date; date = date.AddDays(1))
                            {
                                remainingRates = remainingRates.SkipWhile(x => x.Time.Date < date).ToList();

                                var rate = previousRate;
                                if (remainingRates.Any())
                                {
                                    var firstRate = remainingRates.First();
                                    if (firstRate.Time.Date == date)
                                    {
                                        rate = firstRate;
                                    }
                                    else
                                    {
                                        // encountered future rate. use previous rate.
                                    }
                                }
                                else
                                {
                                    // no remaining rates. use previous rate.
                                }

                                var value = rate.Close.Value.ToString("F2", CultureInfo.InvariantCulture);
                                writer.Write(value);

                                if (date < snapshot.Time.Date)
                                {
                                    writer.Write(";");
                                }

                                previousRate = rate;
                            }
                            writer.Flush();
                        }
                    }
                });
            }

            UpdateFileInfo();
        }

        private void LearnButton_OnClick(object sender, RoutedEventArgs e)
        {
            DownloadButton.IsEnabled = false;
            LoadFileButton.IsEnabled = false;
            LearnButton.IsEnabled = false;
            TextBlock.Clear();

            try
            {
                if (!Directory.Exists(Path.GetFullPath(TemporaryModelDir)))
                {
                    Directory.CreateDirectory(Path.GetFullPath(TemporaryModelDir));
                }

                var lineCount = File.ReadLines(TemporarySnapshotsFile).Count();
                var snapshotCount = lineCount - 1;
                var trainCount = (int)Math.Round((TrainPercentageSlider.Value / 100) * snapshotCount);
                var testCount = snapshotCount - trainCount;

                LearnBat(trainCount, testCount);
                //LearnPyNet(trainCount, testCount);
            }
            catch (Exception ex)
            {
                DownloadButton.IsEnabled = true;
                LoadFileButton.IsEnabled = true;
                LearnButton.IsEnabled = true;
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
                    train_data: Path.GetFullPath(TemporarySnapshotsFile),
                    test_data: Path.GetFullPath(TemporarySnapshotsFile),
                    train_skip_lines: 1,
                    test_skip_lines: 1 + trainCount,
                    train_count: trainCount,
                    test_count: testCount,
                    first_day: -Days + 1,
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

            DownloadButton.IsEnabled = true;
            LearnButton.IsEnabled = true;
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
                " --train_data \"" + Path.GetFullPath(TemporarySnapshotsFile) + "\"" +
                " --test_data \"" + Path.GetFullPath(TemporarySnapshotsFile) + "\"" +
                " --train_skip_lines 1" +
                " --test_skip_lines " + (1 + trainCount) +
                " --train_count " + trainCount +
                " --test_count " + testCount +
                " --first_day " + (-Days + 1) +
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
                DownloadButton.IsEnabled = true;
                LearnButton.IsEnabled = true;
                process = null;
            }
        }

        private void Exited(object sender, EventArgs e)
        {
            Dispatcher.Invoke(() =>
            {
                DownloadButton.IsEnabled = true;
                LearnButton.IsEnabled = true;
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
