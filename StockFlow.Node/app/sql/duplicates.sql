SELECT
	snapshot.ID,
    snapshot.Decision,
	Duplicate.User, 
	Duplicate.Instrument_ID, 
	Duplicate.Time
FROM
(
	SELECT
		*
	FROM
	(
		SELECT
			snapshot.User, 
			snapshot.Instrument_ID, 
			snapshot.Time, 
			count(1) AS Snapshots
		FROM
			snapshots AS snapshot
		GROUP BY
			snapshot.User, snapshot.Instrument_ID, snapshot.Time
	) AS `group`
	WHERE
		`group`.Snapshots > 1
) AS Duplicate
INNER JOIN
	snapshots snapshot
	ON snapshot.User = Duplicate.User
    AND snapshot.Instrument_ID = Duplicate.Instrument_ID
    AND snapshot.Time = Duplicate.Time