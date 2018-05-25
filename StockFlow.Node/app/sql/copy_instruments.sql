INSERT INTO userinstruments
(
    User,
    Instrument_ID,
    createdAt,
    updatedAt
)
SELECT
    @userName AS User,
    i.ID AS Instrument_ID,
    NOW() AS createdAt,
    NOW() AS updatedAt
FROM instruments AS i
WHERE NOT EXISTS 
(
	SELECT 1 
	FROM userinstruments AS existing 
	WHERE existing.User = @userName
	AND existing.Instrument_ID = i.ID
);