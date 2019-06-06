export class Instrument {
    ID: number;
    InstrumentName: string;
    Capitalization: number;
}

export class ListInstrumentsResponse {
    error: string;
    instruments: Instrument[];
}