SELECT
	s.ID,
	s.Instrument_ID 
FROM
	snapshots s
WHERE 
	(SELECT COUNT(1) FROM snapshotrates r WHERE r.Snapshot_ID = s.ID) < @minRates