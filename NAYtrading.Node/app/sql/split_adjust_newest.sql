SELECT
	newest.Instrument_ID,
	newest.SourceType AS NewSourceType,
	newest.MarketId AS NewMarketId
FROM 
(
	SELECT 
		n.ID,
		n.Instrument_ID,
		n.SourceType,
		n.MarketId,
		(
			SELECT ID
			FROM snapshots AS previous
			WHERE previous.Instrument_ID = n.Instrument_ID 
			AND previous.Time < n.Time 
			ORDER BY previous.Time DESC 
			LIMIT 1
		) AS PreviousId
	FROM snapshots AS n
	WHERE NOT EXISTS 
		(
			SELECT 1 
			FROM snapshots AS newer 
			WHERE newer.Instrument_ID = n.Instrument_ID 
			AND newer.Time > n.Time
		)
) AS newest
INNER JOIN snapshots AS previous ON previous.ID = newest.PreviousId
WHERE (SELECT r.updatedAt FROM snapshotrates r WHERE r.Snapshot_ID = previous.ID LIMIT 1) < NOW() - INTERVAL @minDaysSinceRefresh DAY
AND ABS(((SELECT r.Close FROM snapshotrates r WHERE r.Snapshot_ID = newest.ID AND r.Time = previous.PriceTime LIMIT 1) - previous.Price) / previous.Price) > @minDiffRatio;