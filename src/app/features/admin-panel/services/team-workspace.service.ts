import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import {
  ManagedAccount,
  ManagedAccountCreatePayload,
  ManagedAccountDto,
  EditableManagedAccountRole,
  ManagedAccountListParams,
  ManagedAccountSessionRevocation,
  ManagedAccountSessionRevocationDto,
  ManagedAccountSessions,
  ManagedAccountSessionsDto,
  ManagedAccounts,
  ManagedAccountsDto,
  mapManagedAccountDto,
  mapManagedAccountSessionRevocationDto,
  mapManagedAccountSessionsDto,
  mapManagedAccountsDto,
} from '../models/team-workspace.model';

@Injectable({ providedIn: 'root' })
export class TeamWorkspaceService {
  private readonly api = inject(ApiClient);

  listAccounts(params: ManagedAccountListParams): Observable<ManagedAccounts> {
    return this.api
      .get<ManagedAccountsDto>('/api/admin/accounts', {
        page: String(params.page),
        pageSize: String(params.pageSize),
      })
      .pipe(map(mapManagedAccountsDto));
  }

  getAccount(username: string): Observable<ManagedAccount> {
    return this.api
      .get<ManagedAccountDto>(`/api/admin/accounts/${encodeURIComponent(username)}`)
      .pipe(map(mapManagedAccountDto));
  }

  createAccount(payload: ManagedAccountCreatePayload): Observable<ManagedAccount> {
    return this.api
      .post<ManagedAccountDto>('/api/admin/accounts', payload)
      .pipe(map(mapManagedAccountDto));
  }

  updateAccountRole(
    username: string,
    role: EditableManagedAccountRole,
  ): Observable<ManagedAccount> {
    return this.api
      .put<ManagedAccountDto>(`/api/admin/accounts/${encodeURIComponent(username)}/role`, {
        role,
      })
      .pipe(map(mapManagedAccountDto));
  }

  updateAccountPassword(username: string, password: string): Observable<ManagedAccount> {
    return this.api
      .put<ManagedAccountDto>(`/api/admin/accounts/${encodeURIComponent(username)}/password`, {
        password,
      })
      .pipe(map(mapManagedAccountDto));
  }

  activateAccount(username: string): Observable<ManagedAccount> {
    return this.api
      .post<ManagedAccountDto>(`/api/admin/accounts/${encodeURIComponent(username)}/activate`, {})
      .pipe(map(mapManagedAccountDto));
  }

  deactivateAccount(username: string): Observable<ManagedAccount> {
    return this.api
      .post<ManagedAccountDto>(`/api/admin/accounts/${encodeURIComponent(username)}/deactivate`, {})
      .pipe(map(mapManagedAccountDto));
  }

  deleteAccount(username: string): Observable<void> {
    return this.api.delete<void>(`/api/admin/accounts/${encodeURIComponent(username)}`);
  }

  listAccountSessions(username: string): Observable<ManagedAccountSessions> {
    return this.api
      .get<ManagedAccountSessionsDto>(
        `/api/admin/accounts/${encodeURIComponent(username)}/sessions`,
      )
      .pipe(map(mapManagedAccountSessionsDto));
  }

  revokeAccountSession(
    username: string,
    sessionId: string,
  ): Observable<ManagedAccountSessionRevocation> {
    return this.api
      .post<ManagedAccountSessionRevocationDto>(
        `/api/admin/accounts/${encodeURIComponent(username)}/sessions/${encodeURIComponent(
          sessionId,
        )}/revoke`,
        {},
      )
      .pipe(map(mapManagedAccountSessionRevocationDto));
  }

  revokeAllAccountSessions(username: string): Observable<ManagedAccountSessionRevocation> {
    return this.api
      .post<ManagedAccountSessionRevocationDto>(
        `/api/admin/accounts/${encodeURIComponent(username)}/sessions/revoke-all`,
        {},
      )
      .pipe(map(mapManagedAccountSessionRevocationDto));
  }

  revokeOtherAccountSessions(username: string): Observable<ManagedAccountSessionRevocation> {
    return this.api
      .post<ManagedAccountSessionRevocationDto>(
        `/api/admin/accounts/${encodeURIComponent(username)}/sessions/revoke-others`,
        {},
      )
      .pipe(map(mapManagedAccountSessionRevocationDto));
  }
}
