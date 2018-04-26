SELECT
    instrument.ID AS InstrumentId,
    instrument.InstrumentName,
    instrument.Isin,
    instrument.Wkn,
    snapshot.ID AS SnapshotId,
    snapshot.Decision,
    snapshot.Time AS DecisionTime,
    snapshot.Price AS Price,
    snapshot.PriceTime AS Time
FROM
    instruments AS instrument
INNER JOIN
    snapshots AS snapshot
    ON snapshot.User = @userName
    AND snapshot.Instrument_ID = instrument.ID
    AND snapshot.Time >= @fromDate
    AND (snapshot.Decision = 'buy' OR snapshot.Decision = 'sell')
ORDER BY
    snapshot.Time ASC;