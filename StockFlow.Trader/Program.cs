using Newtonsoft.Json;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Remote;
using PublicHoliday;
using StockFlow.Trader.Models;
using StockFlow.Web.Models;
using System;
using System.Collections.Generic;
using System.Configuration;
using System.Data.Entity;
using System.Globalization;
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
            else if (args.Length == 1 && args[0] == "testbroker")
            {
                try
                {
                    var user = ConfigurationManager.AppSettings["BrokerUser"];
                    if (string.IsNullOrEmpty(user))
                    {
                        Console.Write("Broker account: ");
                        user = Console.ReadLine();
                    }

                    var password = ConfigurationManager.AppSettings["BrokerPassword"];
                    if (string.IsNullOrEmpty(password))
                    {
                        Console.Write("Broker password: ");
                        password = ConsoleHelper.ReadPassword('*');
                    }

                    var globalLogger = new ConsoleLogger();

                    using (var controller = new OrderController(user, password, false, new Flatex(), globalLogger, new ConsoleTanProvider()))
                    {
                        var quantity = controller.GetOwnedQuantity("US1266541028", null);
                        globalLogger.WriteLine(quantity.ToString());

                        var quantity2 = controller.GetOwnedQuantity(null, "A2ALU7");
                        globalLogger.WriteLine(quantity2.ToString());

                        var quantity3 = controller.GetOwnedQuantity("US1266541028", "A2ALU7");
                        globalLogger.WriteLine(quantity3.ToString());
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine("Exception: " + ex);
                }
            }
            else
            {
                Run();
            }

            Console.WriteLine("Exit.");
            Console.ReadLine();
        }

        private static void Run()
        {
            try
            {
                string stockflowUser = ConfigurationManager.AppSettings["StockFlowUser"];
                if (string.IsNullOrEmpty(stockflowUser))
                {
                    Console.Write("Stockflow User: ");
                    stockflowUser = Console.ReadLine();
                }

                string stockflowPassword = ConfigurationManager.AppSettings["StockFlowPassword"];
                if (string.IsNullOrEmpty(stockflowPassword))
                {
                    Console.Write("Stockflow Password: ");
                    stockflowPassword = ConsoleHelper.ReadPassword('*');
                }

                var brokerUser = ConfigurationManager.AppSettings["BrokerUser"];
                if (string.IsNullOrEmpty(brokerUser))
                {
                    Console.Write("Broker account: ");
                    brokerUser = Console.ReadLine();
                }

                var brokerPassword = ConfigurationManager.AppSettings["BrokerPassword"];
                if (string.IsNullOrEmpty(brokerPassword))
                {
                    Console.Write("Broker password: ");
                    brokerPassword = ConsoleHelper.ReadPassword('*');
                }

                var tanFilePassword = ConfigurationManager.AppSettings["TanFilePassword"];
                if (string.IsNullOrEmpty(tanFilePassword))
                {
                    Console.Write("TAN file password: ");
                    tanFilePassword = ConsoleHelper.ReadPassword('*');

                    // check password
                    new FlatexTanProvider(tanFilePassword).GetTan("A1", "A1", "A1");
                }
                
                while (true)
                {
                    var globalLogger = new ConsoleLogger();
                    var stockFlowClient = new StockFlowClient();

                    stockFlowClient.Login(stockflowUser, stockflowPassword).Wait();
                    stockFlowClient.Refresh().Wait();

                    bool isStockExchangeOpen = IsStockExchangeOpen();
                    if (isStockExchangeOpen)
                    {
                        using (var db = new TradeDBContext())
                        {
                            var oldestSuggestionTime = DateTime.UtcNow.AddHours(-double.Parse(ConfigurationManager.AppSettings["MaxSuggestionAge"], CultureInfo.InvariantCulture));
                            var maxRetryCount = int.Parse(ConfigurationManager.AppSettings["MaxRetryCount"], CultureInfo.InvariantCulture);
                            var minBuyOrderPrice = decimal.Parse(ConfigurationManager.AppSettings["MinBuyOrderPrice"], CultureInfo.InvariantCulture);
                            var maxBuyOrderPrice = decimal.Parse(ConfigurationManager.AppSettings["MaxBuyOrderPrice"], CultureInfo.InvariantCulture);
                            var orderFee = decimal.Parse(ConfigurationManager.AppSettings["OrderFee"], CultureInfo.InvariantCulture);

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
                                using (var controller = new OrderController(brokerUser, brokerPassword, true, new Flatex(), globalLogger, new FlatexTanProvider(tanFilePassword)))
                                {
                                    var availableFunds = controller.GetAvailableFunds();
                                    foreach (var suggestion in suggestions)
                                    {
                                        ProcessSuggestion(suggestion, ref availableFunds, minBuyOrderPrice, maxBuyOrderPrice, orderFee, db, controller, stockFlowClient, globalLogger);
                                    }
                                }
                            }
                            else
                            {
                                globalLogger.WriteLine("No active suggestions");
                            }
                        }
                    }

                    var sleep = TimeSpan.FromMinutes(double.Parse(ConfigurationManager.AppSettings["SleepMinutesBetweenRuns"], CultureInfo.InvariantCulture));
                    globalLogger.WriteLine("Waiting " + sleep.ToString("hh\\:mm\\:ss"));
                    Thread.Sleep(sleep);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("Exception: " + ex);
            }
        }

        private static bool IsStockExchangeOpen()
        {
            bool isHoliday = new GermanPublicHoliday().IsPublicHoliday(DateTime.Today);
            if (isHoliday)
            {
                return false;
            }

            var day = DateTime.Now.ToString("dd.MM.yyyy", CultureInfo.InvariantCulture);
            var openingTime = DateTime.ParseExact(day + " " + ConfigurationManager.AppSettings["StockExchangeOpeningTime"], "dd.MM.yyyy HH:mm:ss", CultureInfo.InvariantCulture);
            var closingTime = DateTime.ParseExact(day + " " + ConfigurationManager.AppSettings["StockExchangeClosingTime"], "dd.MM.yyyy HH:mm:ss", CultureInfo.InvariantCulture);

            return DateTime.Now > openingTime && DateTime.Now < closingTime;
        }

        private static void ProcessSuggestion(TradeSuggestion suggestion, ref decimal availableFunds, decimal minBuyOrderPrice, decimal maxBuyOrderPrice, decimal orderFee, TradeDBContext db, OrderController controller, StockFlowClient stockFlowClient, ILogger globalLogger)
        {
            globalLogger.WriteLine(string.Format("Processing snapshot {0}: {1} {2} at {3} EUR", suggestion.SnapshotId, suggestion.Action, suggestion.InstrumentName, suggestion.Price));

            var suggestionLogger = new BaseLogger(globalLogger);

            var log = new TradeLog();
            log.Price = suggestion.Price;
            log.Time = DateTime.UtcNow;

            try
            {
                try
                {
                    string instrumentId = GetInstrumentId(suggestion);

                    TradingAction action;

                    int quantity;

                    if (suggestion.Action == "buy")
                    {
                        action = TradingAction.Buy;

                        if (availableFunds - orderFee < minBuyOrderPrice)
                        {
                            suggestionLogger.WriteLine("Insufficient funds to buy anything: " + availableFunds + " EUR");
                            return;
                        }

                        var ownedQuantity = controller.GetOwnedQuantity(suggestion.Isin, suggestion.Wkn);
                        if (ownedQuantity > 0)
                        {
                            throw new CancelOrderException(Status.FatalError, "Already owning " + ownedQuantity + " stocks of this company");
                        }

                        quantity = GetBuyQuantity(suggestion, availableFunds, minBuyOrderPrice, maxBuyOrderPrice, orderFee, controller, suggestionLogger, instrumentId, action);
                    }
                    else if (suggestion.Action == "sell")
                    {
                        action = TradingAction.Sell;

                        quantity = GetSellQuantity(suggestion, db, controller, suggestionLogger, instrumentId, action);
                    }
                    else
                    {
                        throw new CancelOrderException(Status.FatalError, "Trading action " + suggestion.Action + " is unknown");
                    }

                    controller.PrepareOrder(action, suggestion.Price, quantity);

                    log.Quantity = quantity;
                    log.Message = suggestionLogger.History.ToString();
                    log.Status = Status.PlacingOrder.ToString();
                    SaveLog(log, suggestion, db);

                    controller.PlaceOrder();

                    log.Message = suggestionLogger.History.ToString();
                    log.Status = Status.Complete.ToString();
                    SaveLog(log, suggestion, db);

                    if (action == TradingAction.Buy)
                    {
                        availableFunds -= quantity * suggestion.Price;
                        availableFunds -= orderFee;
                        stockFlowClient.SetInstrumentWeight(suggestion.Isin ?? suggestion.Wkn, "Trader-bought", decimal.Parse(ConfigurationManager.AppSettings["BoughtInstrumentWeight"])).Wait();
                    }
                    else if (action == TradingAction.Sell)
                    {
                        availableFunds += quantity * suggestion.Price;
                        availableFunds -= 0.25m * quantity * suggestion.Price;
                        availableFunds -= orderFee;
                        stockFlowClient.SetInstrumentWeight(suggestion.Isin ?? suggestion.Wkn, "Trader-bought", 0).Wait();
                    }
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

                try
                {
                    log.Message = suggestionLogger.History.ToString();
                    SaveLog(log, suggestion, db);
                }
                catch (Exception ex2)
                {
                    globalLogger.WriteLine("Exception while saving log: " + ex2.ToString());
                }
            }
        }

        private static int GetSellQuantity(TradeSuggestion suggestion, TradeDBContext db, OrderController controller, BaseLogger suggestionLogger, string instrumentId, TradingAction action)
        {
            int quantity = controller.GetOwnedQuantity(suggestion.Isin, suggestion.Wkn);
            var previousBuyOrders =
                from buySuggestion in db.TradeSuggestions
                where buySuggestion.Action == "buy"
                where (buySuggestion.Isin != null && suggestion.Isin != null && buySuggestion.Isin == suggestion.Isin)
                || (buySuggestion.Wkn != null && suggestion.Wkn != null && buySuggestion.Wkn == suggestion.Wkn)
                let buyLog = buySuggestion.Logs.OrderByDescending(x => x.Time).FirstOrDefault(x => x.Status == Status.Complete.ToString())
                orderby buyLog.Time descending
                select buyLog;
            var previousBuyOrder = previousBuyOrders.FirstOrDefault();

            if (previousBuyOrder == null)
            {
                throw new CancelOrderException(Status.FatalError, "No previous buy order found");
            }

            if (quantity < previousBuyOrder.Quantity)
            {
                throw new CancelOrderException(Status.FatalError, "Portfolio contains less than bought quantity");
            }

            quantity = previousBuyOrder.Quantity;
            suggestionLogger.WriteLine("Previously bought quantity: " + quantity);

            var currentPrice = controller.GetCurrentPrice(instrumentId, action);
            if (currentPrice < suggestion.Price)
            {
                throw new CancelOrderException(Status.TemporaryError, "Too cheap to sell at " + currentPrice + ". Expected price to be " + suggestion.Price + " EUR or more");
            }

            return quantity;
        }

        private static int GetBuyQuantity(TradeSuggestion suggestion, decimal availableFunds, decimal minBuyOrderPrice, decimal maxBuyOrderPrice, decimal orderFee, OrderController controller, BaseLogger suggestionLogger, string instrumentId, TradingAction action)
        {
            int quantity;
            suggestionLogger.WriteLine("Available funds: " + availableFunds + " EUR");

            var currentPrice = controller.GetCurrentPrice(instrumentId, action);
            if (currentPrice > suggestion.Price)
            {
                throw new CancelOrderException(Status.TemporaryError, "Too expensive to buy at " + currentPrice + ". Expected price to be " + suggestion.Price + " EUR or less");
            }

            var upperLimit = Math.Min(availableFunds - orderFee, maxBuyOrderPrice);
            suggestionLogger.WriteLine("Desired buy order total: " + upperLimit + " EUR (+fee)");

            quantity = (int)(upperLimit / currentPrice);
            suggestionLogger.WriteLine("Calculated quantity to buy: " + quantity + " at " + currentPrice + " EUR each");

            var total = quantity * currentPrice;
            suggestionLogger.WriteLine("Calculated buy order total: " + total + " EUR (+fee)");

            if (total < minBuyOrderPrice)
            {
                throw new CancelOrderException(Status.TemporaryError, "Buy order total is too low");
            }

            return quantity;
        }

        private static string GetInstrumentId(TradeSuggestion suggestion)
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

            return instrumentId;
        }

        private static void SaveLog(TradeLog log, TradeSuggestion suggestion, TradeDBContext db)
        {
            if (suggestion.Logs == null)
            {
                suggestion.Logs = new List<TradeLog>();
            }

            if (!suggestion.Logs.Contains(log))
            {
                suggestion.Logs.Add(log);
                db.TradeLogs.Add(log);
            }

            db.SaveChanges();
        }
    }
}
