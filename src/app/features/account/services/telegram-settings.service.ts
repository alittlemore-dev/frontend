import { Injectable, inject } from '@angular/core';
import { defer, map, Observable, throwError } from 'rxjs';
import { AccountSettingsService } from '../../../core/auth/account-settings.service';
import { ApiClient } from '../../../core/http/api-client.service';

export interface TelegramInvitation {
  id: string;
  label: string;
  expiresAt: string;
}

export interface TelegramConnection {
  id: string;
  label: string;
  telegramUserId: number;
  username: string;
  firstName: string;
  state: 'pending' | 'active' | 'revoked' | 'blocked';
  requestedAt: string;
  connectedAt: string | null;
  lastContactAt: string;
}

export interface TelegramSettings {
  available: boolean;
  enabled: boolean;
  invitations: TelegramInvitation[];
  connections: TelegramConnection[];
}

export interface IssuedTelegramInvitation {
  url: string;
  expiresAt: string;
}

export type TelegramConnectionAction = 'approve' | 'revoke' | 'block' | 'unblock';

@Injectable({ providedIn: 'root' })
export class TelegramSettingsService {
  private readonly api = inject(ApiClient);
  private readonly preferences = inject(AccountSettingsService);
  private readonly workspaceBase = '/api/personal-workspace/telegram';

  load(): Observable<TelegramSettings> {
    return defer(() => {
      const settings = this.preferences.settings();
      if (!settings) return throwError(() => new Error('Account settings are unavailable'));
      return this.api
        .get<Pick<TelegramSettings, 'available' | 'invitations' | 'connections'>>(
          this.workspaceBase,
        )
        .pipe(
          map((workspace) => ({
            ...workspace,
            enabled: settings.telegramBots['personal-workspace']?.enabled ?? false,
          })),
        );
    });
  }

  setEnabled(enabled: boolean): Observable<{ enabled: boolean }> {
    return defer(() => {
      const settings = this.preferences.settings();
      if (!settings) return throwError(() => new Error('Account settings are unavailable'));
      return this.preferences
        .update({
          ...settings,
          telegramBots: {
            ...settings.telegramBots,
            'personal-workspace': { enabled },
          },
        })
        .pipe(
          map((account) => ({
            enabled: account.settings.telegramBots['personal-workspace']?.enabled ?? false,
          })),
        );
    });
  }

  createInvitation(label: string): Observable<IssuedTelegramInvitation> {
    return this.api.post<IssuedTelegramInvitation>(`${this.workspaceBase}/invitations`, { label });
  }

  cancelInvitation(id: string): Observable<void> {
    return this.api.delete<void>(`${this.workspaceBase}/invitations/${encodeURIComponent(id)}`);
  }

  changeState(id: string, action: TelegramConnectionAction): Observable<TelegramConnection> {
    return this.api.post<TelegramConnection>(
      `${this.workspaceBase}/connections/${encodeURIComponent(id)}/${action}`,
      {},
    );
  }

  rename(id: string, label: string): Observable<TelegramConnection> {
    return this.api.put<TelegramConnection>(
      `${this.workspaceBase}/connections/${encodeURIComponent(id)}/label`,
      { label },
    );
  }
}
