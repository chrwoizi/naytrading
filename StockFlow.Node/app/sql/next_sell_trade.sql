SELECT
	snapshot.ID,
	snapshot.Time,
	snapshot.Price
FROM snapshots AS snapshot
WHERE snapshot.User = @userName
AND snapshot.Instrument_ID = @instrumentId
AND snapshot.Decision = 'sell'
AND snapshot.Time >= @fromTime
ORDER BY snapshot.Time ASC
LIMIT 1;