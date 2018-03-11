using StockFlow.Common;
using StockFlow.Web.Models;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace StockFlow
{
    public class DumpProcessor
    {
        public const int Days = 5 * 365 - 10;

        public const string FlatDumpFile = "dump.csv";
        public const string FlatBuyFile = "buy.csv";
        public const string FlatSellFile = "sell.csv";
        public const string FlatDontBuyFile = "no_buy.csv";
        public const string FlatDontSellFile = "no_sell.csv";

        public static void Flatten(Stream stream, Action<double> reportProgress)
        {
            using (var writer = new StreamWriter(File.Open(FlatDumpFile, FileMode.Create)))
            {
                reportProgress(0);

                writer.Write("instrumentId;time;decision;");
                for (var day = -Days + 1; day <= 0; ++day)
                {
                    writer.Write(day.ToString());
                    if (day < 0)
                    {
                        writer.Write(";");
                    }
                }
                writer.Flush();

                var hasLength = false;
                try
                {
                    var l = stream.Length;
                    if(l > 0)
                    {
                        hasLength = true;
                    }
                }
                catch { }

                Importer.Import<Snapshot>(stream, (snapshot) =>
                {
                    if (hasLength)
                    {
                        var progress = stream.Position / (double)stream.Length;
                        reportProgress(progress);
                    }

                    if (!string.IsNullOrEmpty(snapshot.Decision) && snapshot.Rates != null)
                    {
                        var rates = snapshot.Rates.Where(x => x.Close.HasValue).ToList();

                        var firstDate = snapshot.Time.Date.AddDays(-Days + 1);

                        writer.WriteLine();

                        writer.Write(snapshot.Instrument.ID);
                        writer.Write(";");

                        writer.Write(snapshot.Time.ToString("yyyyMMdd", CultureInfo.InvariantCulture));
                        writer.Write(";");

                        writer.Write(snapshot.Decision);
                        writer.Write(";");

                        if (rates.Any() && rates.First().Time.Date <= firstDate)
                        {
                            var remainingRates = snapshot.Rates;
                            var previousRate = remainingRates.First();
                            for (DateTime date = firstDate; date <= snapshot.Time.Date; date = date.AddDays(1))
                            {
                                remainingRates = remainingRates.SkipWhile(x => x.Time.Date < date).ToList();

                                var rate = previousRate;
                                if (remainingRates.Any())
                                {
                                    var firstRate = remainingRates.First();
                                    if (firstRate.Time.Date == date)
                                    {
                                        rate = firstRate;
                                    }
                                    else
                                    {
                                        // encountered future rate. use previous rate.
                                    }
                                }
                                else
                                {
                                    // no remaining rates. use previous rate.
                                }

                                var value = rate.Close.Value.ToString("F2", CultureInfo.InvariantCulture);
                                writer.Write(value);

                                if (date < snapshot.Time.Date)
                                {
                                    writer.Write(";");
                                }

                                previousRate = rate;
                            }
                        }
                        else
                        {
                            for (DateTime date = firstDate; date <= snapshot.Time.Date; date = date.AddDays(1))
                            {
                                var value = 0m.ToString("F2", CultureInfo.InvariantCulture);
                                writer.Write(value);

                                if (date < snapshot.Time.Date)
                                {
                                    writer.Write(";");
                                }
                            }
                        }

                        writer.Flush();
                    }
                });

                reportProgress(1);
            }
        }

        public static List<SnapshotMetadata> GetDumpMetadata()
        {
            var metas = new List<SnapshotMetadata>();

            using (var reader = new StreamReader(File.Open(FlatDumpFile, FileMode.Open)))
            {
                var lineIndex = 0;
                while (!reader.EndOfStream)
                {
                    var line = reader.ReadLine();

                    if (lineIndex > 0)
                    {
                        var split = line.Split(';');

                        var instrumentId = split[0];
                        var time = DateTime.ParseExact(split[1], "yyyyMMdd", CultureInfo.InvariantCulture);
                        var decision = split[2];
                        var firstRate = decimal.Parse(split[3]);

                        var meta = new SnapshotMetadata()
                        {
                            Line = lineIndex,
                            InstrumentId = instrumentId,
                            Decision = decision,
                            Time = time,
                            Valid = firstRate > 0
                        };

                        metas.Add(meta);
                    }

                    ++lineIndex;
                }
            }

            foreach (var group in metas.GroupBy(x => x.InstrumentId))
            {
                var invested = false;

                foreach (var meta in group.OrderBy(x => x.Time))
                {
                    meta.Invested = invested;
                    switch (meta.Decision)
                    {
                        case "buy":
                            invested = true;
                            break;
                        case "sell":
                            invested = false;
                            break;
                    }
                }
            }

            return metas;
        }

        public static void SplitByDecision()
        {
            List<SnapshotMetadata> metas = GetDumpMetadata();

            var validMetas = metas.Where(x => x.Valid);

            var distinctMetas = validMetas.Distinct(new SnapshotMetadata.Comparer());

            using (var reader = new StreamReader(File.Open(FlatDumpFile, FileMode.Open)))
            {
                using (var buyWriter = new StreamWriter(File.Open(FlatBuyFile, FileMode.Create)))
                {
                    using (var sellWriter = new StreamWriter(File.Open(FlatSellFile, FileMode.Create)))
                    {
                        using (var dontBuyWriter = new StreamWriter(File.Open(FlatDontBuyFile, FileMode.Create)))
                        {
                            using (var dontSellWriter = new StreamWriter(File.Open(FlatDontSellFile, FileMode.Create)))
                            {
                                var header = reader.ReadLine();
                                buyWriter.WriteLine(header);
                                sellWriter.WriteLine(header);
                                dontBuyWriter.WriteLine(header);
                                dontSellWriter.WriteLine(header);

                                var linesRead = 0;
                                foreach (var meta in distinctMetas.OrderBy(x => x.Line))
                                {
                                    while (meta.Line > linesRead)
                                    {
                                        reader.ReadLine();
                                        ++linesRead;
                                    }

                                    var line = reader.ReadLine();
                                    ++linesRead;

                                    if (!meta.Invested && meta.Decision == "ignore")
                                    {
                                        dontBuyWriter.WriteLine(line);
                                    }
                                    else if (!meta.Invested && meta.Decision == "buy")
                                    {
                                        buyWriter.WriteLine(line);
                                    }
                                    else if (meta.Invested && meta.Decision == "ignore")
                                    {
                                        dontSellWriter.WriteLine(line);
                                    }
                                    else if (meta.Invested && meta.Decision == "sell")
                                    {
                                        sellWriter.WriteLine(line);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        public static int CountLines(string path)
        {
            var lines = 0;
            if (File.Exists(path))
            {
                using (var stream = File.OpenRead(path))
                {
                    using (var reader = new StreamReader(stream))
                    {
                        while (!reader.EndOfStream && !string.IsNullOrEmpty(reader.ReadLine()))
                        {
                            lines++;
                        }
                    }
                }
            }

            return lines;
        }
    }
}
