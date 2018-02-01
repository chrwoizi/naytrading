using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Remote;
using System;
using System.Configuration;
using System.Net;
using System.Threading;
using System.Threading.Tasks;

namespace StockFlow.Trader
{
    class Program
    {
        static void Main(string[] args)
        {
            var task = Do("US0378331005", TradingAction.Buy);
            task.Wait();

            Console.WriteLine("Exit.");
            Console.ReadLine();
        }

        private static async Task Do(string isin, TradingAction action)
        {
            Console.Write("Account: ");
            var user = Console.ReadLine();

            Console.Write("Password: ");
            var password = ConsoleHelper.ReadPassword('*');

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
                //option.AddArgument("--headless");

                var chrome = new ChromeDriver(service, option);

                Console.WriteLine("Signing in...");
                Flatex.Login(user, password, chrome);
                Console.WriteLine("Signed in");
                
                try
                {
                    decimal available = Flatex.GetAvailableFunds(chrome);
                    Console.WriteLine("Available funds: " + available + " EUR");

                    int quantity = 3;

                    SleepRandom();
                    var instrumentPrice = Flatex.GetPrice(isin, action, chrome);
                    Console.WriteLine("Price: " + instrumentPrice + " EUR");
                    
                    SleepRandom();
                    var tanChallenge = Flatex.GetTanChallenge(quantity, action, chrome);
                    Console.WriteLine(string.Format("TAN challenge: {0} {1} {2}", tanChallenge.TanChallenge1, tanChallenge.TanChallenge2, tanChallenge.TanChallenge3));

                    Console.Write("TAN: ");
                    var tan = ConsoleHelper.ReadPassword('*');

                    SleepRandom();
                    var offer = Flatex.GetQuote(tan, chrome);
                    
                    Console.WriteLine("Offer: " + offer + " EUR");
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
            Thread.Sleep(new Random().Next(2000,3000));
        }
    }
}
