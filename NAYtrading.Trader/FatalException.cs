using System;

namespace NAYtrading.Trader
{
    public class FatalException : Exception
    {
        public FatalException(string message) : base(message)
        {
        }

        public FatalException(string message, Exception innerException) : base(message, innerException)
        {
        }
    }
}
