using System;

namespace StockFlow.Web.Models
{
    public class SnapshotRate
    {
        public int ID { get; set; }
        
        public DateTime Time { get; set; }
        
        public string TimeString
        {
            get
            {
                return Time.ToString("dd.MM.yy");
            }
        }

        public decimal? Open { get; set; }
        public decimal? Close { get; set; }
        public decimal? High { get; set; }
        public decimal? Low { get; set; }
    }
}