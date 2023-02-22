import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  ListSnapshotsResponse,
  GetSnapshotResponse,
  DecideSnapshotResponse,
} from '../models/snapshot';

@Injectable({ providedIn: 'root' })
export class SnapshotService {
  constructor(private http: HttpClient) {}

  list(instrumentId) {
    if (typeof instrumentId !== 'undefined' && instrumentId !== null) {
      return this.http.get<ListSnapshotsResponse>(
        '/api/snapshots/' + instrumentId
      );
    } else {
      return this.http.get<ListSnapshotsResponse>('/api/snapshots');
    }
  }

  get(snapshotId) {
    return this.http.get<GetSnapshotResponse>('/api/snapshot/' + snapshotId);
  }

  create(arg) {
    return this.http.get<GetSnapshotResponse>('/api/snapshot/new/' + arg);
  }

  confirm(id, decision, confirmed) {
    return this.http.get<GetSnapshotResponse>(
      '/api/confirm/' + id + '/' + decision + '/' + confirmed
    );
  }

  decide(body) {
    return this.http.post<DecideSnapshotResponse>('/api/decision', body);
  }
}
