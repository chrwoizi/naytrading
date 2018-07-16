using System;
using System.Collections;
using System.Collections.Generic;

namespace NAYtrading.Trader.Models
{
    public class TradeSuggestion
    {
        public int ID { get; set; }

        public int SnapshotId { get; set; }

        public DateTime Time { get; set; }

        public string InstrumentName { get; set; }

        public string Isin { get; set; }

        public string Wkn { get; set; }

        public string Action { get; set; }

        public decimal Price { get; set; }

        public IList<TradeLog> Logs { get; set; }
    }
}