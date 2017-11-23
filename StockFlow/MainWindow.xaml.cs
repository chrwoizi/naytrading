namespace StockFlow
{
    using System.Collections.Generic;
    using System.IO;
    using System.Linq;
    using System.Windows;

    using Python.Runtime;
    
    /// <summary>
    /// Interaction logic for MainWindow.xaml
    /// </summary>
    public partial class MainWindow : Window
    {
        public MainWindow()
        {
            InitializeComponent();
            Loaded += MainWindow_Loaded;
        }

        private void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            ButtonBase_OnClick(null, null);
        }

        private void ButtonBase_OnClick(object sender, RoutedEventArgs e)
        {
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
    }
}
