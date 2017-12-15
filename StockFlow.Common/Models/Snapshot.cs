using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;

namespace StockFlow.Web.Models
{
    public class Snapshot
    {
        public int ID { get; set; }

        public Instrument Instrument { get; set; }
        
        public DateTime StartTime { get; set; }

        [NotMapped]
        public string StartTimeString
        {
            get
            {
                return StartTime.ToString("dd.MM.yy");
            }
        }
        
        public DateTime Time { get; set; }

        [NotMapped]
        public string TimeString
        {
            get
            {
                return Time.ToString("dd.MM.yy");
            }
        }
        
        public DateTime ModifiedTime { get; set; }

        [NotMapped]
        public string ModifiedTimeString
        {
            get
            {
                return ModifiedTime.ToString("dd.MM.yy HH:mm:ss");
            }
        }

        [NotMapped]
        public string ModifiedDateString
        {
            get
            {
                return ModifiedTime.ToString("dd.MM.yy");
            }
        }

        public List<SnapshotRate> Rates { get; set; }

        public string Decision { get; set; }

        [NotMapped]
        public string PreviousDecision { get; set; }

        [NotMapped]
        public decimal? PreviousBuyRate { get; set; }

        [NotMapped]
        public DateTime? PreviousTime { get; set; }

        [NotMapped]
        public string PreviousTimeString
        {
            get
            {
                return PreviousTime.HasValue ? PreviousTime.Value.ToString("dd.MM.yy") : null;
            }
        }

        public string User { get; set; }
    }
}