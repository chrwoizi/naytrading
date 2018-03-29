using Newtonsoft.Json;
using StockFlow.Common;
using StockFlow.Trader.Models;
using StockFlow.Web.Models;
using System;
using System.Collections.Generic;
using System.Configuration;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace StockFlow.Trader
{
    public class TradeSuggestionProvider
    {
        public static async Task Refresh(string user, string password)
        {
            var httpProvider = new HttpProvider();
            httpProvider.ProxyAddress = ConfigurationManager.AppSettings.Get("ProxyAddress");
            httpProvider.ProxyUser = ConfigurationManager.AppSettings.Get("ProxyUser");
            httpProvider.ProxyPassword = ConfigurationManager.AppSettings.Get("ProxyPassword");

            Console.WriteLine("Signing in at stockflow...");
            var response = await httpProvider.Login(ConfigurationManager.AppSettings["TradeDecisionsLoginAddress"], user, password);
            Console.WriteLine("Signed in");

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

            var url = ConfigurationManager.AppSettings["TradeDecisionsDataAddress"];
            var json = await httpProvider.Get(string.Format(url, date));

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
