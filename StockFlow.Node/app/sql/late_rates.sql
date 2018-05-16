SELECT 
	s.ID, 
	s.Instrument_ID 
FROM 
(
	SELECT 
		s.ID,
		s.Instrument_ID, 
		s.Time,
		(SELECT r.Time FROM snapshotrates r WHERE r.Snapshot_ID = s.ID ORDER BY r.Time LIMIT 1) as StartTime 
	FROM 
		snapshots s
) AS s 
WHERE 
	datediff(s.Time, s.StartTime) < @minDays