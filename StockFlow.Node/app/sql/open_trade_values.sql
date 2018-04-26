SELECT
    trade.ID,
	trade.Time,
    sellRate.Close AS SellPrice
FROM
(
	SELECT
		trade.ID,
		trade.Time,
        (
            SELECT
                rate.ID
            FROM
                snapshotrates AS rate
            WHERE
                rate.Snapshot_ID = trade.SellSnapshotId
            ORDER BY
                rate.Time DESC
            LIMIT 1
        ) AS SellRateId
	FROM
    (
		SELECT
			trade.ID,
            trade.Time,
            (
				SELECT
					sellSnapshot.ID
				FROM
					snapshots AS sellSnapshot
				WHERE
                    sellSnapshot.User = trade.User
					AND sellSnapshot.Instrument_ID = buySnapshot.Instrument_ID
                    AND sellSnapshot.Time >= buySnapshot.Time
				ORDER BY
					sellSnapshot.Time DESC
				LIMIT 1
            ) AS SellSnapshotId
		FROM trades AS trade
		INNER JOIN snapshots AS buySnapshot
		ON buySnapshot.ID = trade.Snapshot_ID
        WHERE 
            trade.User = @userName
			AND buySnapshot.Decision = 'buy'
            AND NOT EXISTS 
			(
				SELECT 1
				FROM snapshots AS newerSnapshot
				WHERE 
					newerSnapshot.User = trade.User
					AND newerSnapshot.Instrument_ID = buySnapshot.Instrument_ID
					AND newerSnapshot.Time > buySnapshot.Time
				AND newerSnapshot.Decision = 'sell'
                LIMIT 1
			)
    ) AS trade
) AS trade
INNER JOIN snapshotrates AS sellRate
ON sellRate.ID = trade.SellRateId
ORDER BY trade.Time ASC;