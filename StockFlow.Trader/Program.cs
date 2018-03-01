using Newtonsoft.Json;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Remote;
using StockFlow.Trader.Models;
using StockFlow.Web.Models;
using System;
using System.Collections.Generic;
using System.Configuration;
using System.Data.Entity;
using System.IO;
using System.Linq;
using System.Net;
using System.Threading;
using System.Threading.Tasks;

namespace StockFlow.Trader
{
    class Program
    {
        static void Main(string[] args)
        {
            if (ConfigurationManager.AppSettings.Get("RebuildDatabase") == "true")
            {
                Database.SetInitializer(new DropCreateDatabaseAlways<TradeDBContext>());
            }

            if (!string.IsNullOrEmpty(ConfigurationManager.AppSettings["ProxyUser"]))
            {
                if (string.IsNullOrEmpty(ConfigurationManager.AppSettings["ProxyPassword"]))
                {
                    Console.Write("Proxy password: ");
                    var password = ConsoleHelper.ReadPassword('*');
                    ConfigurationManager.AppSettings["ProxyPassword"] = password;
                }
            }

            if (args.Length == 1 && args[0] == "settan")
            {
                Console.Write("TANs comma-separated (A1-A9, B1-B9, ...): ");
                var tans = ConsoleHelper.ReadPassword('*');
                Console.Write("TAN file password: ");
                var password = ConsoleHelper.ReadPassword('*');
                var cipher = StringCipher.Encrypt(tans, password);
                File.WriteAllText(ConfigurationManager.AppSettings["TanFilePath"], cipher);
            }
            else if (args.Length == 1 && args[0] == "gettan")
            {
                Console.Write("Challenge space-separated: ");
                var challenge = Console.ReadLine().Split(' ');
                Console.Write("TAN file password: ");
                var password = ConsoleHelper.ReadPassword('*');
                var tanProvider = new FlatexTanProvider(password);
                var tan = tanProvider.GetTan(challenge[0], challenge[1], challenge[2]);
                Console.WriteLine("TAN: " + tan);
            }
            else if (args.Length == 1 && args[0] == "buy")
            {
                Console.Write("Broker account: ");
                var user = Console.ReadLine();

                Console.Write("Broker password: ");
                var password = ConsoleHelper.ReadPassword('*');

                var globalLogger = new ConsoleLogger();

                var db = new TradeDBContext();

                var oldestSuggestionTime = DateTime.Today.AddDays(-7);
                var maxRetryCount = 10;
                var minBuyOrderPrice = 500;
                var maxBuyOrderPrice = 1000;

                var suggestionsQuery =
                    from suggestion in db.TradeSuggestions
                    where suggestion.Time >= oldestSuggestionTime
                    where suggestion.Logs.All(x => x.Status != Status.Complete.ToString())
                    let lastLog = suggestion.Logs.OrderByDescending(x => x.Time).FirstOrDefault()
                    where lastLog == null || lastLog.Status == Status.Initial.ToString() || lastLog.Status == Status.TemporaryError.ToString()
                    where suggestion.Logs.Count(x => x.Status == Status.TemporaryError.ToString()) < maxRetryCount
                    select suggestion;

                var suggestions = suggestionsQuery.ToList();

                if (suggestions.Any())
                {
                    using (var controller = new OrderController(user, password, false, new Flatex(), globalLogger, new ConsoleTanProvider()))
                    {
                        var availableFunds = controller.AvailableFunds;

                        foreach (var suggestion in suggestions)
                        {
                            globalLogger.WriteLine(string.Format("Processing snapshot {0}: {1} {2} at {3} EUR", suggestion.SnapshotId, suggestion.Action, suggestion.InstrumentName, suggestion.Price));

                            var suggestionLogger = new BaseLogger(globalLogger);

                            var log = new TradeLog();
                            log.Price = suggestion.Price;
                            log.Time = DateTime.UtcNow;
                            log.TradeSuggestion = suggestion;

                            int quantity = 0;

                            try
                            {
                                try
                                {
                                    string instrumentId = suggestion.Isin;

                                    if (string.IsNullOrEmpty(instrumentId))
                                    {
                                        instrumentId = suggestion.Wkn;
                                    }

                                    if (string.IsNullOrEmpty(instrumentId))
                                    {
                                        throw new CancelOrderException(Status.FatalError, "No ISIN or WKN given");
                                    }

                                    TradingAction action;

                                    switch (suggestion.Action)
                                    {
                                        case "buy":
                                            action = TradingAction.Buy;

                                            if (availableFunds < minBuyOrderPrice)
                                            {
                                                suggestionLogger.WriteLine("Insufficient funds to buy anything: " + availableFunds + " EUR");
                                                continue;
                                            }

                                            suggestionLogger.WriteLine("Available funds: " + availableFunds + " EUR");
                                            var upperLimit = Math.Min(availableFunds, maxBuyOrderPrice);
                                            suggestionLogger.WriteLine("Desired buy order total: " + upperLimit + " EUR");

                                            quantity = (int)(upperLimit / suggestion.Price);
                                            suggestionLogger.WriteLine("Calculated quantity to buy: " + quantity + " at " + suggestion.Price + " EUR each");

                                            var total = quantity * suggestion.Price;
                                            suggestionLogger.WriteLine("Calculated buy order total: " + total + " EUR");

                                            if (total < minBuyOrderPrice)
                                            {
                                                throw new CancelOrderException(Status.TemporaryError, "Buy order total is too low");
                                            }

                                            break;

                                        case "sell":
                                            action = TradingAction.Sell;

                                            var previousBuyOrders =
                                                from buySuggestion in db.TradeSuggestions
                                                where buySuggestion.Action == "buy"
                                                where buySuggestion.Isin == suggestion.Isin || buySuggestion.Wkn == suggestion.Wkn
                                                let buyLog = buySuggestion.Logs.OrderByDescending(x => x.Time).FirstOrDefault(x => x.Status == Status.Complete.ToString())
                                                orderby buyLog.Time descending
                                                select buyLog;
                                            var previousBuyOrder = previousBuyOrders.FirstOrDefault();

                                            if (previousBuyOrder == null)
                                            {
                                                throw new CancelOrderException(Status.FatalError, "No previous buy order found");
                                            }

                                            quantity = previousBuyOrder.Quantity;
                                            suggestionLogger.WriteLine("Previously bought quantity: " + quantity);
                                            break;

                                        default:
                                            throw new CancelOrderException(Status.FatalError, "Trading action " + suggestion.Action + " is unknown");
                                    }

                                    controller.Order(instrumentId, action, suggestion.Price, quantity);

                                    if (action == TradingAction.Buy)
                                    {
                                        availableFunds -= quantity * suggestion.Price;
                                    }

                                    log.Status = Status.Complete.ToString();
                                }
                                catch (CancelOrderException)
                                {
                                    throw;
                                }
                                catch (Exception ex)
                                {
                                    throw new CancelOrderException(Status.FatalError, "Unhandled exception: " + ex);
                                }
                            }
                            catch (CancelOrderException ex)
                            {
                                suggestionLogger.WriteLine("Order cancelled: [" + ex.Status + "] " + ex.Message);
                                log.Status = ex.Status.ToString();
                            }

                            try
                            {
                                log.Quantity = quantity;
                                log.Message = suggestionLogger.History.ToString();

                                suggestion.Logs.Add(log);
                                db.TradeLogs.Attach(log);
                                db.SaveChanges();
                            }
                            catch (Exception ex)
                            {
                                globalLogger.WriteLine("Exception while saving log: " + ex.ToString());
                            }
                        }
                    }
                }
                else
                {
                    globalLogger.WriteLine("Nothing to do");
                }
            }
            else
            {
                TradeSuggestionProvider.Refresh().Wait();
            }

            Console.WriteLine("Exit.");
            Console.ReadLine();
        }
    }
}
