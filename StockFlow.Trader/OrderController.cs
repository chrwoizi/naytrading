using OpenQA.Selenium.Chrome;
using System;
using System.Collections.Generic;
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

        public readonly decimal AvailableFunds;

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
            if (headless)
            {
                option.AddArgument("--headless");
            }

            chrome = new ChromeDriver(service, option);

            try
            {
                logger.WriteLine("Signing in...");
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

            try
            {
                logger.WriteLine("Getting available funds...");
                this.AvailableFunds = broker.GetAvailableFunds(chrome);
                logger.WriteLine("Available funds: " + AvailableFunds + " EUR");
            }
            catch (Exception ex)
            {
                try
                {
                    logger.WriteLine(ex.ToString());
                }
                finally
                {
                    Logout();
                }
                throw;
            }
        }

        public void Dispose()
        {
            Logout();
        }

        public void Order(string isin, TradingAction action, decimal price, int quantity)
        {
            try
            {
                SleepRandom();
                logger.WriteLine("Getting price...");
                var instrumentPrice = broker.GetPrice(isin, action, chrome);
                logger.WriteLine("Price: " + instrumentPrice + " EUR");

                if (action == TradingAction.Buy && instrumentPrice > price)
                {
                    throw new CancelOrderException(Status.TemporaryError, "Too expensive to buy. Expected price to be " + price + " EUR or less");
                }

                if (action == TradingAction.Sell && instrumentPrice < price)
                {
                    throw new CancelOrderException(Status.TemporaryError, "Too cheap to sell. Expected price to be " + price + " EUR or more");
                }

                SleepRandom();
                logger.WriteLine("Getting TAN challenge...");
                var tanChallenge = broker.GetTanChallenge(quantity, action, chrome);
                logger.WriteLine("TAN challenge: " + tanChallenge);
                
                var tan = tanProvider.GetTan(tanChallenge);

                SleepRandom();
                logger.WriteLine("Getting offer...");
                var offer = broker.GetQuote(tan, chrome);
                logger.WriteLine("Offer: " + offer + " EUR");

                if (action == TradingAction.Buy && offer > price)
                {
                    throw new CancelOrderException(Status.TemporaryError, "Too expensive to buy. Expected price to be " + price + " EUR or less");
                }

                if (action == TradingAction.Sell && offer < price)
                {
                    throw new CancelOrderException(Status.TemporaryError, "Too cheap to sell. Expected price to be " + price + " EUR or more");
                }

                // TODO logger.WriteLine("Placing order...");
                // TODO Flatex.PlaceOrder(chrome);
            }
            catch (CancelOrderException ex)
            {
                throw;
            }
            catch (Exception ex)
            {
                throw new CancelOrderException(Status.FatalError, string.Empty, ex);
            }
        }

        private void Logout()
        {
            if (chrome != null)
            {
                try
                {
                    SleepRandom();
                    logger.WriteLine("Signing out...");
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
