using System;

namespace StockFlow.Trader.Models
{
    public class TradeLog
    {
        public int ID { get; set; }

        public TradeSuggestion TradeSuggestion { get; set; }

        public DateTime Time { get; set; }

        public int Quantity { get; set; }

        public decimal Price { get; set; }

        public string Status { get; set; }

        public string Message { get; set; }
    }
}