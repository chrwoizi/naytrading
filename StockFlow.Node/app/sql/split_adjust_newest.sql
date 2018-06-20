SELECT DISTINCT
	b.Instrument_ID,
	b.SourceType AS NewSourceType,
	b.MarketId AS NewMarketId
FROM
	(
		SELECT
			b.Instrument_ID,
			b.SourceType,
			b.MarketId,
            o.updatedAt as OldUpdatedAt,
			o.Price AS OldPrice,
			(
				SELECT r.Close 
				FROM snapshotrates r 
				WHERE r.Snapshot_ID = b.ID
				AND r.Time >= o.PriceTime - INTERVAL 12 HOUR 
				ORDER BY r.Time ASC 
				LIMIT 1
			) AS NewPrice
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
	) AS b
WHERE ABS((b.NewPrice - b.OldPrice) / b.OldPrice) > @minDiffRatio
AND b.OldUpdatedAt < NOW() - INTERVAL @minDaysSinceRefresh DAY;