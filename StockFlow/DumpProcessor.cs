using SharpNoise;
using SharpNoise.Builders;
using SharpNoise.Modules;
using StockFlow.Common;
using StockFlow.Web.Models;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace StockFlow
{
    public class DumpProcessor
    {
        private static Random random = new Random();

        public const int Days = 5 * 365 - 10;

        public const string FlatDumpFile = "dump.csv";
        public const string FlatBuyFile = "buy.csv";
        public const string FlatBuyAugFile = "buy_aug.csv";
        public const string FlatNoBuyFile = "nobuy.csv";
        public const string FlatNoBuyAugFile = "nobuy_aug.csv";
        public const string FlatSellFile = "sell.csv";
        public const string FlatSellAugFile = "sell_aug.csv";
        public const string FlatNoSellFile = "nosell.csv";
        public const string FlatNoSellAugFile = "nosell_aug.csv";

        public static void Flatten(Stream stream, Action<double> reportProgress)
        {
            using (var writer = new StreamWriter(File.Open(FlatDumpFile, FileMode.Create)))
            {
                reportProgress(0);

                writer.Write("instrument;time;decision;");
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
                    if (l > 0)
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
                            var previousRate = remainingRates.LastOrDefault(x => x.Time.Date < firstDate) ?? remainingRates.First();
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
                            if (invested)
                                Debugger.Break();
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
                    using (var nobuyWriter = new StreamWriter(File.Open(FlatNoBuyFile, FileMode.Create)))
                    {
                        using (var sellWriter = new StreamWriter(File.Open(FlatSellFile, FileMode.Create)))
                        {
                            using (var nosellWriter = new StreamWriter(File.Open(FlatNoSellFile, FileMode.Create)))
                            {
                                var header = reader.ReadLine();
                                buyWriter.WriteLine("id;" + header);
                                nobuyWriter.WriteLine("id;" + header);
                                sellWriter.WriteLine("id;" + header);
                                nosellWriter.WriteLine("id;" + header);

                                var linesRead = 1;
                                foreach (var meta in distinctMetas.OrderBy(x => x.Line))
                                {
                                    while (meta.Line > linesRead)
                                    {
                                        reader.ReadLine();
                                        ++linesRead;
                                    }

                                    var line = reader.ReadLine();
                                    ++linesRead;

                                    if (!string.IsNullOrEmpty(line))
                                    {
                                        if (!meta.Invested)
                                        {
                                            if (meta.Decision == "buy")
                                            {
                                                buyWriter.WriteLine(linesRead + ";" + line);
                                            }
                                            else
                                            {
                                                nobuyWriter.WriteLine(linesRead + ";" + line);
                                            }
                                        }
                                        else
                                        {
                                            if (meta.Decision == "sell")
                                            {
                                                sellWriter.WriteLine(linesRead + ";" + line);
                                            }
                                            else
                                            {
                                                nosellWriter.WriteLine(linesRead + ";" + line);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        public static void Augment(string inPath, string outPath, int factor, Action<double> reportProgress)
        {
            var lineCount = CountLines(inPath, line => true);

            reportProgress(0);

            using (var reader = new StreamReader(File.Open(inPath, FileMode.Open)))
            {
                using (var writer = new StreamWriter(File.Open(outPath, FileMode.Create)))
                {
                    var header = reader.ReadLine();
                    writer.WriteLine(header);

                    int lineIndex = 1;
                    while (!reader.EndOfStream)
                    {
                        var line = reader.ReadLine();
                        lineIndex++;

                        if (!string.IsNullOrEmpty(line))
                        {
                            var split = line.Split(new[] { ';' }, StringSplitOptions.RemoveEmptyEntries);

                            var originalId = split[0];
                            var instrumentId = split[1];
                            var time = split[2];
                            var decision = split[3];
                            var rates = split.Skip(4).Select(x => decimal.Parse(x, CultureInfo.InvariantCulture)).ToArray();

                            var originalRates = rates.ToArray();
                            NormalizeRates(originalRates);
                            writer.WriteLine(Serialize(originalId + "-0", instrumentId, time, decision, originalRates));

                            for (int i = 1; i < factor; i++)
                            {
                                var augmentedRates = AugmentRates(rates, 0.2, 20, 0.05);
                                NormalizeRates(augmentedRates);
                                writer.WriteLine(Serialize(originalId + "-" + i, instrumentId, time, decision, augmentedRates));
                            }
                        }

                        reportProgress(lineIndex / (double)lineCount);
                    }
                }
            }

            reportProgress(1);
        }

        private static string Serialize(string id, string instrumentId, string time, string decision, decimal[] rates)
        {
            return string.Join(";", new[] { id, instrumentId, time, decision }.Concat(rates.Select(x => x.ToString("F2", CultureInfo.InvariantCulture))));
        }

        private static decimal[] AugmentRates(decimal[] rates, double maxSkew, double maxJitterX, double maxJitterY)
        {
            var perlin1 = new Perlin { Seed = random.Next() };
            var perlin2 = new Perlin { Seed = random.Next(), Frequency = Perlin.DefaultFrequency * 5 * random.NextDouble() };

            var avg = rates.Average();

            var maxSkewAbs = (decimal)maxSkew * rates.Last() / rates.Length;
            var skew = maxSkewAbs * (decimal)RandomSphere();

            var newRates = rates.ToArray();

            for (int i = 0; i < rates.Length; i++)
            {
                var jitterX = maxJitterX * perlin1.GetValue(i / (double)rates.Length, 0, 0);

                var jitterY = avg * (decimal)(maxJitterY * perlin2.GetValue(i / (double)rates.Length, 0, 0));

                var x = i + jitterX;

                newRates[i] = SampleRate(rates, x) + skew * (decimal)x + jitterY;
            }

            return newRates;
        }

        private static decimal SampleRate(decimal[] rates, double x)
        {
            var low = (int)Math.Floor(x);
            var high = (int)Math.Ceiling(x);
            var frac = (decimal)(x - low);
            var rateLow = rates[Math.Min(Math.Max(0, low), rates.Length - 1)];
            var rateHigh = rates[Math.Min(Math.Max(0, high), rates.Length - 1)];
            return rateLow + frac * (rateHigh - rateLow);
        }

        private static double RandomSphere()
        {
            return (double)(random.NextDouble() * Math.Sin(random.NextDouble() * 2 * Math.PI));
        }

        private static void NormalizeRates(decimal[] rates)
        {
            var min = rates.Min();
            var max = rates.Max();
            var height = max - min;

            for (int i = 0; i < rates.Length; i++)
            {
                rates[i] = (rates[i] - min) / height;
            }
        }

        public static int CountLines(string path, Func<string, bool> expression)
        {
            var lines = 0;
            if (File.Exists(path))
            {
                using (var stream = File.OpenRead(path))
                {
                    using (var reader = new StreamReader(stream))
                    {
                        while (true)
                        {
                            if (reader.EndOfStream)
                                break;
                            var line = reader.ReadLine();
                            if (line == null)
                                break;
                            if (expression(line))
                                lines++;
                        }
                    }
                }
            }

            return lines;
        }

        public static bool ContainsDecision(string line, string decision)
        {
            var begin = line.IndexOf(';');
            if (begin == -1 || begin == line.Length - 1)
                return false;

            begin = line.IndexOf(';', begin + 1);
            if (begin == -1 || begin == line.Length - 1)
                return false;

            begin = line.IndexOf(';', begin + 1);
            if (begin == -1 || begin == line.Length - 1)
                return false;

            int end = line.IndexOf(';', begin + 1);
            if (end == -1)
                return false;

            var d = line.Substring(begin + 1, end - begin - 1);
            return d == decision;
        }
    }
}
