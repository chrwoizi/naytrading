﻿using System.Data.Entity;

namespace StockFlow.Trader.Models
{
    public class TradeDBContext : DbContext
    {
        public DbSet<TradeSuggestion> TradeSuggestions { get; set; }

        public DbSet<TradeLog> TradeLogs { get; set; }

        public TradeDBContext()
        {
            this.Database.CommandTimeout = 600;
        }
    }
}