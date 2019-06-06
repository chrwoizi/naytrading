import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ListSuggestionsResponse, GetSuggestionResponse } from '../models/suggestion';

@Injectable({ providedIn: 'root' })
export class SuggestionService {
    constructor(private http: HttpClient) {
    }

    list() {
        return this.http.get<ListSuggestionsResponse>('/api/suggestions');
    }

    get(id) {
        return this.http.get<GetSuggestionResponse>('/api/suggestion/' + id);
    }
}