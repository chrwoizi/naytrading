INSERT INTO sources (SourceType, SourceId, MarketId, Strikes, LastStrikeTime, Status, Instrument_ID, createdAt, updatedAt) 
(
SELECT * 
FROM (
	SELECT 
		i.Source AS SourceType, 
		i.InstrumentId AS SourceId,
		i.MarketId AS MarketId,
		i.Strikes AS Strikes,
		i.LastStrikeTime AS LastStrikeTime,
		'ACTIVE' AS Status, 
		i.ID AS Instrument_ID, 
		NOW() AS createdAt, 
		NOW() AS updatedAt 
	FROM instruments AS i
) AS n
WHERE
	NOT EXISTS 
    (
		SELECT 1
        FROM sources s
        WHERE s.SourceType = n.SourceType
        AND s.SourceId = n.SourceId
        AND s.Instrument_ID = n.Instrument_ID
    )
)