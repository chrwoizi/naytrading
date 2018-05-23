using OpenQA.Selenium.Chrome;
using System;
using System.Collections.Generic;
using System.Configuration;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace StockFlow.Trader
{
    public class OrderController : IDisposable
    {
        private readonly IBroker broker;
        private readonly ILogger logger;
        private readonly ITanProvider tanProvider;

        private ChromeDriver chrome;

        public OrderController(string user, string password, bool headless, IBroker broker, ILogger logger, ITanProvider tanProvider)
        {
            if (string.IsNullOrWhiteSpace(user))
            {
                throw new Exception("No user given.");
            }

            if (string.IsNullOrWhiteSpace(password))
            {
                throw new Exception("No password given.");
            }

            this.broker = broker;
            this.logger = logger;
            this.tanProvider = tanProvider;

            var service = ChromeDriverService.CreateDefaultService();
            service.SuppressInitialDiagnosticInformation = true;
            service.HideCommandPromptWindow = true;
            
            ChromeOptions option = new ChromeOptions();
            option.AddArgument("--window-size=1920,1080");

            var directory = ConfigurationManager.AppSettings["ChromeProfile"];
            if (!string.IsNullOrEmpty(directory))
            {
                Directory.CreateDirectory(directory);
                option.AddArguments("--user-data-dir=" + Path.GetFullPath(directory));
            }

            if (headless)
            {
                option.AddArgument("--headless");
            }

            chrome = new ChromeDriver(service, option);

            try
            {
                logger.WriteLine("Signing in at broker...");
                broker.Login(user, password, chrome);
                logger.WriteLine("Signed in");
            }
            catch (Exception ex)
            {
                try
                {
                    logger.WriteLine(ex.ToString());
                }
                finally
                {
                    chrome.Close();
                    chrome.Dispose();
                    chrome = null;
                }
                throw;
            }
        }

        public void Dispose()
        {
            Logout();
        }

        public decimal GetAvailableFunds()
        {
            SleepRandom();
            logger.WriteLine("Getting available funds...");
            var availableFunds = broker.GetAvailableFunds(chrome);
            logger.WriteLine("Available funds: " + availableFunds + " EUR");

            return availableFunds;
        }

        public int GetOwnedQuantity(string isin, string wkn)
        {
            try
            {
                SleepRandom();
                logger.WriteLine("Getting owned quantity...");
                var quantity = broker.GetOwnedQuantity(isin, wkn, chrome);
                logger.WriteLine("Owned quantity: " + quantity);

                return quantity;
            }
            catch (Exception ex)
            {
                throw new CancelOrderException(Status.FatalError, ex.Message, ex);
            }
        }

        public decimal GetCurrentPrice(string isin, TradingAction action)
        {
            SleepRandom();
            logger.WriteLine("Getting current price...");
            var instrumentPrice = broker.GetPrice(isin, action, chrome);
            logger.WriteLine("Current price: " + instrumentPrice + " EUR");

            return instrumentPrice;
        }

        public void PrepareOrder(TradingAction action, decimal priceLimit, int quantity)
        {
            try
            {
                SleepRandom();
                logger.WriteLine("Getting TAN challenge...");
                var tanChallenge = broker.GetTanChallenge(quantity, action, chrome);
                logger.WriteLine("TAN challenge: " + tanChallenge);

                var tan = tanProvider.GetTan(tanChallenge);

                SleepRandom();
                logger.WriteLine("Getting offer...");
                var offer = broker.GetQuote(tan, chrome);
                logger.WriteLine("Offer: " + offer + " EUR");

                if (action == TradingAction.Buy && offer > priceLimit)
                {
                    throw new CancelOrderException(Status.TemporaryError, "Too expensive to buy. Expected price to be " + priceLimit + " EUR or less");
                }

                if (action == TradingAction.Sell && offer < priceLimit)
                {
                    throw new CancelOrderException(Status.TemporaryError, "Too cheap to sell. Expected price to be " + priceLimit + " EUR or more");
                }
            }
            catch (CancelOrderException)
            {
                throw;
            }
            catch (Exception ex)
            {
                throw new CancelOrderException(Status.FatalError, ex.Message, ex);
            }
        }

        public void PlaceOrder()
        {
            try
            {
                logger.WriteLine("Placing order...");
                broker.PlaceOrder(chrome);
                logger.WriteLine("Order complete...");
            }
            catch (Exception ex)
            {
                throw new CancelOrderException(Status.FatalError, ex.Message, ex);
            }
        }

        private void Logout()
        {
            if (chrome != null)
            {
                try
                {
                    SleepRandom();
                    logger.WriteLine("Signing out from broker...");
                    broker.Logout(chrome);
                    logger.WriteLine("Signed out");
                }
                finally
                {
                    chrome.Close();
                    chrome.Dispose();
                    chrome = null;
                }
            }
        }

        private void SleepRandom()
        {
            logger.WriteLine("Sleeping...");
            Thread.Sleep(new Random().Next(2000, 3000));
        }
    }
}
