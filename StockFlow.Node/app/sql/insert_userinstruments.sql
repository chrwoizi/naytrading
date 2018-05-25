INSERT INTO userinstruments (User, Instrument_ID, createdAt, updatedAt) 
(
SELECT * 
FROM (
	SELECT 
		i.User, 
		(
			SELECT MIN(g.ID)
			FROM instruments AS g 
			WHERE
				g.Source = i.Source 
				AND g.InstrumentId = i.InstrumentId 
				AND g.MarketId = i.MarketId
		) AS Instrument_ID, 
		NOW() AS createdAt, 
		NOW() AS updatedAt 
	FROM instruments AS i 
	WHERE 
		i.User IS NOT NULL
) AS n
WHERE
	NOT EXISTS 
    (
		SELECT 1
        FROM userinstruments u
        WHERE u.User = n.User
        AND u.Instrument_ID = n.Instrument_ID
    )
)