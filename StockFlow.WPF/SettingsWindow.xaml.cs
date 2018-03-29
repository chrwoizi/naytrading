using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;

namespace StockFlow
{
    /// <summary>
    /// Interaction logic for SettingsWindow.xaml
    /// </summary>
    public partial class SettingsWindow : Window
    {
        private SettingsViewModel ViewModel
        {
            get
            {
                return DataContext as SettingsViewModel;
            }
        }

        public SettingsWindow()
        {
            InitializeComponent();
            DataContextChanged += SettingsWindow_DataContextChanged;
        }

        private void SettingsWindow_DataContextChanged(object sender, DependencyPropertyChangedEventArgs e)
        {
            this.PasswordBox.Password = ViewModel.ProxyPassword;
            this.StockFlowPasswordBox.Password = ViewModel.StockFlowPassword;
        }

        private void PasswordBox_OnPasswordChanged(object sender, RoutedEventArgs e)
        {
            ViewModel.ProxyPassword = PasswordBox.Password;
        }

        private void StockFlowPasswordBox_OnPasswordChanged(object sender, RoutedEventArgs e)
        {
            ViewModel.StockFlowPassword = StockFlowPasswordBox.Password;
        }
    }
}
