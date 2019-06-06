export class Sale {
    D: string;
    DS: string;
    S: string;
    R: number;
    I: string;
    C: number;
}

export class StatsResponse {
    error: string;
    Users: string[];
    stats: {
        Value: number;
        Deposit: number;
        ValueHistory: {
            Time: string;
            Return: number;
        }[],
        OpenCount: number;
        CompleteCount: number;
        Sales: Sale[];
    };
}