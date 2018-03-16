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

        private int flatBuyCount;
        private int flatNoBuyCount;
        private int flatSellCount;
        private int flatNoSellCount;

        private int testBuyCount;
        private int testNoBuyCount;
        private int testSellCount;
        private int testNoSellCount;

        private int trainBuyCount;
        private int trainNoBuyCount;
        private int trainSellCount;
        private int trainNoSellCount;

        private int trainBuyAugCount;
        private int trainNoBuyAugCount;
        private int trainSellAugCount;
        private int trainNoSellAugCount;

        public MainWindow()
        {
            InitializeComponent();
            UpdateDumpFileInfo();
            UpdateSplitFileInfo();
            UpdateTrainTestInfo();
            UpdateAugmentInfo();
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
            SplitTrainTestButton.IsEnabled = false;
            TrainTestSlider.IsEnabled = false;
            AugmentButton.IsEnabled = false;
            AugmentSlider.IsEnabled = false;
            AugmentBuySlider.IsEnabled = false;
            AugmentNoBuySlider.IsEnabled = false;
            AugmentSellSlider.IsEnabled = false;
            AugmentNoSellSlider.IsEnabled = false;
            MergeButton.IsEnabled = false;
            //LearnButton.IsEnabled = false;
        }

        private void EnableUI()
        {
            DownloadButton.IsEnabled = true;
            LoadFileButton.IsEnabled = true;
            SplitFileButton.IsEnabled = true;
            SplitTrainTestButton.IsEnabled = true;
            TrainTestSlider.IsEnabled = true;
            AugmentButton.IsEnabled = true;
            AugmentSlider.IsEnabled = true;
            AugmentBuySlider.IsEnabled = true;
            AugmentNoBuySlider.IsEnabled = true;
            AugmentSellSlider.IsEnabled = true;
            AugmentNoSellSlider.IsEnabled = true;
            MergeButton.IsEnabled = true;
            //LearnButton.IsEnabled = true;
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

        private void SplitTrainTestButton_Click(object sender, RoutedEventArgs e)
        {
            DisableUI();

            var ratio = TrainTestSlider.Value;

            var sum = flatBuyCount + flatNoBuyCount + flatSellCount + flatNoSellCount;
            var buyProgressScale = flatBuyCount / sum;
            var noBuyProgressScale = flatNoBuyCount / sum;
            var sellProgressScale = flatSellCount / sum;
            var noSellProgressScale = flatNoSellCount / sum;

            Task.Run(() =>
            {
                try
                {
                    DumpProcessor.SplitRandomTrainTest(DumpProcessor.FlatBuyFile, DumpProcessor.TestBuyFile, DumpProcessor.TrainBuyFile, ratio, x => ReportProgress(x * buyProgressScale));
                    DumpProcessor.SplitRandomTrainTest(DumpProcessor.FlatNoBuyFile, DumpProcessor.TestNoBuyFile, DumpProcessor.TrainNoBuyFile, ratio, x => ReportProgress(buyProgressScale + x * noBuyProgressScale));
                    DumpProcessor.SplitRandomTrainTest(DumpProcessor.FlatSellFile, DumpProcessor.TestSellFile, DumpProcessor.TrainSellFile, ratio, x => ReportProgress(buyProgressScale + noBuyProgressScale + x * sellProgressScale));
                    DumpProcessor.SplitRandomTrainTest(DumpProcessor.FlatNoSellFile, DumpProcessor.TestNoSellFile, DumpProcessor.TrainNoSellFile, ratio, x => ReportProgress(buyProgressScale + noBuyProgressScale + sellProgressScale + x * noSellProgressScale));
                }
                finally
                {
                    Dispatcher.BeginInvoke(new Action(() =>
                    {
                        EnableUI();
                        UpdateTrainTestInfo();
                        SetAugmentSliderValues();
                    }));
                }
            });
        }

        private void AugmentButton_Click(object sender, RoutedEventArgs e)
        {
            DisableUI();

            var buySliderValue = (int)AugmentBuySlider.Value;
            var noBuySliderValue = (int)AugmentNoBuySlider.Value;
            var sellSliderValue = (int)AugmentSellSlider.Value;
            var noSellSliderValue = (int)AugmentNoSellSlider.Value;

            var buySlidersValueSum = (double)(buySliderValue + noBuySliderValue);
            var sellSlidersValueSum = (double)(sellSliderValue + noSellSliderValue);

            var buySum = trainBuyCount * buySliderValue + trainNoBuyCount * noBuySliderValue;
            var sellSum = trainSellCount * sellSliderValue + trainNoSellCount * noSellSliderValue;
            var buyRatio = buySum / (double)(buySum + sellSum);
            var sellRatio = sellSum / (double)(buySum + sellSum);

            var buyProgressScale = buyRatio * buySliderValue / buySlidersValueSum;
            var noBuyProgressScale = buyRatio * noBuySliderValue / buySlidersValueSum;
            var sellProgressScale = sellRatio * sellSliderValue / sellSlidersValueSum;
            var noSellProgressScale = sellRatio * noSellSliderValue / sellSlidersValueSum;

            Task.Run(() =>
            {
                try
                {
                    DumpProcessor.Augment(DumpProcessor.TrainBuyFile, DumpProcessor.TrainBuyAugFile, buySliderValue, x => ReportProgress(x * buyProgressScale));
                    DumpProcessor.Augment(DumpProcessor.TrainNoBuyFile, DumpProcessor.TrainNoBuyAugFile, noBuySliderValue, x => ReportProgress(buyProgressScale + x * noBuyProgressScale));
                    DumpProcessor.Augment(DumpProcessor.TrainSellFile, DumpProcessor.TrainSellAugFile, sellSliderValue, x => ReportProgress(buyProgressScale + noBuyProgressScale + x * sellProgressScale));
                    DumpProcessor.Augment(DumpProcessor.TrainNoSellFile, DumpProcessor.TrainNoSellAugFile, noSellSliderValue, x => ReportProgress(buyProgressScale + noBuyProgressScale + sellProgressScale + x * noSellProgressScale));
                }
                finally
                {
                    Dispatcher.BeginInvoke(new Action(() =>
                    {
                        EnableUI();
                        UpdateAugmentInfo();
                    }));
                }
            });
        }

        private void MergeButton_Click(object sender, RoutedEventArgs e)
        {
            DisableUI();

            var sum = testBuyCount + testNoBuyCount + testSellCount + testNoSellCount + trainBuyAugCount + trainNoBuyAugCount + trainSellAugCount + trainNoSellAugCount;
            var testBuyingProgressScale = (testBuyCount + testNoBuyCount) / (double)sum;
            var testSellingProgressScale = (testSellCount + testNoSellCount) / (double)sum;
            var trainBuyingProgressScale = (trainBuyAugCount + trainNoBuyAugCount) / (double)sum;
            var trainSellingProgressScale = (trainSellAugCount + trainNoSellAugCount) / (double)sum;

            Task.Run(() =>
            {
                try
                {
                    DumpProcessor.MergeRandom(DumpProcessor.TestBuyFile, DumpProcessor.TestNoBuyFile, DumpProcessor.TestBuyingFile, x => ReportProgress(x * testBuyingProgressScale));
                    DumpProcessor.MergeRandom(DumpProcessor.TestSellFile, DumpProcessor.TestNoSellFile, DumpProcessor.TestSellingFile, x => ReportProgress(testBuyingProgressScale + x * testSellingProgressScale));
                    DumpProcessor.MergeRandom(DumpProcessor.TrainBuyAugFile, DumpProcessor.TrainNoBuyAugFile, DumpProcessor.TrainBuyingFile, x => ReportProgress(testBuyingProgressScale + testSellingProgressScale + x * trainBuyingProgressScale));
                    DumpProcessor.MergeRandom(DumpProcessor.TrainSellAugFile, DumpProcessor.TrainNoSellAugFile, DumpProcessor.TrainSellingFile, x => ReportProgress(testBuyingProgressScale + testSellingProgressScale + trainBuyingProgressScale + x * trainSellingProgressScale));
                }
                finally
                {
                    Dispatcher.BeginInvoke(new Action(() =>
                    {
                        EnableUI();
                        UpdateMergeInfo();
                    }));
                }
            });
        }

        private void AugmentSlider_ValueChanged(object sender, RoutedPropertyChangedEventArgs<double> e)
        {
            SetAugmentSliderValues();
        }

        private void SetAugmentSliderValues()
        {
            if (AugmentBuySlider != null)
            {
                var augmentBuySliderValue = trainBuyCount == 0 ? 0 : (trainBuyCount + trainNoBuyCount) / (double)trainBuyCount * AugmentSlider.Value;
                var augmentNoBuySliderValue = trainNoBuyCount == 0 ? 0 : (trainBuyCount + trainNoBuyCount) / (double)trainNoBuyCount * AugmentSlider.Value;
                var augmentSellSliderValue = trainSellCount == 0 ? 0 : (trainSellCount + trainNoSellCount) / (double)trainSellCount * AugmentSlider.Value;
                var augmentNoSellSliderValue = trainNoSellCount == 0 ? 0 : (trainSellCount + trainNoSellCount) / (double)trainNoSellCount * AugmentSlider.Value;

                AugmentBuySlider.Maximum = Math.Max(AugmentBuySlider.Maximum, augmentBuySliderValue);
                AugmentNoBuySlider.Maximum = Math.Max(AugmentNoBuySlider.Maximum, augmentNoBuySliderValue);
                AugmentSellSlider.Maximum = Math.Max(AugmentSellSlider.Maximum, augmentSellSliderValue);
                AugmentNoSellSlider.Maximum = Math.Max(AugmentNoSellSlider.Maximum, augmentNoSellSliderValue);

                AugmentBuySlider.Value = augmentBuySliderValue;
                AugmentNoBuySlider.Value = augmentNoBuySliderValue;
                AugmentSellSlider.Value = augmentSellSliderValue;
                AugmentNoSellSlider.Value = augmentNoSellSliderValue;
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
            flatBuyCount = DumpProcessor.CountLines(DumpProcessor.FlatBuyFile, line => true) - 1;
            flatNoBuyCount = DumpProcessor.CountLines(DumpProcessor.FlatNoBuyFile, line => true) - 1;
            flatSellCount = DumpProcessor.CountLines(DumpProcessor.FlatSellFile, line => true) - 1;
            flatNoSellCount = DumpProcessor.CountLines(DumpProcessor.FlatNoSellFile, line => true) - 1;

            SplitFileInfoTextBlock.Text = string.Format(
                "{0} buy\n{1} nobuy\n{2} sell\n{3} nosell", flatBuyCount, flatNoBuyCount, flatSellCount, flatNoSellCount);

            SetAugmentSliderValues();
        }

        private void UpdateTrainTestInfo()
        {
            trainBuyCount = DumpProcessor.CountLines(DumpProcessor.TrainBuyFile, line => true) - 1;
            trainNoBuyCount = DumpProcessor.CountLines(DumpProcessor.TrainNoBuyFile, line => true) - 1;
            trainSellCount = DumpProcessor.CountLines(DumpProcessor.TrainSellFile, line => true) - 1;
            trainNoSellCount = DumpProcessor.CountLines(DumpProcessor.TrainNoSellFile, line => true) - 1;

            testBuyCount = DumpProcessor.CountLines(DumpProcessor.TestBuyFile, line => true) - 1;
            testNoBuyCount = DumpProcessor.CountLines(DumpProcessor.TestNoBuyFile, line => true) - 1;
            testSellCount = DumpProcessor.CountLines(DumpProcessor.TestSellFile, line => true) - 1;
            testNoSellCount = DumpProcessor.CountLines(DumpProcessor.TestNoSellFile, line => true) - 1;

            SplitTrainTestInfoTextBlock.Text = string.Format(
                "{0} test buy\n{1} test nobuy\n{2} test sell\n{3} test nosell\n{4} train buy\n{5} train nobuy\n{6} train sell\n{7} train nosell", 
                testBuyCount, testNoBuyCount, testSellCount, testNoSellCount, 
                trainBuyCount, trainNoBuyCount, trainSellCount, trainNoSellCount);
        }

        private void UpdateAugmentInfo()
        {
            trainBuyAugCount = DumpProcessor.CountLines(DumpProcessor.TrainBuyAugFile, line => true) - 1;
            trainNoBuyAugCount = DumpProcessor.CountLines(DumpProcessor.TrainNoBuyAugFile, line => true) - 1;
            trainSellAugCount = DumpProcessor.CountLines(DumpProcessor.TrainSellAugFile, line => true) - 1;
            trainNoSellAugCount = DumpProcessor.CountLines(DumpProcessor.TrainNoSellAugFile, line => true) - 1;

            AugmentInfoTextBlock.Text = string.Format(
                "{0} train buy\n{1} train nobuy\n{2} train sell\n{3} train nosell",
                trainBuyAugCount, trainNoBuyAugCount, trainSellAugCount, trainNoSellAugCount);
        }

        private void UpdateMergeInfo()
        {
            MergeInfoTextBlock.Text = string.Format(
                "{0} test no/buy\n{1} test no/sell\n{2} train no/buy\n{3} train no/sell",
                DumpProcessor.CountLines(DumpProcessor.TestBuyingFile, line => true) - 1,
                DumpProcessor.CountLines(DumpProcessor.TestSellingFile, line => true) - 1,
                DumpProcessor.CountLines(DumpProcessor.TrainBuyingFile, line => true) - 1,
                DumpProcessor.CountLines(DumpProcessor.TrainSellingFile, line => true) - 1);
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

                LearnBat();
                //LearnPyNet();
            }
            catch (Exception ex)
            {
                EnableUI();
                TextBlock.Text += "\n" + ex.ToString();
            }
        }
        
        public void LearnBat()
        {
            Execute(
                Path.GetFullPath("."),
                Settings.Default.Python,
                "\"" + Path.GetFullPath("..\\..\\..\\StockFlow.Python\\StockFlow.Python.py") + "\"" +
                " --model_dir \"" + Path.GetFullPath(TemporaryModelDir) + "\"" +
                " --batch_size 10" +
                " --data_file \"" + Path.GetFullPath(DumpProcessor.FlatBuyFile) + "\"" +
                " --test_data_ratio 0.2" +
                " --first_day " + (-DumpProcessor.Days + 1) +
                " --last_day 0" + 
                " --label_true buy");
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
