UPDATE snapshots AS s
INNER JOIN instruments AS oldInstrument
ON oldInstrument.ID = s.Instrument_ID
INNER JOIN instruments AS newInstrument
ON
	newInstrument.Source = oldInstrument.Source 
	AND newInstrument.InstrumentId = oldInstrument.InstrumentId
INNER JOIN userinstruments AS u
ON u.Instrument_ID = newInstrument.ID
SET s.Instrument_ID = newInstrument.ID
WHERE oldInstrument.ID <> newInstrument.ID