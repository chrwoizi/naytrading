SELECT 
	s.Time AS SnapshotTime,
	s.ID 
FROM snapshots AS s 
WHERE NOT EXISTS 
(
	SELECT 1 
	FROM usersnapshots AS u 
	WHERE u.Snapshot_ID = s.ID 
	AND u.User = @userName
) 
AND EXISTS 
(
	SELECT 1 
	FROM userinstruments AS u 
	WHERE u.Instrument_ID = s.Instrument_ID 
	AND u.User = @userName
) 
AND NOT EXISTS 
(
	SELECT 1 
	FROM usersnapshots AS u 
    INNER JOIN snapshots AS us ON us.ID = u.Snapshot_ID
	WHERE us.Time > s.Time AND us.Instrument_ID = s.Instrument_ID 
	AND u.User = @userName
)
ORDER BY  
	SnapshotTime ASC, 
	ID ASC;