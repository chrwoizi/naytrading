using System;
using System.Runtime.Serialization;

namespace StockFlow.Trader
{
    [Serializable]
    public class CancelOrderException : Exception
    {
        public readonly Status Status;

        public CancelOrderException(Status severity)
        {
            Status = severity;
        }

        public CancelOrderException(Status severity, string message) : base(message)
        {
            Status = severity;
        }

        public CancelOrderException(Status severity, string message, Exception innerException) : base(message, innerException)
        {
            Status = severity;
        }

        protected CancelOrderException(SerializationInfo info, StreamingContext context) : base(info, context)
        {
        }
    }
}