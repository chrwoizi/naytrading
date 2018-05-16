SELECT
	s.ID,
	s.Instrument_ID 
FROM 
(
	SELECT 
		r.Snapshot_ID, 
		COUNT(1) as c 
	FROM 
		snapshotrates r 
	GROUP BY 
		r.Snapshot_ID
) AS r 
INNER JOIN 
	snapshots s 
	ON s.ID = r.Snapshot_ID 
WHERE r.c < @minRates