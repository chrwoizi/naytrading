SELECT trade.Quantity 
FROM trades AS trade 
INNER JOIN snapshots AS snapshot ON snapshot.ID = trade.Snapshot_ID 
INNER JOIN snapshots AS refSnapshot ON refSnapshot.ID = @refSnapshotId
INNER JOIN usersnapshots AS userSnapshot ON userSnapshot.Snapshot_ID = snapshot.ID
WHERE snapshot.Instrument_ID = refSnapshot.Instrument_ID
AND snapshot.ID <> refSnapshot.ID
AND trade.Time <= @refTime
AND userSnapshot.Decision = 'buy'
ORDER BY trade.Time DESC
LIMIT 1