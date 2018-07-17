using System;

namespace NAYtrading.Trader
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