using OpenQA.Selenium.Chrome;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace StockFlow.Trader
{
    public class OrderController
    {
        public static void Order(string isin, TradingAction action, decimal price, int quantity, string user, string password, bool headless)
        {
            if (string.IsNullOrWhiteSpace(user))
            {
                Console.WriteLine("No user given.");
                return;
            }

            if (string.IsNullOrWhiteSpace(password))
            {
                Console.WriteLine("No password given.");
                return;
            }

            try
            {
                var service = ChromeDriverService.CreateDefaultService();
                service.SuppressInitialDiagnosticInformation = true;
                service.HideCommandPromptWindow = true;
                ChromeOptions option = new ChromeOptions();
                if (headless)
                {
                    option.AddArgument("--headless");
                }

                var chrome = new ChromeDriver(service, option);

                Console.WriteLine("Signing in...");
                Flatex.Login(user, password, chrome);
                Console.WriteLine("Signed in");

                try
                {
                    decimal available = Flatex.GetAvailableFunds(chrome);
                    Console.WriteLine("Available funds: " + available + " EUR");

                    SleepRandom();
                    var instrumentPrice = Flatex.GetPrice(isin, action, chrome);
                    Console.WriteLine("Price: " + instrumentPrice + " EUR");

                    if (action == TradingAction.Buy && instrumentPrice > price)
                    {
                        Console.WriteLine("Too expensive to buy. Expected price below " + price + " EUR");
                        return;
                    }

                    if (action == TradingAction.Sell && instrumentPrice < price)
                    {
                        Console.WriteLine("Too cheap to sell. Expected price above " + price + " EUR");
                        return;
                    }

                    SleepRandom();
                    var tanChallenge = Flatex.GetTanChallenge(quantity, action, chrome);
                    Console.WriteLine(string.Format("TAN challenge: {0} {1} {2}", tanChallenge.TanChallenge1, tanChallenge.TanChallenge2, tanChallenge.TanChallenge3));

                    Console.Write("TAN: ");
                    var tan = ConsoleHelper.ReadPassword('*');

                    SleepRandom();
                    var offer = Flatex.GetQuote(tan, chrome);

                    Console.WriteLine("Offer: " + offer + " EUR");

                    if (action == TradingAction.Buy && instrumentPrice > price)
                    {
                        Console.WriteLine("Too expensive to buy. Expected price below " + price + " EUR");
                        return;
                    }

                    if (action == TradingAction.Sell && instrumentPrice < price)
                    {
                        Console.WriteLine("Too cheap to sell. Expected price above " + price + " EUR");
                        return;
                    }
                    
                    // TODO Flatex.PlaceOrder(chrome);
                }
                catch (Exception ex)
                {
                    Console.WriteLine("ERROR: " + ex.ToString());
                }
                finally
                {
                    try
                    {
                        Console.WriteLine("Press Enter to log out");
                        Console.ReadLine();

                        SleepRandom();
                        Console.WriteLine("Signing out...");
                        Flatex.Logout(chrome);
                        Console.WriteLine("Signed out");
                    }
                    finally
                    {
                        chrome.Close();
                        chrome.Dispose();
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("ERROR: " + ex.ToString());
            }
        }

        private static void SleepRandom()
        {
            Console.WriteLine("Sleeping...");
            Thread.Sleep(new Random().Next(2000, 3000));
        }
    }
}
