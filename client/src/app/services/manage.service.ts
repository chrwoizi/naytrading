import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { GetProcessingsResponse } from '../models/processings';

@Injectable({ providedIn: 'root' })
export class ManageService {
    constructor(private http: HttpClient) {
    }

    clearDecisions() {
        return this.http.post<any>('/api/clear/decisions', {});
    }

    removeWhitelist(username) {
        return this.http.post<any>('/api/whitelist/remove', { username: username });
    }

    getProcessings() {
        return this.http.get<GetProcessingsResponse>('/api/processings');
    }
}