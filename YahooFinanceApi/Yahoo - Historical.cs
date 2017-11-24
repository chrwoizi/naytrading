using CsvHelper;
using Flurl;
using Flurl.Http;
using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using System.Net;
using System.Diagnostics;

namespace YahooFinanceApi
{
    public partial class Yahoo
    {
        public static bool IgnoreEmptyRows { set { RowExtension.IgnoreEmptyRows = value; } }

        public static async Task<IList<Candle>> GetHistoricalAsync(string symbol, DateTime? startTime = null, DateTime? endTime = null, Period period = Period.Daily, CancellationToken token = default(CancellationToken), WebProxy proxy = null)
		    => await GetTicksAsync(symbol, 
	                               startTime, 
	                               endTime, 
	                               period, 
	                               ShowOption.History,
                                   RowExtension.ToCandle,
                                   token,
                                   proxy);

        public static async Task<IList<DividendTick>> GetDividendsAsync(string symbol, DateTime? startTime = null, DateTime? endTime = null, CancellationToken token = default(CancellationToken), WebProxy proxy = null)
            => await GetTicksAsync(symbol, 
                                   startTime, 
                                   endTime, 
                                   Period.Daily, 
                                   ShowOption.Dividend,
                                   RowExtension.ToDividendTick,
                                   token,
                                   proxy);

        public static async Task<IList<SplitTick>> GetSplitsAsync(string symbol, DateTime? startTime = null, DateTime? endTime = null, CancellationToken token = default(CancellationToken), WebProxy proxy = null)
            => await GetTicksAsync(symbol,
                                   startTime,
                                   endTime,
                                   Period.Daily,
                                   ShowOption.Split,
                                   RowExtension.ToSplitTick,
                                   token,
                                   proxy);

        private static async Task<List<ITick>> GetTicksAsync<ITick>(
            string symbol,
            DateTime? startTime,
            DateTime? endTime,
            Period period,
            ShowOption showOption,
            Func<string[], ITick> instanceFunction,
            CancellationToken token, 
            WebProxy proxy
            )
        {
            using (var stream = await GetResponseStreamAsync(symbol, startTime, endTime, period, showOption.Name(), token, proxy).ConfigureAwait(false))
			using (var sr = new StreamReader(stream))
			using (var csvReader = new CsvReader(sr))
			{
                csvReader.Read(); // skip header

                var ticks = new List<ITick>();

                while (csvReader.Read())
                {
                    var tick = instanceFunction(csvReader.Context.Record);
#pragma warning disable RECS0017 // Possible compare of value type with 'null'
                    if (tick != null)
#pragma warning restore RECS0017 // Possible compare of value type with 'null'
                        ticks.Add(tick);
                }

                return ticks;
            }
		}

        private static async Task<Stream> GetResponseStreamAsync(
            string symbol,
            DateTime? startTime,
            DateTime? endTime,
            Period period,
            string events,
            CancellationToken token, 
            WebProxy proxy)
        {
            bool reset = false;
            while (true)
            {
                try
                {
                    var x = await YahooClientFactory.GetClientAndCrumbAsync(reset, token, proxy).ConfigureAwait(false);
                    return await GetResponseStreamAsyncInternal(x.Item1, x.Item2, symbol, ref startTime, ref endTime, period, events, token).ConfigureAwait(false);
                }
                catch (FlurlHttpException ex) when (ex.Call.Response?.StatusCode == HttpStatusCode.NotFound)
                {
                    throw new Exception("Invalid ticker or endpoint.", ex);
                }
                catch (FlurlHttpException ex) when (ex.Call.Response?.StatusCode == HttpStatusCode.Unauthorized)
                {
                    Debug.WriteLine("GetResponseStreamAsync: Unauthorized.");

                    if (reset) throw;
                    reset = true; // try again with a new client
                }
            }
        }

        private static Task<Stream> GetResponseStreamAsyncInternal(IFlurlClient _client, string _crumb, string symbol, ref DateTime? startTime, ref DateTime? endTime, Period period, string events, CancellationToken _token)
        {
            // Yahoo expects dates to be "Eastern Standard Time"
            startTime = startTime?.FromEstToUtc() ?? new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            endTime =   endTime?  .FromEstToUtc() ?? DateTime.UtcNow;

            var url = "https://query1.finance.yahoo.com/v7/finance/download"
                .AppendPathSegment(symbol)
                .SetQueryParam("period1", startTime.Value.ToUnixTimestamp())
                .SetQueryParam("period2", endTime.Value.ToUnixTimestamp())
                .SetQueryParam("interval", $"1{period.Name()}")
                .SetQueryParam("events", events)
                .SetQueryParam("crumb", _crumb);

            Debug.WriteLine(url);

            return url
                .WithClient(_client)
                .GetAsync(_token)
                .ReceiveStream();
        }
    }
}
