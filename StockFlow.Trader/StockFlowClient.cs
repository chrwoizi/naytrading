using Newtonsoft.Json;
using StockFlow.Common.Net;
using StockFlow.Trader.Models;
using StockFlow.Common.Net.Models;
using System;
using System.Collections.Generic;
using System.Configuration;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;

namespace StockFlow.Trader
{
    public class StockFlowClient
    {
        private HttpProvider httpProvider;

        public StockFlowClient()
        {
            httpProvider = new HttpProvider();
            httpProvider.ProxyAddress = ConfigurationManager.AppSettings.Get("ProxyAddress");
            httpProvider.ProxyUser = ConfigurationManager.AppSettings.Get("ProxyUser");
            httpProvider.ProxyPassword = ConfigurationManager.AppSettings.Get("ProxyPassword");
        }

        public async Task Login(string user, string password)
        {
            Console.WriteLine("Signing in at stockflow...");
            var url = ConfigurationManager.AppSettings["StockFlowAddress"] + "/signin";
            var response = await httpProvider.Login(url, user, password);
            Console.WriteLine("Signed in");
        }

        public async Task SetInstrumentWeight(string isinOrWkn, string type, decimal weight)
        {
            try
            {
                Console.WriteLine("Setting weight " + type + " of instrument " + isinOrWkn + " to " + weight + " at stockflow...");
                var url = string.Format(ConfigurationManager.AppSettings["StockFlowAddress"] + "/api/weight/{0}/{1}/{2}", isinOrWkn, type, weight);
                var response = await httpProvider.Post(url);
                if (response == "{}")
                {
                    Console.WriteLine("Weight is set");
                }
                else
                {
                    throw new Exception(response);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("Error while setting instrument weight: " + ex.Message);
            }
        }

        public async Task Refresh()
        {
            DateTime date;
            using (var db = new TradeDBContext())
            {
                date = db.TradeSuggestions.Select(x => x.Time).OrderByDescending(x => x).FirstOrDefault();
                if (date == DateTime.MinValue)
                {
                    date = DateTime.UtcNow.AddHours(-double.Parse(ConfigurationManager.AppSettings["MaxSuggestionAge"], CultureInfo.InvariantCulture));
                }
            }

            Console.WriteLine("Loading trade suggestions after " + date.ToString("dd.MM.yyyy HH:mm:ss") + "...");

            var url = string.Format(ConfigurationManager.AppSettings["StockFlowAddress"] + "/api/export/user/trades/{0:yyyyMMdd}", date);
            var json = await httpProvider.Get(url);

            var trades = JsonConvert.DeserializeObject<Trade[]>(json);
            Console.WriteLine("Received " + trades.Length + " trade suggestions");

            foreach (var trade in trades)
            {
                using (var db = new TradeDBContext())
                {
                    var suggestion = db.TradeSuggestions.FirstOrDefault(x => x.SnapshotId == trade.SnapshotId);
                    if (suggestion == null)
                    {
                        suggestion = new TradeSuggestion();
                        suggestion.SnapshotId = trade.SnapshotId;
                        suggestion.Time = trade.Time;
                        suggestion.InstrumentName = trade.InstrumentName;
                        suggestion.Isin = trade.Isin;
                        suggestion.Wkn = trade.Wkn;
                        suggestion.Action = trade.Decision;
                        suggestion.Price = trade.Price;
                        suggestion.Logs = new List<TradeLog>();
                        db.TradeSuggestions.Add(suggestion);

                        Console.WriteLine("Saving trade suggestion: " + suggestion.Action + " " + suggestion.InstrumentName + " for " + trade.Price + " EUR");
                        db.SaveChanges();
                    }
                }
            }

            if (trades.Any())
            {
                Console.WriteLine("All suggestions saved");
            }
        }
    }
}
