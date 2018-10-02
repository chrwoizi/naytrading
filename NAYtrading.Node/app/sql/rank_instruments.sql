SELECT 
	i.ID,
	(
		@strikesOrderWeight * (CASE WHEN i.MaxStrikes > 0 THEN 1 / i.MaxStrikes ELSE 0 END)
		+ @boughtOrderWeight * (CASE WHEN i.buyRate IS NOT NULL THEN i.buyRate ELSE 0 END)
		+ @capitalizationOrderWeight * (CASE WHEN i.Capitalization IS NOT NULL THEN i.Capitalization / @maxCapitalization ELSE 0 END)
		+ @snapshotCountOrderWeight * (CASE WHEN i.snapshotCount > 0 THEN 1 / i.snapshotCount ELSE 0 END)
		+ @staticWeight * (CASE WHEN i.staticWeight IS NOT NULL THEN LEAST(GREATEST(0, i.staticWeight), 1) ELSE 0 END)
	) AS `Order`
FROM
(
	SELECT 
		i.ID,
		i.Capitalization,
		(SELECT MAX(c.Strikes) FROM sources AS c WHERE c.Instrument_ID = i.ID) AS MaxStrikes,
        (
			SELECT
				SUM(CASE u.Decision WHEN 'buy' THEN 1 WHEN 'sell' THEN -1 ELSE 0 END) / GREATEST(COUNT(1), 1) AS buyRate
			FROM
				usersnapshots AS u
			INNER JOIN
				snapshots AS s
			ON
				s.ID = u.Snapshot_ID
			WHERE
				s.Instrument_ID = i.ID
				AND (u.Decision = 'buy' OR u.Decision = 'sell')
		) AS buyRate,
		(SELECT COUNT(1) FROM snapshots AS s WHERE s.Instrument_ID = i.ID) AS snapshotCount,
        LEAST(GREATEST(0, (SELECT SUM(w.Weight) FROM weights AS w WHERE w.Instrument_ID = i.ID)), 1) AS staticWeight
	FROM
		instruments AS i
	WHERE 
		NOT EXISTS
		(
			SELECT 
				1
			FROM
				snapshots AS s
			WHERE
				s.Instrument_ID = i.ID
				AND s.Time > @validFromDateTime
		)
		AND EXISTS (SELECT 1 FROM sources AS c WHERE c.Instrument_ID = i.ID AND c.Status = "ACTIVE")
) AS i
WHERE
	i.MaxStrikes <= @maxStrikes;