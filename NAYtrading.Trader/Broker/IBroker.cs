using OpenQA.Selenium.Chrome;

namespace NAYtrading.Trader
{
    public interface IBroker
    {
        void Login(string user, string password, ChromeDriver chrome);

        decimal GetAvailableFunds(ChromeDriver chrome);

        int GetOwnedQuantity(string isin, string wkn, ChromeDriver chrome);

        decimal GetPrice(string isin, TradingAction action, ChromeDriver chrome);

        object GetTanChallenge(int quantity, TradingAction action, ChromeDriver chrome);

        decimal GetQuote(string tan, ChromeDriver chrome);

        void PlaceOrder(ChromeDriver chrome);

        void Logout(ChromeDriver chrome);
    }
}
