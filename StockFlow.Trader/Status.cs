using System;

namespace StockFlow.Trader
{
    public enum Status
    {
        Initial,
        FatalError,
        TemporaryError,
        PlacingOrder,
        Complete
    }
}