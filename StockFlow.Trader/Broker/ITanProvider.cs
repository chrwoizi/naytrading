namespace StockFlow.Trader
{
    public interface ITanProvider
    {
        string GetTan(object tanChallenge);
    }
}