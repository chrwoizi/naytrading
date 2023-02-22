import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { StatsResponse } from '../models/stats';

@Injectable({ providedIn: 'root' })
export class StatsService {
  constructor(private http: HttpClient) {}

  get(user) {
    if (typeof user !== 'undefined') {
      return this.http.get<StatsResponse>('/api/stats/' + user);
    } else {
      return this.http.get<StatsResponse>('/api/stats');
    }
  }
}
