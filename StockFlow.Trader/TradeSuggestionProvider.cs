using Newtonsoft.Json;
using StockFlow.Trader.Models;
using StockFlow.Web.Models;
using System;
using System.Collections.Generic;
using System.Configuration;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace StockFlow.Trader
{
    public class TradeSuggestionProvider
    {
        public static async Task Refresh()
        {
            string user = ConfigurationManager.AppSettings["TradeDecisionsUser"];
            string password = ConfigurationManager.AppSettings["TradeDecisionsPassword"];

            if (string.IsNullOrEmpty(user))
            {
                Console.Write("Stockflow User: ");
                user = Console.ReadLine();
                ConfigurationManager.AppSettings["TradeDecisionsUser"] = user;
            }

            if (string.IsNullOrEmpty(password))
            {
                Console.Write("Stockflow Password: ");
                password = ConsoleHelper.ReadPassword('*');
                ConfigurationManager.AppSettings["TradeDecisionsPassword"] = password;
            }

            var httpProvider = new HttpProvider();

            Console.WriteLine("Signing in...");
            var response = await httpProvider.Login(ConfigurationManager.AppSettings["TradeDecisionsLoginAddress"], user, password);
            Console.WriteLine("Signed in");

            DateTime date;
            using (var db = new TradeDBContext())
            {
                date = db.TradeSuggestions.Select(x => x.Time).OrderByDescending(x => x).FirstOrDefault();
                if (date == DateTime.MinValue)
                {
                    date = DateTime.Today.AddDays(-7);
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

            Console.WriteLine("Done");
        }
    }
}
