using Newtonsoft.Json;

namespace StockFlow.Web.Models
{
    public class SnapshotRateViewModel
    {
        [JsonIgnore]
        public SnapshotRate Model { get; set; }
        
        public string T
        {
            get
            {
                return Model.Time.ToString("dd.MM.yy");
            }
        }
        
        public decimal? C { get { return Model.Close; } }
    }
}