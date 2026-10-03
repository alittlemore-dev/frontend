import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import { VaultRecent, VaultStatistics } from '../models/vault.model';

@Injectable({ providedIn: 'root' })
export class VaultService {
  private readonly api = inject(ApiClient);

  recent(): Observable<VaultRecent> {
    return this.api.get<VaultRecent>('/api/personal-workspace/vault/recent');
  }

  statistics(): Observable<VaultStatistics> {
    return this.api.get<VaultStatistics>('/api/personal-workspace/vault/statistics');
  }
}
