using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;

namespace StockFlow.Web.Models
{
    public class Snapshot
    {
        public long ID { get; set; }

        public DateTime StartTime { get; set; }
        
        public DateTime Time { get; set; }

        public long DecisionId { get; set; }

        public string Decision { get; set; }

        public DateTime DecisionTime { get; set; }

        public decimal Price { get; set; }

        public DateTime PriceTime { get; set; }

        public int Instrument_ID { get; set; }

        public Instrument instrument { get; set; }

        public List<SnapshotRate> snapshotrates { get; set; }
    }
}