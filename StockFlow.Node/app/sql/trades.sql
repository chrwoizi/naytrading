SELECT
    trade.InstrumentId,
    trade.InstrumentName,
    trade.Isin,
    trade.Wkn,
    trade.SnapshotId,
    trade.Decision, 
    rate.Time,
    rate.Close AS Price
FROM
(
    SELECT
        instrument.InstrumentId,
        instrument.InstrumentName,
        instrument.Isin,
        instrument.Wkn,
        instrument.SnapshotId,
        snapshot.Decision,
        (
            SELECT
                rate.ID
            FROM
                snapshotrates AS rate
            WHERE
                rate.Snapshot_ID = instrument.snapshotId
                AND rate.Close IS NOT NULL
            ORDER BY
                rate.Time DESC
            LIMIT 1
        ) AS RateId
    FROM
    (
        SELECT
            instrument.ID AS InstrumentId,
            instrument.InstrumentName,
            instrument.Isin,
            instrument.Wkn,
            (
                SELECT
                    snapshot.ID
                FROM
                    snapshots AS snapshot
                WHERE
                    snapshot.User = @userName
                    AND snapshot.Instrument_ID = instrument.ID
                    AND snapshot.Time >= @fromDate
                    AND snapshot.Decision = 'buy' OR snapshot.Decision = 'sell'
                ORDER BY
                    snapshot.Time DESC
                LIMIT 1
            ) AS SnapshotId
        FROM
            instruments AS instrument
        WHERE
            instrument.User = @userName
    ) AS instrument
    INNER JOIN
        snapshots AS snapshot
        ON snapshot.ID = instrument.SnapshotId
) AS trade
INNER JOIN
    snapshotrates AS rate
    ON rate.ID = trade.rateId;