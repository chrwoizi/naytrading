import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class MonitorService {
    constructor(private http: HttpClient) {
    }

    get() {
        return this.http.get<any>('/api/monitor');
    }
}