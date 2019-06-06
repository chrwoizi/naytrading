export class Rate {
    T: string;
    C: number;
}

export class Snapshot {
    ID: number;
    Instrument: {
        ID?: number,
        InstrumentName: string
    };
    Date: string;
    DateSortable: string;
    Rates?: Rate[];
    PreviousDecision?: string;
    PreviousBuyRate?: number;
    PreviousTime?: string;
    ModifiedDateSortable?: string;
    Decision?: string;
    ConfirmDecision?: number;
    Confirmed?: number;
}

export class ListSnapshotsResponse {
    error: string;
    snapshots: Snapshot[];
}

export class GetSnapshotResponse {
    error: string;
    snapshot: Snapshot;
}

export class DecideSnapshotResponse {
    error: string;
    status: string;
}