SELECT
    instrument.ID AS InstrumentId,
    instrument.InstrumentName,
    instrument.Isin,
    instrument.Wkn,
    snapshot.ID AS SnapshotId,
    userSnapshot.Decision,
    snapshot.Time AS DecisionTime,
    snapshot.Price AS Price,
    snapshot.PriceTime AS Time
FROM
    instruments AS instrument
INNER JOIN
    snapshots AS snapshot
    ON snapshot.Instrument_ID = instrument.ID
    AND snapshot.Time >= @fromDate
INNER JOIN
    usersnapshots AS userSnapshot
    ON userSnapshot.Snapshot_ID = snapshot.ID
    AND userSnapshot.User = @userName
    AND (userSnapshot.Decision = 'buy' OR userSnapshot.Decision = 'sell')
ORDER BY
    snapshot.Time ASC;