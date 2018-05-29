SELECT
		trade.ID,
		trade.Time,
		latestSnapshot.Price AS LatestPrice,
		latestSnapshot.Time AS LatestSnapshotTime
FROM
(
	SELECT
		trade.ID,
		trade.Time,
		(
			SELECT
				latestSnapshot.ID
			FROM
				snapshots AS latestSnapshot
			WHERE
				latestSnapshot.Instrument_ID = buySnapshot.Instrument_ID
				AND latestSnapshot.Time >= buySnapshot.Time
			ORDER BY
				latestSnapshot.Time DESC
			LIMIT 1
		) AS latestSnapshotId
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
) AS trade
LEFT JOIN snapshots AS latestSnapshot
ON latestSnapshot.ID = trade.latestSnapshotId
ORDER BY trade.Time ASC;