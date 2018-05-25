SELECT 
	i.ID,
	(
		@strikesOrderWeight * (CASE WHEN i.Strikes > 0 THEN 1 / i.Strikes ELSE 0 END)
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
		i.Strikes,
		d.buyRate,
		(SELECT COUNT(1) FROM snapshots AS s WHERE s.Instrument_ID = i.ID) AS snapshotCount,
        LEAST(GREATEST(0, (SELECT SUM(w.Weight) FROM weights AS w WHERE w.Instrument_ID = i.ID)), 1) AS staticWeight
	FROM
		instruments AS i
	LEFT JOIN
    (
		SELECT
			d.Instrument_ID,
			COUNT(CASE WHEN d.Decision = 'buy' THEN 1 ELSE NULL END) / GREATEST(COUNT(1), 1) AS buyRate
		FROM
		(
			SELECT
				(
					SELECT 
						u.Decision
					FROM
						usersnapshots AS u
					INNER JOIN
						snapshots AS s
					ON
						s.ID = u.Snapshot_ID
					WHERE
						u.User = us.User
						AND s.Instrument_ID = us.Instrument_ID
						AND (u.Decision = 'buy' OR u.Decision = 'sell')
					ORDER BY s.Time DESC
					LIMIT 1
				) AS Decision,
                us.Instrument_ID
			FROM
				(
					SELECT
						DISTINCT u.User, s.Instrument_ID
					FROM
						usersnapshots AS u
					INNER JOIN
						snapshots AS s
					ON
						s.ID = u.Snapshot_ID
				) AS us
		) AS d
		GROUP BY
			d.Instrument_ID
    ) AS d
		ON d.Instrument_ID = i.ID
	WHERE
		i.Strikes <= @maxStrikes
		AND NOT EXISTS
		(
			SELECT 
				1
			FROM
				snapshots AS s
			WHERE
				s.Instrument_ID = i.ID
				AND s.Time > @validFromDateTime
		)
) AS i;