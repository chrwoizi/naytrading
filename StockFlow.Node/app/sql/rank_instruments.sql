SELECT 
	instrument.ID,
	(
		@strikesOrderWeight * (CASE WHEN instrument.Strikes > 0 THEN 1 / instrument.Strikes ELSE 0 END)
		+ @boughtOrderWeight * (CASE WHEN 'buy' = instrument.previousDecision THEN 1 ELSE 0 END)
		+ @capitalizationOrderWeight * (CASE WHEN instrument.Capitalization IS NOT NULL THEN instrument.Capitalization / @maxCapitalization ELSE 0 END)
		+ @snapshotCountOrderWeight * (CASE WHEN instrument.snapshotCount > 0 THEN 1 / instrument.snapshotCount ELSE 0 END)
	) AS RANK
FROM
(
	SELECT 
		instrument.ID,
		instrument.Capitalization,
		instrument.Strikes,
		(
			SELECT 
				snapshot.Decision
			FROM
				Snapshots AS snapshot
			WHERE
				instrument.ID = snapshot.Instrument_ID
				AND (snapshot.Decision = 'buy' OR snapshot.Decision = 'sell')
			ORDER BY snapshot.Time DESC
			LIMIT 1
		) AS previousDecision,
		(SELECT COUNT(1) FROM Snapshots AS snapshot WHERE instrument.ID = snapshot.Instrument_ID) AS snapshotCount
	FROM
		Instruments AS instrument
	WHERE
		instrument.User = @userName
		AND instrument.Strikes <= @maxStrikes
		AND NOT EXISTS
		(
			SELECT 
				1
			FROM
				Snapshots AS snapshot
			WHERE
				instrument.ID = snapshot.Instrument_ID
				AND snapshot.Time > @validFromDateTime
		)
) AS instrument;

/*SELECT 
	instrument.ID,
	(
		0.1 * (CASE WHEN instrument.Strikes > 0 THEN 1 / instrument.Strikes ELSE 0 END)
		+ 0.3 * (CASE WHEN 'buy' = instrument.previousDecision THEN 1 ELSE 0 END)
		+ 0.15 * (CASE WHEN instrument.Capitalization IS NOT NULL THEN instrument.Capitalization / 738340000000 ELSE 0 END)
		+ 0.05 * (CASE WHEN instrument.snapshotCount > 0 THEN 1 / instrument.snapshotCount ELSE 0 END)
	) AS RANK
FROM
(
	SELECT 
		instrument.ID,
		instrument.Capitalization,
		instrument.Strikes,
		(
			SELECT 
				snapshot.Decision
			FROM
				Snapshots AS snapshot
			WHERE
				instrument.ID = snapshot.Instrument_ID
				AND (snapshot.Decision = 'buy' OR snapshot.Decision = 'sell')
			ORDER BY snapshot.Time DESC
			LIMIT 1
		) AS previousDecision,
		(SELECT COUNT(1) FROM Snapshots AS snapshot WHERE instrument.ID = snapshot.Instrument_ID) AS snapshotCount
	FROM
		Instruments AS instrument
	WHERE
		instrument.User = '***REMOVED***'
		AND instrument.Strikes <= 30
		AND NOT EXISTS
		(
			SELECT 
				1
			FROM
				Snapshots AS snapshot
			WHERE
				instrument.ID = snapshot.Instrument_ID
				AND snapshot.Time > '06.04.2018 00:00:00'
		)
) AS instrument;*/