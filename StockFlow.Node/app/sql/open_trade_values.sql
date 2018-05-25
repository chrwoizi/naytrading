SELECT
	trade.ID,
	trade.Time,
	(
		SELECT
			latestSnapshot.Price
		FROM
			snapshots AS latestSnapshot
		WHERE
			latestSnapshot.Instrument_ID = buySnapshot.Instrument_ID
			AND latestSnapshot.Time >= buySnapshot.Time
		ORDER BY
			latestSnapshot.Time DESC
		LIMIT 1
	) AS LatestPrice
FROM trades AS trade
INNER JOIN snapshots AS buySnapshot
ON buySnapshot.ID = trade.Snapshot_ID
INNER JOIN usersnapshots AS buyUserSnapshot
ON buyUserSnapshot.Snapshot_ID = trade.Snapshot_ID
AND buyUserSnapshot.User = @userName
WHERE 
	trade.User = @userName
	AND buyUserSnapshot.Decision = 'buy'
	AND NOT EXISTS 
	(
		SELECT 1
		FROM snapshots AS newerSnapshot
		INNER JOIN usersnapshots AS newerUserSnapshot
		ON newerUserSnapshot.Snapshot_ID = newerSnapshot.ID
		WHERE 
			newerUserSnapshot.User = @userName
			AND newerSnapshot.Instrument_ID = buySnapshot.Instrument_ID
			AND newerSnapshot.Time > buySnapshot.Time
			AND newerUserSnapshot.Decision = 'sell'
		LIMIT 1
	)
ORDER BY trade.Time ASC;