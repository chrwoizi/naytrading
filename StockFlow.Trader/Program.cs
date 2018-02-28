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
                var tan = new TanProvider().GetTan(challenge[0], challenge[1], challenge[2], password);
                Console.WriteLine("TAN: " + tan);
            }
            else if (args.Length == 1 && args[0] == "buy")
            {
                Console.Write("Broker account: ");
                var user = Console.ReadLine();

                Console.Write("Broker password: ");
                var password = ConsoleHelper.ReadPassword('*');

                OrderController.Order("US0378331005", TradingAction.Buy, 1.23m, 1, user, password, false);
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
