SELECT 
	0 AS source, 
	s.Time - (NOW() - INTERVAL @hours HOUR) AS ageOrder, 
	s.ID AS idOrder, 
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
AND (
	@isAI = 0 OR 
	EXISTS 
	(
		SELECT 1 
		FROM usersnapshots AS u 
		WHERE u.Snapshot_ID = s.ID 
		AND u.User <> @userName
	) 
)
AND NOT EXISTS 
(
	SELECT 1 
	FROM usersnapshots AS u 
    INNER JOIN snapshots AS us ON us.ID = u.Snapshot_ID
	WHERE us.Time > s.Time AND us.Instrument_ID = s.Instrument_ID 
	AND u.User = @userName
) 
AND s.Time >= NOW() - INTERVAL @hours HOUR
AND CASE (
		SELECT su.Decision 
		FROM usersnapshots AS su 
        INNER JOIN snapshots AS sus ON sus.ID = su.Snapshot_ID
		WHERE sus.Instrument_ID = s.Instrument_ID AND su.User = @userName
        ORDER BY su.ModifiedTime DESC LIMIT 1
	)
	WHEN 'wait1yr' THEN s.Time < NOW() - INTERVAL 1 YEAR 
	WHEN 'wait2mo' THEN s.Time < NOW() - INTERVAL 2 MONTH 
    ELSE TRUE 
    END
UNION ALL
SELECT 
	1 AS source, 
	NOW() - s.Time AS ageOrder, 
	-s.ID AS idOrder, 
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
AND (
	@isAI = 0 OR 
	EXISTS 
	(
		SELECT 1 
		FROM usersnapshots AS u 
		WHERE u.Snapshot_ID = s.ID 
		AND u.User <> @userName
	) 
)
AND NOT EXISTS 
(
	SELECT 1 
	FROM usersnapshots AS u 
    INNER JOIN snapshots AS us ON us.ID = u.Snapshot_ID
	WHERE us.Time > s.Time AND us.Instrument_ID = s.Instrument_ID 
	AND u.User = @userName
) 
AND s.Time < NOW() - INTERVAL @hours HOUR 
AND CASE (
		SELECT su.Decision 
		FROM usersnapshots AS su 
        INNER JOIN snapshots AS sus ON sus.ID = su.Snapshot_ID
		WHERE sus.Instrument_ID = s.Instrument_ID AND su.User = @userName
        ORDER BY su.ModifiedTime DESC LIMIT 1
	)
	WHEN 'wait1yr' THEN s.Time < NOW() - INTERVAL 1 YEAR 
	WHEN 'wait2mo' THEN s.Time < NOW() - INTERVAL 2 MONTH 
    ELSE TRUE 
    END
ORDER BY 
	source ASC, 
	ageOrder ASC, 
	idOrder ASC;