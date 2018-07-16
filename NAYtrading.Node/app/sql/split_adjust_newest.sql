SELECT
	b.Instrument_ID,
	b.SourceType AS NewSourceType,
	b.MarketId AS NewMarketId
FROM 
(
	SELECT 
		n.ID,
		n.Instrument_ID,
		n.SourceType,
		n.MarketId,
		(
			SELECT ID
			FROM snapshots AS o 
			WHERE o.Instrument_ID = n.Instrument_ID 
			AND o.Time < n.Time 
			ORDER BY o.Time DESC 
			LIMIT 1
		) AS OldId
	FROM snapshots AS n
	WHERE NOT EXISTS 
		(
			SELECT 1 
			FROM snapshots AS nn 
			WHERE nn.Instrument_ID = n.Instrument_ID 
			AND nn.Time > n.Time
		)
) AS b
INNER JOIN snapshots AS o ON o.ID = b.OldId
WHERE (SELECT r.updatedAt FROM snapshotrates r WHERE r.Snapshot_ID = o.ID LIMIT 1) < NOW() - INTERVAL @minDaysSinceRefresh DAY
AND ABS(((SELECT r.Close FROM snapshotrates r WHERE r.Snapshot_ID = b.ID AND r.Time = o.PriceTime LIMIT 1) - o.Price) / o.Price) > @minDiffRatio;