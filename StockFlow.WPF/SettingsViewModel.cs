using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace StockFlow
{
    using System.ComponentModel;
    using System.Runtime.CompilerServices;

    using StockFlow.Annotations;
    using StockFlow.Properties;

    public class SettingsViewModel : INotifyPropertyChanged
    {
        public string ProxyAddress
        {
            get
            {
                return Settings.Default.ProxyAddress;
            }
            set
            {
                Settings.Default.ProxyAddress = value;
                Settings.Default.Save();
                this.OnPropertyChanged();
            }
        }

        public string ProxyUser
        {
            get
            {
                return Settings.Default.ProxyUser;
            }
            set
            {
                Settings.Default.ProxyUser = value;
                Settings.Default.Save();
                this.OnPropertyChanged();
            }
        }

        public string ProxyPassword
        {
            get
            {
                return Settings.Default.ProxyPassword;
            }
            set
            {
                Settings.Default.ProxyPassword = value;
                Settings.Default.Save();
                this.OnPropertyChanged();
            }
        }

        public string Python
        {
            get
            {
                return Settings.Default.Python;
            }
            set
            {
                Settings.Default.Python = value;
                Settings.Default.Save();
                this.OnPropertyChanged();
            }
        }

        public string StockFlowAddress
        {
            get
            {
                return Settings.Default.StockFlowAddress;
            }
            set
            {
                Settings.Default.StockFlowAddress = value;
                Settings.Default.Save();
                this.OnPropertyChanged();
            }
        }

        public string StockFlowUser
        {
            get
            {
                return Settings.Default.StockFlowUser;
            }
            set
            {
                Settings.Default.StockFlowUser = value;
                Settings.Default.Save();
                this.OnPropertyChanged();
            }
        }

        public string StockFlowPassword
        {
            get
            {
                return Settings.Default.StockFlowPassword;
            }
            set
            {
                Settings.Default.StockFlowPassword = value;
                Settings.Default.Save();
                this.OnPropertyChanged();
            }
        }

        public event PropertyChangedEventHandler PropertyChanged;

        [NotifyPropertyChangedInvocator]
        protected virtual void OnPropertyChanged([CallerMemberName] string propertyName = null)
        {
            this.PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }
    }
}
