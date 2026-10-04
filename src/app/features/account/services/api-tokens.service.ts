import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import { ApiPermission, ApiToken, ApiTokenCreate } from '../models/api-token.model';

const BASE = '/api/auth/account/me/api-tokens';
const MUTATION_OPTIONS = { headers: { 'X-CSRF-Guard': '1' } };

@Injectable({ providedIn: 'root' })
export class ApiTokensService {
  private readonly api = inject(ApiClient);

  permissions(): Observable<ApiPermission[]> {
    return this.api
      .get<{ permissions: ApiPermission[] }>(`${BASE}/permissions`)
      .pipe(map((response) => response.permissions));
  }

  list(): Observable<ApiToken[]> {
    return this.api.get<{ tokens: ApiToken[] }>(BASE).pipe(map((response) => response.tokens));
  }

  create(payload: ApiTokenCreate): Observable<ApiToken> {
    // Creation leaves the value masked; a later reveal always requires a new password confirmation.
    return this.api
      .post<{ token: ApiToken; secret: string }>(BASE, payload, MUTATION_OPTIONS)
      .pipe(map((response) => response.token));
  }

  reveal(id: string, password: string): Observable<string> {
    return this.api
      .post<{ secret: string }>(
        `${BASE}/${encodeURIComponent(id)}/reveal`,
        { password },
        MUTATION_OPTIONS,
      )
      .pipe(map((response) => response.secret));
  }

  revoke(id: string): Observable<ApiToken> {
    return this.api.post<ApiToken>(
      `${BASE}/${encodeURIComponent(id)}/revoke`,
      null,
      MUTATION_OPTIONS,
    );
  }
}
