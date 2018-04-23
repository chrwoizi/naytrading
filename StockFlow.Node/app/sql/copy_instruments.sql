INSERT INTO instruments
(
	Source,
    InstrumentName,
    InstrumentId,
    MarketId,
    Capitalization,
    User,
    Strikes,
    Isin,
    Wkn,
    LastStrikeTime,
    createdAt,
    updatedAt
)
SELECT
	Source,
    InstrumentName,
    InstrumentId,
    MarketId,
    Capitalization,
    @userName AS User,
    0 AS Strikes,
    Isin,
    Wkn,
    NOW() AS LastStrikeTime,
    NOW() AS createdAt,
    NOW() AS updatedAt
FROM instruments AS global 
WHERE global.User IS NULL
AND NOT EXISTS 
(
	SELECT 1 
	FROM instruments AS existing 
	WHERE existing.User = @userName
	AND existing.Source = global.Source 
	AND existing.InstrumentId = global.InstrumentId
);