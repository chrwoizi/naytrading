﻿using System;

namespace YahooFinanceApi
{
    public class DividendTick: ITick
    {
        public DateTime DateTime { get; internal set; }

        public decimal Dividend { get; internal set; }
    }
}
