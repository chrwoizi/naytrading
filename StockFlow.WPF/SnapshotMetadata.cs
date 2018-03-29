namespace StockFlow
{
    using System.Collections.Generic;
    using System;
    using System.Globalization;

    public class SnapshotMetadata
    {
        public long Line;
        public string InstrumentId;
        public string Decision;
        public DateTime Time;
        public bool Invested;
        public bool Valid;

        public class Comparer : IEqualityComparer<SnapshotMetadata>
        {
            public bool Equals(SnapshotMetadata x, SnapshotMetadata y)
            {
                return x.InstrumentId == y.InstrumentId && x.Decision == y.Decision && x.Time == y.Time;
            }

            public int GetHashCode(SnapshotMetadata obj)
            {
                return (obj.InstrumentId + obj.Decision + obj.Time.ToString("yyyyMMdd", CultureInfo.InvariantCulture)).GetHashCode();
            }
        }
    }
}
