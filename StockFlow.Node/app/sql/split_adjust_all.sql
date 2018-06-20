SELECT DISTINCT
	b.Instrument_ID,
	b.NewSourceType,
	b.NewMarketId
FROM
(
	SELECT
		n.Instrument_ID,
		b.Price,
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
			o.Split,
			o.Price,
			o.PriceTime,
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
WHERE ABS((b.NewPrice - b.Price) / b.Price) > @minDiffRatio;