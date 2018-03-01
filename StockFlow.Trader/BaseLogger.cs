using System;
using System.Text;

namespace StockFlow.Trader
{
    public class BaseLogger : ILogger
    {
        private ILogger parentLogger;

        public StringBuilder History = new StringBuilder();

        public BaseLogger(ILogger parentLogger = null)
        {
            this.parentLogger = parentLogger;
        }

        public virtual void Write(string v)
        {
            History.Append(v);

            if (this.parentLogger != null)
                this.parentLogger.Write(v);
        }

        public virtual void WriteLine(string v)
        {
            History.Append(v);
            History.AppendLine();

            if (this.parentLogger != null)
                this.parentLogger.WriteLine(v);
        }
    }
}