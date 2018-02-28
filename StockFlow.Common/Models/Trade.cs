using System;

namespace StockFlow.Web.Models
{
    public class Trade
    {
        public int SnapshotId { get; set; }

        public int InstrumentId { get; set; }

        public string InstrumentName { get; set; }

        public string Isin { get; set; }

        public string Wkn { get; set; }

        public DateTime Time { get; set; }

        public string Decision { get; set; }

        public decimal Price { get; set; }
    }
}