import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
  GetSuggestionResponse,
  ListSuggestionsResponse,
} from '../models/suggestion';

@Injectable({ providedIn: 'root' })
export class SuggestionService {
  constructor(private http: HttpClient) {}

  list() {
    return this.http.get<ListSuggestionsResponse>('/api/suggestions');
  }

  get(id) {
    return this.http.get<GetSuggestionResponse>('/api/suggestion/' + id);
  }
}
