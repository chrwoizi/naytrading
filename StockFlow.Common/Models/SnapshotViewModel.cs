﻿using Newtonsoft.Json;
using System.Collections.Generic;
using System.Linq;

namespace StockFlow.Web.Models
{
    public class SnapshotViewModel
    {
        [JsonIgnore]
        public Snapshot Model { get; set; }

        public int ID { get { return Model.ID; } }

        public Instrument Instrument { get { return Model.Instrument; } }
        
        public string StartTime
        {
            get
            {
                return Model.StartTime.ToString("dd.MM.yy");
            }
        }
        
        public string Date
        {
            get
            {
                return Model.Time.ToString("dd.MM.yy");
            }
        }

        public string DateSortable
        {
            get
            {
                return Model.Time.ToString("yyMMdd");
            }
        }

        public string ModifiedDateSortable
        {
            get
            {
                return Model.ModifiedTime.ToString("yyMMddHHmmss");
            }
        }
        
        public string ModifiedDate
        {
            get
            {
                return Model.ModifiedTime.ToString("dd.MM.yy");
            }
        }
        
        public List<SnapshotRateViewModel> Rates
        {
            get
            {
                if (Model.Rates != null)
                {
                    return Model.Rates.Select(x => new SnapshotRateViewModel { Model = x }).ToList();
                }

                return null;
            }
        }

        public string Decision { get { return Model.Decision; } }
        
        public string PreviousDecision { get { return Model.PreviousDecision; } }
        
        public decimal? PreviousBuyRate { get { return Model.PreviousBuyRate; } }
        
        public string PreviousTime
        {
            get
            {
                return Model.PreviousTime.HasValue ? Model.PreviousTime.Value.ToString("dd.MM.yy") : null;
            }
        }

        public string User { get { return Model.User; } }
    }
}