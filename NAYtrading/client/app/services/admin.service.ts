import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Providers } from '../models/providers';

@Injectable({ providedIn: 'root' })
export class AdminService {
    constructor(private http: HttpClient) {
    }

    getProviders() {
        return this.http.get<Providers>('/api/providers');
    }

    reloadConfig() {
        return this.http.post<any>('/api/config/reload', {});
    }

    clearStats() {
        return this.http.post<any>('/api/clear/stats', {});
    }

    refreshRates(id, source, market) {
        return this.http.post<any>('/api/snapshot/refresh', { id: id, source: source, market: market });
    }

    addInstrument(url) {
        return this.http.post<any>('/api/instruments/add/url', { url: url });
    }

    updateInstruments() {
        return this.http.post<any>('/api/instruments/update', {});
    }
}