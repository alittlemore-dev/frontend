import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiClient } from '../../../../core/http/api-client.service';
import {
  AssetGoal,
  AssetGoalDraft,
  AssetLocation,
  AssetMovement,
  AssetMovementDraft,
  AssetOpeningPreview,
  AssetOpeningPreviewRequest,
  AssetRevision,
  AssetPositionDraft,
  AssetReport,
  AssetValuation,
} from '../models/finance-assets.model';
import { FinanceCurrency } from '../models/finance.model';

const BASE = '/api/personal-workspace/finance/assets';
@Injectable({ providedIn: 'root' })
export class FinanceAssetsService {
  private readonly api = inject(ApiClient);
  locations(): Observable<AssetLocation[]> {
    return this.api.get<{ items: AssetLocation[] }>(BASE + '/locations').pipe(map((r) => r.items));
  }
  positions(asOf: string, currency: FinanceCurrency): Observable<AssetValuation> {
    return this.api.get<AssetValuation>(BASE + '/positions', { asOf, currency });
  }
  movements(start: string, end: string): Observable<AssetMovement[]> {
    return this.api
      .get<{ items: AssetMovement[] }>(BASE + '/movements', { start, end })
      .pipe(map((r) => r.items));
  }
  revisions(id: string): Observable<AssetRevision[]> {
    return this.api
      .get<{ items: AssetRevision[] }>(BASE + '/movements/' + encodeURIComponent(id) + '/revisions')
      .pipe(map((result) => result.items));
  }
  report(start: string, end: string, currency: FinanceCurrency): Observable<AssetReport> {
    return this.api.get<AssetReport>(BASE + '/report', { start, end, currency });
  }
  goal(month: string): Observable<AssetGoal | null> {
    return this.api
      .get<{ goal: AssetGoal | null }>(BASE + '/goals', { month })
      .pipe(map((r) => r.goal));
  }
  saveGoal(month: string, draft: AssetGoalDraft): Observable<unknown> {
    return this.api.put(BASE + '/goals/' + month, draft);
  }
  saveLocation(id: string | null, name: string): Observable<AssetLocation> {
    return this.saveMetadata<AssetLocation>('locations', id, { name });
  }
  savePosition(id: string | null, draft: AssetPositionDraft): Observable<unknown> {
    return this.saveMetadata('positions', id, draft);
  }
  quickPosition(
    requestId: string,
    position: AssetPositionDraft,
    onDate: string,
    amount: string | null,
    defaultLocationName: string,
  ): Observable<AssetPositionDraft & { id: string }> {
    return this.api.post(BASE + '/positions/overview', {
      requestId,
      position,
      onDate,
      amount,
      defaultLocationName,
    });
  }
  archivePosition(id: string, archived: boolean): Observable<unknown> {
    return this.api.patch(BASE + '/positions/' + encodeURIComponent(id) + '/archive', { archived });
  }
  deletePosition(id: string): Observable<void> {
    return this.api.delete<void>(BASE + '/positions/' + encodeURIComponent(id));
  }
  private saveMetadata<T>(path: string, id: string | null, draft: unknown): Observable<T> {
    return id
      ? this.api.patch<T>(BASE + '/' + path + '/' + encodeURIComponent(id), draft)
      : this.api.post<T>(BASE + '/' + path, draft);
  }
  openingPreview(request: AssetOpeningPreviewRequest): Observable<AssetOpeningPreview> {
    return this.api.post<AssetOpeningPreview>(BASE + '/opening-preview', request);
  }
  createMovement(requestId: string, draft: AssetMovementDraft): Observable<AssetMovement> {
    return this.api.post<AssetMovement>(BASE + '/movements', { ...draft, requestId });
  }
  updateMovement(row: AssetMovement, draft: AssetMovementDraft): Observable<AssetMovement> {
    return this.api.patch<AssetMovement>(BASE + '/movements/' + encodeURIComponent(row.id), {
      ...draft,
      version: row.version,
    });
  }
  toggleDeleted(row: AssetMovement): Observable<AssetMovement> {
    const path = BASE + '/movements/' + encodeURIComponent(row.id);
    return row.deleted
      ? this.api.post<AssetMovement>(path + '/restore', { version: row.version })
      : this.api.delete<AssetMovement>(path, { version: String(row.version) });
  }
}
