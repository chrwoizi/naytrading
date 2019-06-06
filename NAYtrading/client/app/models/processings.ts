export class ProcessingFileMetadata {
    time: string;
    days: number;
    max_missing_days: number;
    test_data_ratio: number;
    preserve_test_ids: string;
    augment_factor: number;
    lines: number;
    timeStr: string;
    dataRatioPercent: number;
}

export class Processings {
    hasProcessedData: boolean;
    buyingTrain: ProcessingFileMetadata;
    buyingTest: ProcessingFileMetadata;
    sellingTrain: ProcessingFileMetadata;
    sellingTest: ProcessingFileMetadata;
}

export class GetProcessingsResponse {
    processings: Processings;
}