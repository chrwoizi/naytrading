SELECT
	SUM((
		SELECT
			latestSnapshot.Price
		FROM
			snapshots AS latestSnapshot
		WHERE
			latestSnapshot.Instrument_ID = buySnapshot.Instrument_ID
			AND latestSnapshot.Time >= buySnapshot.Time
			AND latestSnapshot.Time <= @toDate
		ORDER BY
			latestSnapshot.Time DESC
		LIMIT 1
	) * trade.Quantity) AS Value
FROM trades AS trade
INNER JOIN snapshots AS buySnapshot
ON buySnapshot.ID = trade.Snapshot_ID
INNER JOIN usersnapshots AS buyUserSnapshot
ON buyUserSnapshot.Snapshot_ID = trade.Snapshot_ID
WHERE 
	trade.User = @userName
	AND buyUserSnapshot.Decision = 'buy'
	AND buySnapshot.Time <= @toDate
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
			AND newerSnapshot.Time <= @toDate
			AND newerUserSnapshot.Decision = 'sell'
		LIMIT 1
	)
ORDER BY trade.Time ASC;