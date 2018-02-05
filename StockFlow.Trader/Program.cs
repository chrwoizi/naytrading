using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Remote;
using System;
using System.Configuration;
using System.IO;
using System.Net;
using System.Threading;
using System.Threading.Tasks;

namespace StockFlow.Trader
{
    class Program
    {
        static void Main(string[] args)
        {
            if (args.Length == 1 && args[0] == "settan")
            {
                Console.Write("TANs: ");
                var tans = ConsoleHelper.ReadPassword('*');
                Console.Write("Password: ");
                var password = ConsoleHelper.ReadPassword('*');
                var cipher = StringCipher.Encrypt(tans, password);
                File.WriteAllText(ConfigurationManager.AppSettings["TanFilePath"], cipher);
            }
            else if (args.Length == 1 && args[0] == "gettan")
            {
                Console.Write("Challenge: ");
                var challenge = Console.ReadLine().Split(' ');
                Console.Write("Password: ");
                var password = ConsoleHelper.ReadPassword('*');
                var tan = new TanProvider().GetTan(challenge[0], challenge[1], challenge[2], password);
                Console.WriteLine("TAN: " + tan);
            }
            else if (args.Length == 1 && args[0] == "buy")
            {
                Order("US0378331005", TradingAction.Buy);
            }

            Console.WriteLine("Exit.");
            Console.ReadLine();
        }

        private static void Order(string isin, TradingAction action)
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
