SELECT
	s.ID,
	s.Time,
	s.Price
FROM snapshots AS s
INNER JOIN usersnapshots AS u
ON u.Snapshot_ID = s.ID
WHERE u.User = @userName
AND s.Instrument_ID = @instrumentId
AND u.Decision = 'sell'
AND s.Time >= @fromTime
ORDER BY s.Time ASC
LIMIT 1;