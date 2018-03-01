using System;

namespace StockFlow.Trader
{
    public class ConsoleTanProvider : ITanProvider
    {
        public string GetTan(object tanChallenge)
        {
            Console.WriteLine("TAN challenge: " + tanChallenge);
            Console.Write("Please enter the TAN: ");
            return ConsoleHelper.ReadPassword('*');
        }
    }
}