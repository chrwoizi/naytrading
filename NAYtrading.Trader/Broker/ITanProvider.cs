namespace NAYtrading.Trader
{
    public interface ITanProvider
    {
        string GetTan(object tanChallenge);
    }
}