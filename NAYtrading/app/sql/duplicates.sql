SELECT
	snapshot.ID,
	Duplicate.Instrument_ID, 
	Duplicate.Time
FROM
(
	SELECT
		*
	FROM
	(
		SELECT
			snapshot.Instrument_ID, 
			snapshot.Time, 
			count(1) AS Snapshots
		FROM
			snapshots AS snapshot
		GROUP BY
			snapshot.Instrument_ID, snapshot.Time
	) AS `group`
	WHERE
		`group`.Snapshots > 1
) AS Duplicate
INNER JOIN
	snapshots AS snapshot
	ON snapshot.Instrument_ID = Duplicate.Instrument_ID
    AND DATE(snapshot.Time) = DATE(Duplicate.Time)