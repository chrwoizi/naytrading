SELECT
    trade.InstrumentId,
    trade.InstrumentName,
    trade.Isin,
    trade.Wkn,
    trade.SnapshotId,
    trade.Decision,
    trade.DecisionTime, 
    rate.Time,
    rate.Close AS Price
FROM
(
    SELECT
        instrument.ID AS InstrumentId,
        instrument.InstrumentName,
        instrument.Isin,
        instrument.Wkn,
        snapshot.ID AS SnapshotId,
        snapshot.Decision,
        snapshot.ModifiedTime AS DecisionTime,
        (
            SELECT
                rate.ID
            FROM
                snapshotrates AS rate
            WHERE
                rate.Snapshot_ID = snapshot.ID
            ORDER BY
                rate.Time DESC
            LIMIT 1
        ) AS RateId
    FROM
        instruments AS instrument
    INNER JOIN
    (
        SELECT
            snapshot.ID,
            snapshot.Instrument_ID,
            snapshot.Decision,
            snapshot.ModifiedTime
        FROM
            snapshots AS snapshot
        WHERE
            snapshot.User = @userName
            AND snapshot.ModifiedTime >= @fromDate
            AND (snapshot.Decision = 'buy' OR snapshot.Decision = 'sell')
    ) AS snapshot
    ON snapshot.Instrument_ID = instrument.ID
) AS trade
INNER JOIN
    snapshotrates AS rate
    ON rate.ID = trade.rateId
ORDER BY
    trade.DecisionTime ASC;