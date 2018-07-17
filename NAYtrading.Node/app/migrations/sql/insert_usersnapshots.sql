INSERT INTO usersnapshots (User, ModifiedTime, Decision, Snapshot_ID, createdAt, updatedAt) 
(
SELECT * 
FROM (
	SELECT 
		s.User, 
		s.ModifiedTime,
		s.Decision,
		(
			SELECT MIN(g.ID)
			FROM snapshots AS g 
			WHERE
				g.Time = s.Time
				AND g.Instrument_ID = s.Instrument_ID
		) AS Snapshot_ID, 
		NOW() AS createdAt, 
		NOW() AS updatedAt 
	FROM snapshots AS s 
	WHERE 
		s.User IS NOT NULL
		AND s.Decision IS NOT NULL
) AS n
WHERE
	NOT EXISTS 
    (
		SELECT 1
        FROM usersnapshots u
        WHERE u.User = n.User
        AND u.Snapshot_ID = n.Snapshot_ID
    )
)