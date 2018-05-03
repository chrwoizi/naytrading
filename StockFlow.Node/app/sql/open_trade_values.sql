SELECT
	trade.ID,
	trade.Time,
	(
		SELECT
			latestSnapshot.Price
		FROM
			snapshots AS latestSnapshot
		WHERE
			latestSnapshot.User = @userName
			AND latestSnapshot.Instrument_ID = buySnapshot.Instrument_ID
			AND latestSnapshot.Time >= buySnapshot.Time
		ORDER BY
			latestSnapshot.Time DESC
		LIMIT 1
	) AS LatestPrice
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
			newerSnapshot.User = @userName
			AND newerSnapshot.Instrument_ID = buySnapshot.Instrument_ID
			AND newerSnapshot.Time > buySnapshot.Time
			AND newerSnapshot.Decision = 'sell'
		LIMIT 1
	)
ORDER BY trade.Time ASC;