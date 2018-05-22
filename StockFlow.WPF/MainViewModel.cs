using Microsoft.Win32;
using StockFlow.Annotations;
using StockFlow.Common;
using StockFlow.Properties;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Runtime.CompilerServices;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Threading;

namespace StockFlow
{
    public class MainViewModel : INotifyPropertyChanged
    {
        const string TemporaryModelDir = "model";

        private bool _isBusy;
        private int _splitBuyCountMax;
        private int _splitNoBuyCountMax;
        private int _splitSellCountMax;
        private int _splitNoSellCountMax;
        private int _splitBuyCount;
        private int _splitNoBuyCount;
        private int _splitSellCount;
        private int _splitNoSellCount;
        private double _trainTestRatio = 0.2;
        private int _augmentFactor = 4;
        private int _augmentBuyFactor;
        private int _augmentNoBuyFactor;
        private int _augmentSellFactor;
        private int _augmentNoSellFactor;
        private int _augmentBuyFactorMax;
        private int _augmentNoBuyFactorMax;
        private int _augmentSellFactorMax;
        private int _augmentNoSellFactorMax;
        private double _progress;
        private string _dumpFileInfo;
        private string _splitFileInfo;
        private string _splitTrainTestInfo;
        private string _augmentInfo;
        private string _mergeInfo;
        private string _processLog;
        private bool _preserveTestIds = true;
        private bool _splitBuy = true;
        private bool _splitSell = false;
        private bool _splitTestTrainBuy = true;
        private bool _splitTestTrainSell = false;
        private bool _augmentBuy = true;
        private bool _augmentSell = false;
        private bool _mergeBuy = true;
        private bool _mergeSell = false;

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

        public Dispatcher Dispatcher;
        public Process Process;

        public MainViewModel()
        {
            DownloadCommand = new ActionCommand(Download);
            LoadFileCommand = new ActionCommand(LoadFile);
            SplitFileCommand = new ActionCommand(SplitFile);
            SplitTrainTestCommand = new ActionCommand(SplitTrainTest);
            AugmentCommand = new ActionCommand(Augment);
            MergeCommand = new ActionCommand(Merge);
            LearnCommand = new ActionCommand(Learn);

            UpdateDumpFileInfo();
            UpdateSplitFileInfo();
            UpdateTrainTestInfo();
            UpdateAugmentInfo();
            UpdateMergeInfo();

            SetAugmentSliderValues();
        }

        public bool IsBusy
        {
            get
            {
                return _isBusy;
            }

            set
            {
                _isBusy = value;
                OnPropertyChanged();
                OnPropertyChanged("IsNotBusy");
            }
        }

        public bool IsNotBusy
        {
            get
            {
                return !_isBusy;
            }
        }

        public Visibility BusyVisiblity
        {
            get
            {
                return _isBusy ? Visibility.Visible : Visibility.Collapsed;
            }
        }
        
        public int SplitBuyCountMax
        {
            get
            {
                return _splitBuyCountMax;
            }

            set
            {
                _splitBuyCountMax = value;
                OnPropertyChanged();
            }
        }

        public int SplitNoBuyCountMax
        {
            get
            {
                return _splitNoBuyCountMax;
            }

            set
            {
                _splitNoBuyCountMax = value;
                OnPropertyChanged();
            }
        }

        public int SplitSellCountMax
        {
            get
            {
                return _splitSellCountMax;
            }

            set
            {
                _splitSellCountMax = value;
                OnPropertyChanged();
            }
        }

        public int SplitNoSellCountMax
        {
            get
            {
                return _splitNoSellCountMax;
            }

            set
            {
                _splitNoSellCountMax = value;
                OnPropertyChanged();
            }
        }

        public int SplitBuyCount
        {
            get
            {
                return _splitBuyCount;
            }

            set
            {
                _splitBuyCount = value;
                OnPropertyChanged();
            }
        }

        public int SplitNoBuyCount
        {
            get
            {
                return _splitNoBuyCount;
            }

            set
            {
                _splitNoBuyCount = value;
                OnPropertyChanged();
            }
        }

        public int SplitSellCount
        {
            get
            {
                return _splitSellCount;
            }

            set
            {
                _splitSellCount = value;
                OnPropertyChanged();
            }
        }

        public int SplitNoSellCount
        {
            get
            {
                return _splitNoSellCount;
            }

            set
            {
                _splitNoSellCount = value;
                OnPropertyChanged();
            }
        }

        public double TrainTestRatio
        {
            get
            {
                return _trainTestRatio;
            }

            set
            {
                _trainTestRatio = value;
                OnPropertyChanged();
            }
        }

        public int AugmentFactor
        {
            get
            {
                return _augmentFactor;
            }

            set
            {
                _augmentFactor = value;
                OnPropertyChanged();
                SetAugmentSliderValues();
            }
        }

        public int AugmentBuyFactor
        {
            get
            {
                return _augmentBuyFactor;
            }

            set
            {
                _augmentBuyFactor = value;
                OnPropertyChanged();
            }
        }

        public int AugmentNoBuyFactor
        {
            get
            {
                return _augmentNoBuyFactor;
            }

            set
            {
                _augmentNoBuyFactor = value;
                OnPropertyChanged();
            }
        }

        public int AugmentSellFactor
        {
            get
            {
                return _augmentSellFactor;
            }

            set
            {
                _augmentSellFactor = value;
                OnPropertyChanged();
            }
        }

        public int AugmentNoSellFactor
        {
            get
            {
                return _augmentNoSellFactor;
            }

            set
            {
                _augmentNoSellFactor = value;
                OnPropertyChanged();
            }
        }

        public int AugmentBuyFactorMax
        {
            get
            {
                return _augmentBuyFactorMax;
            }

            set
            {
                _augmentBuyFactorMax = value;
                OnPropertyChanged();
            }
        }

        public int AugmentNoBuyFactorMax
        {
            get
            {
                return _augmentNoBuyFactorMax;
            }

            set
            {
                _augmentNoBuyFactorMax = value;
                OnPropertyChanged();
            }
        }

        public int AugmentSellFactorMax
        {
            get
            {
                return _augmentSellFactorMax;
            }

            set
            {
                _augmentSellFactorMax = value;
                OnPropertyChanged();
            }
        }

        public int AugmentNoSellFactorMax
        {
            get
            {
                return _augmentNoSellFactorMax;
            }

            set
            {
                _augmentNoSellFactorMax = value;
                OnPropertyChanged();
            }
        }

        public double Progress
        {
            get
            {
                return _progress;
            }

            set
            {
                _progress = value;
                OnPropertyChanged();
            }
        }

        public string DumpFileInfo
        {
            get
            {
                return _dumpFileInfo;
            }

            set
            {
                _dumpFileInfo = value;
                OnPropertyChanged();
            }
        }

        public string SplitFileInfo
        {
            get
            {
                return _splitFileInfo;
            }

            set
            {
                _splitFileInfo = value;
                OnPropertyChanged();
            }
        }

        public string SplitTrainTestInfo
        {
            get
            {
                return _splitTrainTestInfo;
            }

            set
            {
                _splitTrainTestInfo = value;
                OnPropertyChanged();
            }
        }

        public string AugmentInfo
        {
            get
            {
                return _augmentInfo;
            }

            set
            {
                _augmentInfo = value;
                OnPropertyChanged();
            }
        }

        public string MergeInfo
        {
            get
            {
                return _mergeInfo;
            }

            set
            {
                _mergeInfo = value;
                OnPropertyChanged();
            }
        }

        public string ProcessLog
        {
            get
            {
                return _processLog;
            }

            set
            {
                _processLog = value;
                OnPropertyChanged();
            }
        }

        public bool PreserveTestIds
        {
            get
            {
                return _preserveTestIds;
            }

            set
            {
                _preserveTestIds = value;
                OnPropertyChanged();
            }
        }

        public bool SplitBuy
        {
            get
            {
                return _splitBuy;
            }

            set
            {
                _splitBuy = value;
                OnPropertyChanged();
            }
        }

        public bool SplitSell
        {
            get
            {
                return _splitSell;
            }

            set
            {
                _splitSell = value;
                OnPropertyChanged();
            }
        }

        public bool SplitTestTrainBuy
        {
            get
            {
                return _splitTestTrainBuy;
            }

            set
            {
                _splitTestTrainBuy = value;
                OnPropertyChanged();
                OnPropertyChanged(nameof(SplitTestTrainBuyVisibility));
            }
        }

        public bool SplitTestTrainSell
        {
            get
            {
                return _splitTestTrainSell;
            }

            set
            {
                _splitTestTrainSell = value;
                OnPropertyChanged();
                OnPropertyChanged(nameof(SplitTestTrainSellVisibility));
            }
        }

        public Visibility SplitTestTrainBuyVisibility
        {
            get
            {
                return _splitTestTrainBuy ? Visibility.Visible : Visibility.Collapsed;
            }
        }

        public Visibility SplitTestTrainSellVisibility
        {
            get
            {
                return _splitTestTrainSell ? Visibility.Visible : Visibility.Collapsed;
            }
        }

        public bool AugmentBuy
        {
            get
            {
                return _augmentBuy;
            }

            set
            {
                _augmentBuy = value;
                OnPropertyChanged();
                OnPropertyChanged(nameof(AugmentBuyVisibility));
            }
        }

        public bool AugmentSell
        {
            get
            {
                return _augmentSell;
            }

            set
            {
                _augmentSell = value;
                OnPropertyChanged();
                OnPropertyChanged(nameof(AugmentSellVisibility));
            }
        }

        public Visibility AugmentBuyVisibility
        {
            get
            {
                return _augmentBuy ? Visibility.Visible : Visibility.Collapsed;
            }
        }

        public Visibility AugmentSellVisibility
        {
            get
            {
                return _augmentSell ? Visibility.Visible : Visibility.Collapsed;
            }
        }

        public bool MergeBuy
        {
            get
            {
                return _mergeBuy;
            }

            set
            {
                _mergeBuy = value;
                OnPropertyChanged();
            }
        }

        public bool MergeSell
        {
            get
            {
                return _mergeSell;
            }

            set
            {
                _mergeSell = value;
                OnPropertyChanged();
            }
        }
        
        public event Action<string> OutputDataReceived;

        public event PropertyChangedEventHandler PropertyChanged;

        public ActionCommand DownloadCommand { get; private set; }

        public ActionCommand LoadFileCommand { get; private set; }

        public ActionCommand SplitFileCommand { get; private set; }

        public ActionCommand SplitTrainTestCommand { get; private set; }

        public ActionCommand AugmentCommand { get; private set; }

        public ActionCommand MergeCommand { get; private set; }

        public ActionCommand LearnCommand { get; private set; }

        [NotifyPropertyChangedInvocator]
        protected virtual void OnPropertyChanged([CallerMemberName] string propertyName = null)
        {
            this.PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }

        private void Download()
        {
            IsBusy = true;

            Task.Run(() =>
            {
                try
                {
                    var download = DownloadStream();
                    download.Wait();

                    var tuple = download.Result;
                    if (tuple.Item2 != null)
                    {
                        using (tuple.Item2)
                        {
                            DumpProcessor.Flatten(tuple.Item2, tuple.Item1, ReportProgress);
                        }
                    }
                }
                finally
                {
                    Dispatcher.BeginInvoke(new Action(() =>
                    {
                        IsBusy = false;
                        UpdateDumpFileInfo();
                    }));
                }
            });
        }

        private void LoadFile()
        {
            IsBusy = true;

            var stream = LoadFileDialog();

            Task.Run(() =>
            {
                try
                {
                    if (stream != null)
                    {
                        using (stream)
                        {
                            DumpProcessor.Flatten(stream, -1, ReportProgress);
                        }
                    }
                }
                finally
                {
                    Dispatcher.BeginInvoke(new Action(() =>
                    {
                        IsBusy = false;
                        UpdateDumpFileInfo();
                    }));
                }
            });
        }

        private void SplitFile()
        {
            IsBusy = true;

            Task.Run(() =>
            {
                try
                {
                    DumpProcessor.SplitByDecision(SplitBuy, SplitSell);
                }
                finally
                {
                    Dispatcher.BeginInvoke(new Action(() =>
                    {
                        IsBusy = false;
                        UpdateSplitFileInfo();
                    }));
                }
            });
        }

        private void SetSplitSliderValues()
        {
            var splitBuySliderValue = Math.Min(flatBuyCount, flatNoBuyCount);
            var splitNoBuySliderValue = Math.Min(flatBuyCount, flatNoBuyCount);
            var splitSellSliderValue = Math.Min(flatSellCount, flatNoSellCount);
            var splitNoSellSliderValue = Math.Min(flatSellCount, flatNoSellCount);

            SplitBuyCountMax = flatBuyCount;
            SplitNoBuyCountMax = flatNoBuyCount;
            SplitSellCountMax = flatSellCount;
            SplitNoSellCountMax = flatNoSellCount;

            SplitBuyCount = splitBuySliderValue;
            SplitNoBuyCount = splitNoBuySliderValue;
            SplitSellCount = splitSellSliderValue;
            SplitNoSellCount = splitNoSellSliderValue;
        }

        private void SplitTrainTest()
        {
            IsBusy = true;

            var ratio = TrainTestRatio;
            var buySliderValue = (int)SplitBuyCount;
            var noBuySliderValue = (int)SplitNoBuyCount;
            var sellSliderValue = (int)SplitSellCount;
            var noSellSliderValue = (int)SplitNoSellCount;

            var sum = flatBuyCount + flatNoBuyCount + flatSellCount + flatNoSellCount;
            var buyProgressScale = SplitTestTrainBuy ? flatBuyCount / sum : 0;
            var noBuyProgressScale = SplitTestTrainBuy ? flatNoBuyCount / sum : 0;
            var sellProgressScale = SplitTestTrainSell ? flatSellCount / sum : 0;
            var noSellProgressScale = SplitTestTrainSell ? flatNoSellCount / sum : 0;

            var preserveTestIds = PreserveTestIds;

            Task.Run(() =>
            {
                try
                {
                    if (SplitTestTrainBuy)
                    {
                        DumpProcessor.SplitRandomTrainTest(DumpProcessor.FlatBuyFile, DumpProcessor.TestBuyFile, DumpProcessor.TrainBuyFile, ratio, buySliderValue, preserveTestIds, x => ReportProgress(x * buyProgressScale));
                        DumpProcessor.SplitRandomTrainTest(DumpProcessor.FlatNoBuyFile, DumpProcessor.TestNoBuyFile, DumpProcessor.TrainNoBuyFile, ratio, noBuySliderValue, preserveTestIds, x => ReportProgress(buyProgressScale + x * noBuyProgressScale));
                    }

                    if (SplitTestTrainSell)
                    {
                        DumpProcessor.SplitRandomTrainTest(DumpProcessor.FlatSellFile, DumpProcessor.TestSellFile, DumpProcessor.TrainSellFile, ratio, sellSliderValue, preserveTestIds, x => ReportProgress(buyProgressScale + noBuyProgressScale + x * sellProgressScale));
                        DumpProcessor.SplitRandomTrainTest(DumpProcessor.FlatNoSellFile, DumpProcessor.TestNoSellFile, DumpProcessor.TrainNoSellFile, ratio, noSellSliderValue, preserveTestIds, x => ReportProgress(buyProgressScale + noBuyProgressScale + sellProgressScale + x * noSellProgressScale));
                    }
                }
                finally
                {
                    Dispatcher.BeginInvoke(new Action(() =>
                    {
                        IsBusy = false;
                        UpdateTrainTestInfo();
                        SetAugmentSliderValues();
                    }));
                }
            });
        }

        private void Augment()
        {
            IsBusy = true;

            var buySliderValue = (int)AugmentBuyFactor;
            var noBuySliderValue = (int)AugmentNoBuyFactor;
            var sellSliderValue = (int)AugmentSellFactor;
            var noSellSliderValue = (int)AugmentNoSellFactor;

            var buySlidersValueSum = (double)(buySliderValue + noBuySliderValue);
            var sellSlidersValueSum = (double)(sellSliderValue + noSellSliderValue);

            var buySum = trainBuyCount * buySliderValue + trainNoBuyCount * noBuySliderValue;
            var sellSum = trainSellCount * sellSliderValue + trainNoSellCount * noSellSliderValue;
            var buyRatio = buySum / (double)(buySum + sellSum);
            var sellRatio = sellSum / (double)(buySum + sellSum);

            var buyProgressScale = AugmentBuy ? buyRatio * buySliderValue / buySlidersValueSum : 0;
            var noBuyProgressScale = AugmentBuy ? buyRatio * noBuySliderValue / buySlidersValueSum : 0;
            var sellProgressScale = AugmentSell ? sellRatio * sellSliderValue / sellSlidersValueSum : 0;
            var noSellProgressScale = AugmentSell ? sellRatio * noSellSliderValue / sellSlidersValueSum : 0;

            Task.Run(() =>
            {
                try
                {
                    if (AugmentBuy)
                    {
                        DumpProcessor.Augment(DumpProcessor.TrainBuyFile, DumpProcessor.TrainBuyAugFile, buySliderValue, x => ReportProgress(x * buyProgressScale));
                        DumpProcessor.Augment(DumpProcessor.TrainNoBuyFile, DumpProcessor.TrainNoBuyAugFile, noBuySliderValue, x => ReportProgress(buyProgressScale + x * noBuyProgressScale));
                    }

                    if (AugmentSell)
                    {
                        DumpProcessor.Augment(DumpProcessor.TrainSellFile, DumpProcessor.TrainSellAugFile, sellSliderValue, x => ReportProgress(buyProgressScale + noBuyProgressScale + x * sellProgressScale));
                        DumpProcessor.Augment(DumpProcessor.TrainNoSellFile, DumpProcessor.TrainNoSellAugFile, noSellSliderValue, x => ReportProgress(buyProgressScale + noBuyProgressScale + sellProgressScale + x * noSellProgressScale));
                    }
                }
                finally
                {
                    Dispatcher.BeginInvoke(new Action(() =>
                    {
                        IsBusy = false;
                        UpdateAugmentInfo();
                    }));
                }
            });
        }

        private void Merge()
        {
            IsBusy = true;

            var sum = 0;

            if (MergeBuy)
            {
                sum += testBuyCount + testNoBuyCount + trainBuyAugCount + trainNoBuyAugCount;
            }

            if (MergeSell)
            {
                sum += testSellCount + testNoSellCount + trainSellAugCount + trainNoSellAugCount;
            }

            var testBuyingProgressScale = MergeBuy ? (testBuyCount + testNoBuyCount) / (double)sum : 0;
            var trainBuyingProgressScale = MergeBuy ? (trainBuyAugCount + trainNoBuyAugCount) / (double)sum : 0;
            var testSellingProgressScale = MergeSell ? (testSellCount + testNoSellCount) / (double)sum : 0;
            var trainSellingProgressScale = MergeSell ? (trainSellAugCount + trainNoSellAugCount) / (double)sum : 0;

            Task.Run(() =>
            {
                try
                {
                    if (MergeBuy)
                    {
                        DumpProcessor.MergeRandom(DumpProcessor.TestBuyFile, DumpProcessor.TestNoBuyFile, DumpProcessor.TestBuyingFile, x => ReportProgress(x * testBuyingProgressScale));
                        DumpProcessor.MergeRandom(DumpProcessor.TrainBuyAugFile, DumpProcessor.TrainNoBuyAugFile, DumpProcessor.TrainBuyingFile, x => ReportProgress(testBuyingProgressScale + x * trainBuyingProgressScale));
                    }

                    if (MergeSell)
                    {
                        DumpProcessor.MergeRandom(DumpProcessor.TestSellFile, DumpProcessor.TestNoSellFile, DumpProcessor.TestSellingFile, x => ReportProgress(testBuyingProgressScale + trainBuyingProgressScale + x * testSellingProgressScale));
                        DumpProcessor.MergeRandom(DumpProcessor.TrainSellAugFile, DumpProcessor.TrainNoSellAugFile, DumpProcessor.TrainSellingFile, x => ReportProgress(testBuyingProgressScale + trainBuyingProgressScale + testSellingProgressScale + x * trainSellingProgressScale));
                    }
                }
                finally
                {
                    Dispatcher.BeginInvoke(new Action(() =>
                    {
                        IsBusy = false;
                        UpdateMergeInfo();
                    }));
                }
            });
        }

        private void SetAugmentSliderValues()
        {
            var augmentBuySliderValue = trainBuyCount == 0 ? 0 : (trainBuyCount + trainNoBuyCount) / (double)trainBuyCount * AugmentFactor;
            var augmentNoBuySliderValue = trainNoBuyCount == 0 ? 0 : (trainBuyCount + trainNoBuyCount) / (double)trainNoBuyCount * AugmentFactor;
            var augmentSellSliderValue = trainSellCount == 0 ? 0 : (trainSellCount + trainNoSellCount) / (double)trainSellCount * AugmentFactor;
            var augmentNoSellSliderValue = trainNoSellCount == 0 ? 0 : (trainSellCount + trainNoSellCount) / (double)trainNoSellCount * AugmentFactor;

            AugmentBuyFactorMax = Math.Max(AugmentBuyFactorMax, (int)augmentBuySliderValue);
            AugmentNoBuyFactorMax = Math.Max(AugmentNoBuyFactorMax, (int)augmentNoBuySliderValue);
            AugmentSellFactorMax = Math.Max(AugmentSellFactorMax, (int)augmentSellSliderValue);
            AugmentNoSellFactorMax = Math.Max(AugmentNoSellFactorMax, (int)augmentNoSellSliderValue);

            AugmentBuyFactor = (int)augmentBuySliderValue;
            AugmentNoBuyFactor = (int)augmentNoBuySliderValue;
            AugmentSellFactor = (int)augmentSellSliderValue;
            AugmentNoSellFactor = (int)augmentNoSellSliderValue;
        }

        private async Task<Tuple<int, Stream>> DownloadStream()
        {
            var httpProvider = new HttpProvider()
            {
                ProxyAddress = Settings.Default.ProxyAddress,
                ProxyUser = Settings.Default.ProxyUser,
                ProxyPassword = Settings.Default.ProxyPassword
            };

            var response = await httpProvider.Login(
                Settings.Default.StockFlowAddress + "/signin", 
                Settings.Default.StockFlowUser, 
                Settings.Default.StockFlowPassword);

            var countJson = await httpProvider.Get(
                string.Format(Settings.Default.StockFlowAddress + "/api/count/snapshots"));
            var couunt = int.Parse(countJson);

            var stream = await httpProvider.GetStream(
                string.Format(Settings.Default.StockFlowAddress + "/api/export/user/snapshots/19700101"));
            return new Tuple<int, Stream>(couunt, stream);
        }

        private Stream LoadFileDialog()
        {
            var dialog = new OpenFileDialog();
            if (dialog.ShowDialog() == true)
            {
                return dialog.OpenFile();
            }

            return null;
        }

        private void ReportProgress(double progress)
        {
            Dispatcher.BeginInvoke(new Action(() =>
            {
                Progress = progress >= 1 ? 0 : progress;
            }));
        }

        private void UpdateDumpFileInfo()
        {
            DumpFileInfo = string.Format(
                "{0} datasets available",
                DumpProcessor.CountLines(DumpProcessor.FlatDumpFile, line => true) - 1);
        }

        private void UpdateSplitFileInfo()
        {
            flatBuyCount = DumpProcessor.CountLines(DumpProcessor.FlatBuyFile, line => true) - 1;
            flatNoBuyCount = DumpProcessor.CountLines(DumpProcessor.FlatNoBuyFile, line => true) - 1;
            flatSellCount = DumpProcessor.CountLines(DumpProcessor.FlatSellFile, line => true) - 1;
            flatNoSellCount = DumpProcessor.CountLines(DumpProcessor.FlatNoSellFile, line => true) - 1;

            SplitFileInfo = string.Format(
                "{0} buy\n{1} nobuy\n{2} sell\n{3} nosell", flatBuyCount, flatNoBuyCount, flatSellCount, flatNoSellCount);

            SetSplitSliderValues();
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

            SplitTrainTestInfo = string.Format(
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

            AugmentInfo = string.Format(
                "{0} train buy\n{1} train nobuy\n{2} train sell\n{3} train nosell",
                trainBuyAugCount, trainNoBuyAugCount, trainSellAugCount, trainNoSellAugCount);
        }

        private void UpdateMergeInfo()
        {
            MergeInfo = string.Format(
                "{0} test no/buy\n{1} test no/sell\n{2} train no/buy\n{3} train no/sell",
                DumpProcessor.CountLines(DumpProcessor.TestBuyingFile, line => true) - 1,
                DumpProcessor.CountLines(DumpProcessor.TestSellingFile, line => true) - 1,
                DumpProcessor.CountLines(DumpProcessor.TrainBuyingFile, line => true) - 1,
                DumpProcessor.CountLines(DumpProcessor.TrainSellingFile, line => true) - 1);
        }

        private void Learn()
        {
            IsBusy = true;
            ProcessLog = "";

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
                IsBusy = false;
                ProcessLog += "\n" + ex.ToString();
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
            Process = new Process();

            //This is importend, else some Events will not fire!
            Process.EnableRaisingEvents = true;

            // passing the Startinfo to the process
            Process.StartInfo = procStartInfo;

            // The given Funktion will be raised if the Process wants to print an output to consol                    
            Process.OutputDataReceived += OnOutputDataReceived;
            // Std Error
            Process.ErrorDataReceived += OnOutputDataReceived;
            // If Batch File is finished this Event will be raised
            Process.Exited += Exited;

            try
            {
                Process.Start();
                Process.BeginOutputReadLine();
                Process.BeginErrorReadLine();
            }
            catch (Exception ex)
            {
                ProcessLog += ex.ToString();
                IsBusy = false;
                Process = null;
            }
        }

        private void OnOutputDataReceived(object sender, DataReceivedEventArgs e)
        {
            if (OutputDataReceived != null)
            {
                OutputDataReceived.Invoke(e.Data);
            }
        }

        private void Exited(object sender, EventArgs e)
        {
            Dispatcher.Invoke(() =>
            {
                IsBusy = false;
                Process = null;
            });
        }
    }
}
