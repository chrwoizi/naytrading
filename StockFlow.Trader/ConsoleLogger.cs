using System;
using System.Diagnostics;
using System.Text;

namespace StockFlow.Trader
{
    public class ConsoleLogger : BaseLogger
    {
        public ConsoleLogger(ILogger parentLogger = null)
            : base(parentLogger)
        {
        }

        public override void Write(string v)
        {
            base.Write(v);

            Console.Write(v);
            Debug.Write(v);
        }

        public override void WriteLine(string v)
        {
            base.WriteLine(v);

            Console.WriteLine(DateTime.Now.ToString("HH:mm:ss") + " " + v);
            Debug.WriteLine(DateTime.Now.ToString("HH:mm:ss") + " " + v);
        }
    }
}