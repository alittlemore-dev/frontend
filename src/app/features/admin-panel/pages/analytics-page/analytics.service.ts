import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../../../core/http/api-client.service';
import { LanguageCode } from '../../../../core/i18n/i18n.model';
import { AnalyticsKind, AnalyticsReport } from './analytics.model';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly api = inject(ApiClient);

  report(
    kind: AnalyticsKind,
    dateFrom: string,
    dateTo: string,
    language: LanguageCode,
  ): Observable<AnalyticsReport> {
    return this.api.get<AnalyticsReport>('/api/admin/analytics/report', {
      kind,
      dateFrom,
      dateTo,
      language,
    });
  }
}
