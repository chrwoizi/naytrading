SELECT
	b.Instrument_ID,
	MAX(b.NewSourceType) AS NewSourceType,
	MAX(b.NewMarketId) AS NewMarketId
FROM
(
	SELECT
		b.ID,
		n.Instrument_ID,
		b.StartTime,
		b.Time,
		b.Price,
		b.SourceType,
		b.MarketId,
		n.SourceType as NewSourceType,
		n.MarketId as NewMarketId,
		(
			SELECT r.Close 
            FROM snapshotrates r 
            WHERE r.Snapshot_ID = b.NewId 
            AND r.Time >= b.PriceTime - INTERVAL 12 HOUR 
            ORDER BY r.Time ASC 
            LIMIT 1
		) AS NewPrice
	FROM
	(
		SELECT
			o.ID,
			o.StartTime,
			o.Time,
			o.Split,
			o.Price,
			o.PriceTime,
			o.SourceType,
			o.MarketId,
			(
				SELECT n.ID 
                FROM snapshots n 
                WHERE n.Instrument_ID = o.Instrument_ID 
                AND n.Time > o.Time 
                ORDER BY n.Time DESC 
                LIMIT 1
			) AS NewId
		FROM snapshots o
	) AS b
	INNER JOIN snapshots n ON n.ID = b.NewId
	WHERE (b.Split not in ('FIXED', 'NOSOURCE') OR n.Split not in ('FIXED', 'NOSOURCE'))
) AS b
WHERE ABS((b.NewPrice - b.Price) / b.Price) > @minDiffRatio
GROUP BY b.Instrument_ID;