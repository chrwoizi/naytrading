using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace StockFlow.Web.Models
{
    public class StatsViewModel
    {
        [JsonIgnore]
        public Stats Model { get; set; }

        public List<SaleViewModel> Sales
        {
            get
            {
                if (Model.Sales != null)
                {
                    return Model.Sales.Select(x => new SaleViewModel { Model = x }).ToList();
                }

                return null;
            }
        }

        public class SaleViewModel
        {
            [JsonIgnore]
            public Stats.Sale Model { get; set; }

            public string D
            {
                get
                {
                    return Model.Time.ToString("dd.MM.yy");
                }
            }

            public string DS
            {
                get
                {
                    return Model.Time.ToString("yyMMdd");
                }
            }

            public string S
            {
                get
                {
                    return Model.IsComplete ? "c" : "o";
                }
            }

            public decimal R
            {
                get
                {
                    return ((int)(Model.Return * 10000)) / 10000m;
                }
            }

            public string I
            {
                get
                {
                    return Model.InstrumentName;
                }
            }
        }
    }
}