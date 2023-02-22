export class SuggestionListItem {
  id!: number;
  T!: string;
  TS!: string;
  I!: string;
  A!: string;
  P!: number;
  S!: string;
}

export class SuggestionLog {
  ID!: number;
  Snapshot_ID!: number;
  User!: string;
  Time!: string;
  Quantity!: number;
  Price!: number;
  Status!: string;
  Message!: string;
  createdAt!: string;
  updatedAt!: string;
  showMessage!: boolean;
}

export class Suggestion {
  ID!: number;
  Time!: string;
  InstrumentName!: string;
  Isin!: string;
  Wkn!: string;
  Action!: string;
  Price!: number;
  Status!: string;
  logs!: SuggestionLog[];
}

export class SuggestionViewModel {
  id!: number;
  T!: string;
  TS!: string;
  I!: string;
  A!: string;
  P!: number;
  S!: 'p' | 'i' | 't' | 'f' | 'c';
}

export class ListSuggestionsResponse {
  error!: string;
  suggestions!: SuggestionListItem[];
}

export class GetSuggestionResponse {
  error!: string;
  suggestion!: Suggestion;
}
