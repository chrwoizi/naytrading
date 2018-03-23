using System;
using System.Collections.Generic;

namespace StockFlow.Web.Models
{
    public class Stats
    {
        public List<Sale> Sales { get; set; }
        
        public class Sale
        {
            public DateTime Time { get; set; }

            public bool IsComplete { get; set; }

            public decimal Return { get; set; }

            public string InstrumentName { get; set; }
        }
    }
}