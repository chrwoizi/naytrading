using Newtonsoft.Json;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace StockFlow.Web.Models
{
    public class TradeViewModel
    {
        [JsonIgnore]
        public Trade Model { get; set; }

        public int ID { get { return Model.SnapshotId; } }

        public string InstrumentSource { get { return Model.Instrument.Source; } }

        public string InstrumentId { get { return Model.Instrument.InstrumentId; } }

        public string Isin { get { return Model.Instrument.Isin; } }

        public string Wkn { get { return Model.Instrument.Wkn; } }

        public string Time
        {
            get
            {
                return Model.Time.ToString("dd.MM.yy HH:mm:ss", CultureInfo.InvariantCulture);
            }
        }
        
        public string Decision { get { return Model.Decision; } }
        
        public decimal Price { get { return Model.Price; } }
    }
}