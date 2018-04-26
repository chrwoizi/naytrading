SELECT
	trade.ID,
	trade.Time,
	trade.SellPrice
FROM
(
	SELECT
		trade.ID,
		trade.Time,
		(
			SELECT
				sellSnapshot.Price
			FROM
				snapshots AS sellSnapshot
			WHERE
				sellSnapshot.User = trade.User
				AND sellSnapshot.Instrument_ID = buySnapshot.Instrument_ID
				AND sellSnapshot.Time >= buySnapshot.Time
			ORDER BY
				sellSnapshot.Time DESC
			LIMIT 1
		) AS SellPrice
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
ORDER BY trade.Time ASC;