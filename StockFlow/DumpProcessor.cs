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
using System.Threading.Tasks;

namespace StockFlow
{
    public class DumpProcessor
    {
        private static Random random = new Random();

        public const int Days = 5 * 365 - 10;

        public const string FlatDumpFile = "dump.csv";

        public const string FlatBuyFile = "buy.csv";
        public const string FlatNoBuyFile = "nobuy.csv";
        public const string FlatSellFile = "sell.csv";
        public const string FlatNoSellFile = "nosell.csv";

        public const string TrainBuyFile = "train_buy.csv";
        public const string TrainNoBuyFile = "train_nobuy.csv";
        public const string TrainSellFile = "train_sell.csv";
        public const string TrainNoSellFile = "train_nosell.csv";

        public const string TestBuyFile = "test_buy.csv";
        public const string TestNoBuyFile = "test_nobuy.csv";
        public const string TestSellFile = "test_sell.csv";
        public const string TestNoSellFile = "test_nosell.csv";

        public const string TrainBuyAugFile = "train_buy_aug.csv";
        public const string TrainNoBuyAugFile = "train_nobuy_aug.csv";
        public const string TrainSellAugFile = "train_sell_aug.csv";
        public const string TrainNoSellAugFile = "train_nosell_aug.csv";

        public const string TestBuyingFile = "test_buying.csv";
        public const string TestSellingFile = "test_selling.csv";
        public const string TrainBuyingFile = "train_buying.csv";
        public const string TrainSellingFile = "train_selling.csv";

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

        public static void SplitRandomTrainTest(string inPath, string testPath, string trainPath, double factor, Action<double> reportProgress)
        {
            reportProgress(0);

            using (var reader = new UnbufferedStreamReader(File.Open(inPath, FileMode.Open)))
            {
                var linePositions = new Dictionary<int, long>();
                GetLinePositions(linePositions, reader);

                var randomLinePositions = linePositions.Select(x => new { r = random.NextDouble(), v = x }).OrderBy(x => x.r).Select(x => x.v).ToList();

                Debug.Assert(reader.BaseStream.CanSeek);

                reader.BaseStream.Seek(0, SeekOrigin.Begin);
                var header = reader.ReadLine();

                var testCount = (int)(randomLinePositions.Count * factor);

                int i = 0;

                reader.BaseStream.Seek(0, SeekOrigin.Begin);
                using (var writer = new StreamWriter(File.Open(testPath, FileMode.Create)))
                {
                    writer.WriteLine(header);
                    
                    foreach (var item in randomLinePositions.Take(testCount))
                    {
                        reader.BaseStream.Seek(item.Value, SeekOrigin.Begin);
                        var line = reader.ReadLine();
                        Debug.Assert(line.Split(';').Length == 4 + 1815);
                        writer.WriteLine(line);

                        reportProgress(i / (double)randomLinePositions.Count);
                        i++;
                    }
                }

                reader.BaseStream.Seek(0, SeekOrigin.Begin);
                using (var writer = new StreamWriter(File.Open(trainPath, FileMode.Create)))
                {
                    writer.WriteLine(header);

                    foreach (var item in randomLinePositions.Skip(testCount))
                    {
                        reader.BaseStream.Seek(item.Value, SeekOrigin.Begin);
                        var line = reader.ReadLine();
                        Debug.Assert(line.Split(';').Length == 4 + 1815);
                        writer.WriteLine(line);

                        reportProgress(i / (double)randomLinePositions.Count);
                        i++;
                    }
                }
            }

            reportProgress(1);
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

                        if (!string.IsNullOrEmpty(line))
                        {
                            var split = line.Split(new[] { ';' }, StringSplitOptions.RemoveEmptyEntries);

                            var originalId = split[0];
                            var instrumentId = split[1];
                            var time = split[2];
                            var decision = split[3];
                            var rates = split.Skip(4).Select(x => decimal.Parse(x, CultureInfo.InvariantCulture)).ToArray();
                            
                            writer.WriteLine(Serialize(originalId + "-0", instrumentId, time, decision, rates));
                            lineIndex++;
                            reportProgress(lineIndex / (double)(lineCount * factor));

                            for (int i = 1; i < factor; i++)
                            {
                                var augmentedRates = AugmentRates(rates, 0.2, 20, 0.05);
                                writer.WriteLine(Serialize(originalId + "-" + i, instrumentId, time, decision, augmentedRates));
                                lineIndex++;
                                reportProgress(lineIndex / (double)(lineCount * factor));
                            }
                        }
                    }
                }
            }

            reportProgress(1);
        }

        public static void MergeRandom(string inPath1, string inPath2, string outPath, Action<double> reportProgress)
        {
            var linePositions1 = new Dictionary<int, long>();
            var linePositions2 = new Dictionary<int, long>();

            reportProgress(0);

            using (var reader1 = new UnbufferedStreamReader(File.Open(inPath1, FileMode.Open)))
            {
                using (var reader2 = new UnbufferedStreamReader(File.Open(inPath2, FileMode.Open)))
                {
                    GetLinePositions(linePositions1, reader1);
                    GetLinePositions(linePositions2, reader2);

                    var randomLinePositions =
                        linePositions1.Select(x => new Tuple<UnbufferedStreamReader, KeyValuePair<int, long>>(reader1, x))
                        .Concat(linePositions2.Select(x => new Tuple<UnbufferedStreamReader, KeyValuePair<int, long>>(reader2, x)))
                        .Select(x => new { r = random.NextDouble(), v = x })
                        .OrderBy(x => x.r)
                        .Select(x => x.v)
                        .ToList();

                    using (var writer = new StreamWriter(File.Open(outPath, FileMode.Create)))
                    {
                        var header = reader1.ReadLine();
                        var splitHeader = header.Split(new[] { ';' }, StringSplitOptions.RemoveEmptyEntries);
                        var normalizedHeader = string.Join(";", splitHeader.Take(4).Concat(new string[1024].Select((x, k) => k.ToString())).ToArray());
                        writer.WriteLine(normalizedHeader);

                        int i = 0;
                        foreach (var item in randomLinePositions)
                        {
                            var reader = item.Item1;
                            reader.BaseStream.Seek(item.Item2.Value, SeekOrigin.Begin);

                            var line = reader.ReadLine();
                            var split = line.Split(new[] { ';' }, StringSplitOptions.RemoveEmptyEntries);

                            var id = split[0];
                            var instrumentId = split[1];
                            var time = split[2];
                            var decision = split[3];
                            var rates = split.Skip(4).Select(x => decimal.Parse(x, CultureInfo.InvariantCulture)).ToArray();

                            NormalizeRates(rates);
                            rates = new decimal[1024].Select((x, k) => SampleRate(rates, k / 1024d * (double)rates.Length)).ToArray();
                            writer.WriteLine(Serialize(id, instrumentId, time, decision, rates));

                            reportProgress(i / (double)randomLinePositions.Count);
                            i++;
                        }
                    }
                }
            }

            reportProgress(1);
        }

        private static void GetLinePositions(Dictionary<int, long> linePositions1, UnbufferedStreamReader reader)
        {
            var lineIndex = 0;
            while (reader.BaseStream.Position < reader.BaseStream.Length)
            {
                if (lineIndex > 0)
                {
                    linePositions1.Add(lineIndex, reader.BaseStream.Position);
                }

                reader.ReadLine();
                lineIndex++;
            }

            reader.BaseStream.Seek(0, SeekOrigin.Begin);
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


