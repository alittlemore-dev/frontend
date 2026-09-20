import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, switchMap } from 'rxjs';
import { AccountAvatarService } from '../../../core/auth/account-avatar.service';
import { AccountGender, AccountInfo } from '../../../core/auth/account.model';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import { ApiClient } from '../../../core/http/api-client.service';

export interface AccountProfilePatch {
  firstName?: string | null;
  lastName?: string | null;
  middleName?: string | null;
  gender?: AccountGender | null;
}

@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly apiClient = inject(ApiClient);
  private readonly session = inject(AuthSessionService);
  private readonly avatar = inject(AccountAvatarService);

  ensureLoaded(): Observable<AccountInfo> {
    const account = this.session.currentUser();
    if (account !== null) return of(account);
    return this.apiClient
      .get<AccountInfo>('/api/auth/account/me')
      .pipe(switchMap((loaded) => this.storeAndSynchronize(loaded)));
  }

  updateProfile(patch: AccountProfilePatch): Observable<AccountInfo> {
    return this.apiClient
      .patch<AccountInfo>('/api/auth/account/me', patch)
      .pipe(switchMap((account) => this.storeAndSynchronize(account)));
  }

  replaceAvatar(file: File): Observable<AccountInfo> {
    const form = new FormData();
    form.append('file', file);
    return this.apiClient
      .put<AccountInfo>('/api/auth/account/me/avatar', form)
      .pipe(switchMap((account) => this.storeAndSynchronize(account)));
  }

  removeAvatar(): Observable<AccountInfo> {
    return this.apiClient.delete<AccountInfo>('/api/auth/account/me/avatar').pipe(
      map((account) => {
        this.session.setCurrentUser(account);
        this.avatar.clear();
        return account;
      }),
    );
  }

  private storeAndSynchronize(account: AccountInfo): Observable<AccountInfo> {
    this.session.setCurrentUser(account);
    if (!account.hasAvatar) {
      this.avatar.clear();
      return of(account);
    }
    return this.avatar.loadFor(account).pipe(
      map(() => account),
      catchError(() => of(account)),
    );
  }
}
