using System;

namespace StockFlow.Web.Models
{
    public class Trade
    {
        public Instrument Instrument { get; set; }

        public int SnapshotId { get; set; }
        
        public DateTime Time { get; set; }

        public string Decision { get; set; }

        public decimal Price { get; set; }
    }
}