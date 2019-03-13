SELECT 
	s.ID, 
	s.Instrument_ID 
FROM 
(
	SELECT 
		s.ID,
		s.Instrument_ID, 
		s.PriceTime,
		s.FirstPriceTime 
	FROM 
		snapshots s
) AS s 
WHERE 
	datediff(s.PriceTime, s.FirstPriceTime) < @minDays