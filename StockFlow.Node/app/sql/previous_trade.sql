SELECT trade.Quantity 
FROM trades AS trade 
INNER JOIN snapshots AS snapshot ON snapshot.ID = trade.Snapshot_ID 
INNER JOIN snapshots AS refSnapshot ON refSnapshot.ID = @refSnapshotId
WHERE snapshot.Instrument_ID = refSnapshot.Instrument_ID
AND trade.Quantity >= 0
AND trade.Time <= @refTime
ORDER BY trade.Time DESC
LIMIT 1