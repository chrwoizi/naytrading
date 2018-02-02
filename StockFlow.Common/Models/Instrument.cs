using System.ComponentModel.DataAnnotations.Schema;

namespace StockFlow.Web.Models
{
    public class Instrument
    {
        public int ID { get; set; }

        public string Source { get; set; }

        public string InstrumentName { get; set; }

        public string InstrumentId { get; set; }
        
        public string MarketId { get; set; }

        public decimal? Capitalization { get; set; }

        public string User { get; set; }
        
        public int Strikes { get; set; }
        
        public string Isin { get; set; }
        
        public string Wkn { get; set; }
    }
}