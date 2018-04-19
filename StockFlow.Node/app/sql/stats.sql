SELECT
	trade.Time as Time,
    case when trade.Decision = 'sell' then 1 else 0 end AS IsComplete,
	(trade.Price - trade.PreviousPrice) / trade.PreviousPrice AS `Return`,
    trade.InstrumentName AS InstrumentName
FROM
	(
	SELECT
		snapshot.ID AS ID,
		snapshot.Time AS Time,
		snapshot.Decision AS Decision,
		(
			SELECT
				rate.Close
			FROM
				snapshotrates AS rate
			WHERE
				rate.Snapshot_ID = snapshot.ID
			ORDER BY
				rate.Time DESC
			LIMIT 1
		) AS Price,
		previousSnapshot.ID AS PreviousID,
		previousSnapshot.Time AS PreviousTime,
		previousSnapshot.Decision AS PreviousDecision,
		instrument.InstrumentName AS InstrumentName,
		(
			SELECT
				rate.Close
			FROM
				snapshotrates AS rate
			WHERE
				rate.Snapshot_ID = previousSnapshot.ID
			ORDER BY
				rate.Time DESC
			LIMIT 1
		) AS PreviousPrice
	FROM
		(
			SELECT
				snapshot.ID,
				snapshot.Time,
				snapshot.Decision,
				snapshot.Instrument_ID,
				CASE WHEN PreviousID IS NULL THEN snapshot.ID ELSE PreviousID END as PreviousID
			FROM
				(
					SELECT 
						snapshot.ID,
						snapshot.Time,
						snapshot.Decision,
						snapshot.Instrument_ID,
						(
							SELECT
								previousSnapshot.ID
							FROM
								snapshots as previousSnapshot
							WHERE
								previousSnapshot.Instrument_ID = snapshot.Instrument_ID
								AND previousSnapshot.ID <> snapshot.ID
								AND previousSnapshot.Time < snapshot.Time
								AND previousSnapshot.Decision IS NOT NULL
								AND previousSnapshot.Decision <> 'ignore'
							ORDER BY
								previousSnapshot.Time DESC
							LIMIT 1
						) AS PreviousID
					FROM 
						snapshots AS snapshot 
					WHERE
						snapshot.User = @userName
						AND 
                        (
							snapshot.Decision = 'sell'
							OR NOT EXISTS
							(
								SELECT
									1
								FROM
									snapshots AS newerSnapshot
								WHERE
									newerSnapshot.Instrument_ID = snapshot.Instrument_ID
									AND newerSnapshot.ID <> snapshot.ID
									AND newerSnapshot.Time > snapshot.Time
							)
						)
				) AS snapshot
		) AS snapshot
	LEFT JOIN
		snapshots AS previousSnapshot
	ON
		previousSnapshot.ID = PreviousID
	INNER JOIN
		instruments AS instrument
	ON
		instrument.ID = snapshot.Instrument_ID
	WHERE
		snapshot.Decision = 'buy'
		OR previousSnapshot.Decision = 'buy'
	) AS trade;
    