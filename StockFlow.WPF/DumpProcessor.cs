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
        public const int MaxMissingDays = 120;
        public const int WeekDays = (5 * Days) / 7;

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

        public static void Flatten(Stream stream, int count, Action<double> reportProgress)
        {
            using (var writer = new StreamWriter(File.Open(FlatDumpFile, FileMode.Create)))
            {
                reportProgress(0);

                writer.Write("instrument;decision;time;");
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

                int current = 0;
                Importer.Import<Snapshot>(stream, (snapshot) =>
                {
                    current++;

                    if (hasLength)
                    {
                        var progress = stream.Position / (double)stream.Length;
                        reportProgress(progress);
                    }
                    else
                    {
                        reportProgress(current / (double)count);
                    }

                    if (!string.IsNullOrEmpty(snapshot.Decision) && snapshot.snapshotrates != null)
                    {
                        var rates = snapshot.snapshotrates.Where(x => x.Close.HasValue).ToList();

                        var firstDate = snapshot.Time.Date.AddDays(-Days + 1);
                        var numDays = (snapshot.Time - firstDate).TotalDays;

                        if (rates.Any())
                        {
                            var previousRate = rates.LastOrDefault(x => x.Time.Date < firstDate) ?? rates.First();

                            var remainingRates = rates.SkipWhile(x => x.Time.Date < firstDate).ToList();

                            if (previousRate.Time.Date <= firstDate && remainingRates.Count >= WeekDays - MaxMissingDays)
                            {
                                writer.WriteLine();

                                writer.Write(snapshot.instrument.ID);
                                writer.Write(";");

                                writer.Write(snapshot.Decision);
                                writer.Write(";");

                                writer.Write(snapshot.Time.ToString("yyyyMMdd", CultureInfo.InvariantCulture));
                                writer.Write(";");

                                var splitFactor = 1m;
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

                                    splitFactor *= GetSplitFactor(previousRate.Close.Value, rate.Close.Value);

                                    var value = (splitFactor * rate.Close.Value).ToString("F2", CultureInfo.InvariantCulture);
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
                                Debug.WriteLine(snapshot.instrument.InstrumentName + " has insufficient rates: " + remainingRates.Count);
                            }

                            writer.Flush();
                        }
                    }
                });

                reportProgress(1);
            }
        }

        private static decimal GetSplitFactor(decimal previousRate, decimal rate)
        {
            var factor = previousRate / rate;
            var round = Math.Round(factor);
            if (round >= 2 && round < 100)
            {
                var frac = factor - round;
                if (Math.Abs(frac) < 0.05m)
                {
                    return round;
                }
            }

            factor = rate / previousRate;
            round = Math.Round(factor);
            if (round >= 2 && round < 100)
            {
                var frac = factor - round;
                if (Math.Abs(frac) < 0.05m)
                {
                    return 1 / round;
                }
            }

            return 1;
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
                        var decision = split[1];
                        var time = DateTime.ParseExact(split[2], "yyyyMMdd", CultureInfo.InvariantCulture);
                        var firstRate = decimal.Parse(split[3], CultureInfo.InstalledUICulture);
                        var lastRate = decimal.Parse(split.Last(), CultureInfo.InstalledUICulture);

                        var meta = new SnapshotMetadata()
                        {
                            Line = lineIndex,
                            InstrumentId = instrumentId,
                            Decision = decision,
                            Time = time,
                            CurrentPrice = lastRate,
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
                var previousBuyRate = 0m;

                foreach (var meta in group.OrderBy(x => x.Time))
                {
                    meta.Invested = invested;
                    meta.PreviousBuyRate = previousBuyRate;
                    switch (meta.Decision)
                    {
                        case "buy":
                            invested = true;
                            previousBuyRate = meta.CurrentPrice;
                            break;
                        case "sell":
                            invested = false;
                            previousBuyRate = 0m;
                            break;
                    }
                }
            }

            return metas;
        }

        public static void SplitByDecision(bool writeBuy, bool writeSell)
        {
            List<SnapshotMetadata> metas = GetDumpMetadata();

            var validMetas = metas.Where(x => x.Valid);

            var distinctMetas = validMetas.Distinct(new SnapshotMetadata.Comparer());

            using (var reader = new StreamReader(File.Open(FlatDumpFile, FileMode.Open)))
            {
                using (var buyWriter = writeBuy ? new StreamWriter(File.Open(FlatBuyFile, FileMode.Create)) : null)
                {
                    using (var nobuyWriter = writeBuy ? new StreamWriter(File.Open(FlatNoBuyFile, FileMode.Create)) : null)
                    {
                        using (var sellWriter = writeSell ? new StreamWriter(File.Open(FlatSellFile, FileMode.Create)) : null)
                        {
                            using (var nosellWriter = writeSell ? new StreamWriter(File.Open(FlatNoSellFile, FileMode.Create)) : null)
                            {
                                var header = reader.ReadLine();

                                if (writeBuy)
                                {
                                    buyWriter.WriteLine("id;" + header);
                                    nobuyWriter.WriteLine("id;" + header);
                                }

                                if (writeSell)
                                {
                                    sellWriter.WriteLine("id;" + header);
                                    nosellWriter.WriteLine("id;" + header);
                                }

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
                                        if (meta.Invested)
                                        {
                                            if (meta.Decision == "sell")
                                            {
                                                if (writeSell)
                                                {
                                                    sellWriter.WriteLine(linesRead + ";" + line);
                                                }
                                            }
                                            else if (meta.Decision == "ignore")
                                            {
                                                if (writeBuy)
                                                {
                                                    if (meta.PreviousBuyRate > 0 && meta.PreviousBuyRate < (meta.CurrentPrice * 1.01m))
                                                    {
                                                        var firstSemicolon = line.IndexOf(';');
                                                        var lineAsBuy = line.Substring(0, firstSemicolon + 1)
                                                            + "buy"
                                                            + line.Substring(line.IndexOf(';', firstSemicolon + 1));
                                                        buyWriter.WriteLine(linesRead + ";" + lineAsBuy);
                                                    }
                                                }

                                                if (writeSell)
                                                {
                                                    nosellWriter.WriteLine(linesRead + ";" + line);
                                                }
                                            }
                                        }
                                        else
                                        {
                                            if (meta.Decision == "buy")
                                            {
                                                if (writeBuy)
                                                {
                                                    buyWriter.WriteLine(linesRead + ";" + line);
                                                }
                                            }
                                            else if (meta.Decision == "ignore")
                                            {
                                                if (writeBuy)
                                                {
                                                    nobuyWriter.WriteLine(linesRead + ";" + line);
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
        }

        public static void SplitRandomTrainTest(string inPath, string testPath, string trainPath, double factor, int samples, bool preserveTestIds, Action<double> reportProgress)
        {
            reportProgress(0);

            var testIds = new HashSet<string>();
            if (preserveTestIds && File.Exists(testPath))
            {
                using (var reader = new StreamReader(File.Open(testPath, FileMode.Open)))
                {
                    var header = reader.ReadLine();
                    while (!reader.EndOfStream)
                    {
                        var line = reader.ReadLine();
                        var id = line.Substring(0, line.IndexOf(';'));
                        testIds.Add(id);
                    }
                }
            }

            using (var reader = new UnbufferedStreamReader(File.Open(inPath, FileMode.Open)))
            {
                var linePositions = new Dictionary<int, LineInfo>();
                GetLinePositions(linePositions, reader, true);

                var randomLinePositions = linePositions.Select(x => new { r = random.NextDouble(), v = x }).OrderBy(x => x.r).Select(x => x.v).Take(samples).ToList();

                var testCount = (int)(randomLinePositions.Count * factor);

                var testLines = randomLinePositions.Take(testCount).ToList();
                var trainLines = randomLinePositions.Skip(testCount).ToList();

                var moveFromTrainToTest = trainLines.Where(x => testIds.Contains(x.Value.Id)).ToList();
                var potentialTrainInTest = testLines.Where(x => !testIds.Contains(x.Value.Id)).ToList();
                var moveFromTestToTrain = potentialTrainInTest.Take(Math.Min(moveFromTrainToTest.Count, potentialTrainInTest.Count)).ToList();

                testLines = testLines.Except(moveFromTestToTrain).Concat(moveFromTrainToTest).ToList();
                trainLines = trainLines.Except(moveFromTrainToTest).Concat(moveFromTestToTrain).ToList();

                Debug.Assert(trainLines.All(x => !testIds.Contains(x.Value.Id)));
                Debug.Assert(!trainLines.Intersect(testLines).Any());
                Debug.Assert(trainLines.Union(testLines).Count() == randomLinePositions.Count);

                Debug.Assert(reader.BaseStream.CanSeek);

                reader.BaseStream.Seek(0, SeekOrigin.Begin);
                var header = reader.ReadLine();

                int i = 0;

                reader.BaseStream.Seek(0, SeekOrigin.Begin);
                using (var writer = new StreamWriter(File.Open(testPath, FileMode.Create)))
                {
                    writer.WriteLine(header);

                    foreach (var item in testLines)
                    {
                        reader.BaseStream.Seek(item.Value.Position, SeekOrigin.Begin);
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

                    foreach (var item in trainLines)
                    {
                        reader.BaseStream.Seek(item.Value.Position, SeekOrigin.Begin);
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
            var linePositions1 = new Dictionary<int, LineInfo>();
            var linePositions2 = new Dictionary<int, LineInfo>();

            reportProgress(0);

            using (var reader1 = new UnbufferedStreamReader(File.Open(inPath1, FileMode.Open)))
            {
                using (var reader2 = new UnbufferedStreamReader(File.Open(inPath2, FileMode.Open)))
                {
                    GetLinePositions(linePositions1, reader1, false);
                    GetLinePositions(linePositions2, reader2, false);

                    var randomLinePositions =
                        linePositions1.Select(x => new Tuple<UnbufferedStreamReader, KeyValuePair<int, LineInfo>>(reader1, x))
                        .Concat(linePositions2.Select(x => new Tuple<UnbufferedStreamReader, KeyValuePair<int, LineInfo>>(reader2, x)))
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
                            reader.BaseStream.Seek(item.Item2.Value.Position, SeekOrigin.Begin);

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

        public class LineInfo
        {
            public long Position;
            public string Id;
        }

        private static void GetLinePositions(Dictionary<int, LineInfo> linePositions1, UnbufferedStreamReader reader, bool readId)
        {
            var lineIndex = 0;
            while (reader.BaseStream.Position < reader.BaseStream.Length)
            {
                var position = reader.BaseStream.Position;
                var line = reader.ReadLine();

                if (lineIndex > 0)
                {
                    linePositions1.Add(lineIndex, new LineInfo { Position = position, Id = readId ? line.Substring(line.IndexOf(';')) : null });
                }

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


