SELECT
	s.ID,
	s.Instrument_ID 
FROM
	snapshots s
WHERE 
	(SELECT COUNT(1) FROM snapshotrates r WHERE r.Snapshot_ID = s.ID) < @minRates
	AND (SELECT COUNT(1) FROM instrumentrates i WHERE i.Instrument_ID = s.Instrument_ID AND i.Time >= s.FirstPriceTime AND i.Time <= s.PriceTime) < @minRates