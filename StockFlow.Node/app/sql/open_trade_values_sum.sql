SELECT
	SUM(((
		SELECT
			sellSnapshot.Price
		FROM
			snapshots AS sellSnapshot
		WHERE
			sellSnapshot.User = @userName
			AND sellSnapshot.Instrument_ID = buySnapshot.Instrument_ID
			AND sellSnapshot.Time >= buySnapshot.Time
			AND sellSnapshot.Time <= @toDate
			AND sellSnapshot.Decision = 'sell'
		ORDER BY
			sellSnapshot.Time ASC
		LIMIT 1
	) - trade.Price) * trade.Quantity) AS Value
FROM trades AS trade
INNER JOIN snapshots AS buySnapshot
ON buySnapshot.ID = trade.Snapshot_ID
WHERE 
	trade.User = @userName
	AND buySnapshot.Decision = 'buy'
	AND buySnapshot.Time <= @toDate
	AND NOT EXISTS 
	(
		SELECT 1
		FROM snapshots AS newerSnapshot
		WHERE 
			newerSnapshot.User = @userName
			AND newerSnapshot.Instrument_ID = buySnapshot.Instrument_ID
			AND newerSnapshot.Time > buySnapshot.Time
			AND newerSnapshot.Time <= @toDate
			AND newerSnapshot.Decision = 'sell'
		LIMIT 1
	)
ORDER BY trade.Time ASC;