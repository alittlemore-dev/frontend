import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import { HealthcheckOverview, mapHealthcheckOverview } from '../models/healthcheck.model';

@Injectable({ providedIn: 'root' })
export class HealthcheckService {
  private readonly api = inject(ApiClient);

  getHealthcheck(): Observable<HealthcheckOverview> {
    return this.api.get<unknown>('/api/infra/healthcheck').pipe(map(mapHealthcheckOverview));
  }
}
