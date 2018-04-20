SELECT 
    snapshot.ID AS SnapshotId,
    instrument.ID AS InstrumentId,
    instrument.InstrumentName AS InstrumentName,
    snapshot.Time AS Time,
    snapshot.Decision AS Decision
FROM 
    snapshots AS snapshot 
INNER JOIN 
    instruments AS instrument ON instrument.ID = snapshot.Instrument_ID
WHERE 
    snapshot.User = @userName
ORDER BY 
    snapshot.Time ASC