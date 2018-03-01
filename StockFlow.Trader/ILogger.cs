namespace StockFlow.Trader
{
    public interface ILogger
    {
        void WriteLine(string v);

        void Write(string v);
    }
}