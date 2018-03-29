namespace StockFlow
{
    using System.Windows;

    using Python.Runtime;

    /// <summary>
    /// Interaction logic for MainWindow.xaml
    /// </summary>
    public partial class MainWindow : Window
    {
        private MainViewModel ViewModel
        {
            get
            {
                return DataContext as MainViewModel;
            }
        }

        public MainWindow()
        {
            DataContext = new MainViewModel()
            {
                Dispatcher = Dispatcher
            };
            InitializeComponent();
            ViewModel.OutputDataReceived += OnOutput;
        }

        private void Settings_OnClick(object sender, RoutedEventArgs e)
        {
            new SettingsWindow() { DataContext = new SettingsViewModel() }.ShowDialog();
        }

        private void OnOutput(string data)
        {
            Dispatcher.Invoke(() =>
            {
                TextBlock.Text += "\n" + data;
                TextBlock.ScrollToEnd();
            });
        }

        private void Window_Closing(object sender, System.ComponentModel.CancelEventArgs e)
        {
            if (ViewModel.Process != null)
            {
                ViewModel.Process.Kill();
                ViewModel.Process = null;
            }
        }
    }
}
