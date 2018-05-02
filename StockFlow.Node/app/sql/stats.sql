SELECT
	trade.ID,
	trade.Time,
	trade.Price,
	trade.Quantity,
	snapshot.Decision,
    instrument.ID AS InstrumentId,
    instrument.InstrumentName
FROM trades AS trade
INNER JOIN snapshots AS snapshot ON snapshot.ID = trade.Snapshot_ID
INNER JOIN instruments AS instrument ON instrument.ID = snapshot.Instrument_ID
WHERE trade.User = @userName
ORDER BY trade.Time ASC;