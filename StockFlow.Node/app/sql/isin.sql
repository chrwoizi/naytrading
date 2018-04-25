SELECT
	i.ToId,
    MAX(i.FromId) AS FromId
FROM
(
	SELECT i.ID AS ToId, g.ID AS FromId
	FROM instruments i 
	INNER JOIN instruments g 
	ON g.ID <> i.ID 
	AND g.InstrumentId = i.InstrumentId 
	AND g.Source = i.Source 
	AND g.Isin IS NOT NULL 
	WHERE i.Isin IS NULL
) AS i
GROUP BY i.ToId;