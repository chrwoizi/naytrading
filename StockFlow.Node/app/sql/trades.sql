SELECT
    trade.InstrumentId,
    trade.InstrumentName,
    trade.Isin,
    trade.Wkn,
    trade.SnapshotId,
    trade.Decision,
    trade.DecisionTime
FROM
(
    SELECT
        instrument.ID AS InstrumentId,
        instrument.InstrumentName,
        instrument.Isin,
        instrument.Wkn,
        snapshot.ID AS SnapshotId,
        snapshot.Decision,
        snapshot.Time AS DecisionTime
    FROM
        instruments AS instrument
    INNER JOIN
        snapshots AS snapshot
        ON snapshot.User = @userName
        AND snapshot.Instrument_ID = instrument.ID
        AND snapshot.Time >= @fromDate
        AND (snapshot.Decision = 'buy' OR snapshot.Decision = 'sell')
) AS trade
ORDER BY
    trade.DecisionTime ASC;