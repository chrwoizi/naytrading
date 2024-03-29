import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ListInstrumentsResponse } from '../models/instrument';

@Injectable({ providedIn: 'root' })
export class InstrumentService {
  constructor(private http: HttpClient) {}

  list() {
    return this.http.get<ListInstrumentsResponse>('/api/instruments');
  }
}
