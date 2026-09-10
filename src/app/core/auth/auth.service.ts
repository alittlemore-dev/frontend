import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import {
  Observable,
  catchError,
  defer,
  finalize,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import { AuthTokenService } from './auth-token.service';
import { AuthSessionService } from './auth-session.service';
import { SKIP_AUTH_HEADER, SKIP_AUTH_REFRESH } from './auth-http-context';

const SESSION_PRESENCE_STORAGE_KEY = 'authSessionPresent';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  accessTokenExpiresInSeconds: number;
}

export type AccountRole = 'anon' | 'user' | 'moderator' | 'admin' | 'owner';

export interface AccountInfo {
  username: string;
  role: AccountRole;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiClient = inject(ApiClient);
  private readonly tokenService = inject(AuthTokenService);
  private readonly session = inject(AuthSessionService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private currentUserLoad$: Observable<void> | null = null;
  private accessTokenRefresh$: Observable<void> | null = null;
  private sessionRestore$: Observable<void> | null = null;
  private readonly restoringSession = signal(false);

  readonly currentUser = this.session.currentUser;
  readonly isOwner = this.session.isOwner;
  readonly isAdmin = this.session.isAdmin;
  readonly canManageContent = this.session.canManageContent;
  readonly canManageTeam = this.session.canManageTeam;
  readonly isLoggedIn = this.session.isLoggedIn;
  readonly isRestoringSession = this.restoringSession.asReadonly();

  login(username: string, password: string): Observable<void> {
    return this.apiClient
      .post<LoginResponse>('/api/auth/login', { username, password } satisfies LoginRequest, {
        context: new HttpContext().set(SKIP_AUTH_HEADER, true).set(SKIP_AUTH_REFRESH, true),
        withCredentials: true,
      })
      .pipe(
        tap((response) => this.storeAccessToken(response.accessToken)),
        switchMap(() => this.loadCurrentUser()),
      );
  }

  logout(): Observable<void> {
    return this.apiClient
      .post<void>(
        '/api/auth/logout',
        {},
        {
          context: new HttpContext().set(SKIP_AUTH_REFRESH, true),
          headers: { 'X-CSRF-Guard': '1' },
          withCredentials: true,
        },
      )
      .pipe(
        tap({
          next: () => this.clearLocalSession(),
          error: () => this.clearLocalSession(),
        }),
      );
  }

  refreshAccessToken(): Observable<void> {
    if (this.accessTokenRefresh$ !== null) {
      return this.accessTokenRefresh$;
    }
    this.accessTokenRefresh$ = this.apiClient
      .post<LoginResponse>(
        '/api/auth/refresh',
        {},
        {
          context: new HttpContext().set(SKIP_AUTH_HEADER, true).set(SKIP_AUTH_REFRESH, true),
          headers: { 'X-CSRF-Guard': '1' },
          withCredentials: true,
        },
      )
      .pipe(
        tap((response) => this.storeAccessToken(response.accessToken)),
        map(() => void 0),
        finalize(() => {
          this.accessTokenRefresh$ = null;
        }),
        shareReplay({ bufferSize: 1, refCount: true }),
      );
    return this.accessTokenRefresh$;
  }

  restoreSession(): Observable<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return of(void 0);
    }
    if (this.sessionRestore$ !== null) {
      return this.sessionRestore$;
    }
    this.sessionRestore$ = defer(() => {
      this.restoringSession.set(true);
      return this.refreshAccessToken().pipe(
        switchMap(() => this.loadCurrentUser()),
        catchError(() => {
          this.clearLocalSession();
          return of(void 0);
        }),
      );
    }).pipe(
      finalize(() => {
        this.sessionRestore$ = null;
        this.restoringSession.set(false);
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    return this.sessionRestore$;
  }

  clearLocalSession(): void {
    this.tokenService.clearToken();
    this.session.clear();
    const storage = this.storage();
    if (storage === null) return;
    try {
      storage.removeItem(SESSION_PRESENCE_STORAGE_KEY);
    } catch {
      return;
    }
  }

  hasKnownSession(): boolean {
    const storage = this.storage();
    if (storage === null) return false;
    try {
      return storage.getItem(SESSION_PRESENCE_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  ensureCurrentUserLoaded(): Observable<void> {
    if (this.currentUser() !== null) {
      return of(void 0);
    }
    if (this.sessionRestore$ !== null) {
      return this.sessionRestore$;
    }
    if (!this.tokenService.token()) {
      return this.restoreSession();
    }
    if (this.currentUserLoad$ !== null) {
      return this.currentUserLoad$;
    }
    this.currentUserLoad$ = defer(() => {
      this.restoringSession.set(true);
      return this.loadCurrentUser().pipe(
        catchError((error: unknown) => {
          this.clearLocalSession();
          return throwError(() => error);
        }),
      );
    }).pipe(
      finalize(() => {
        this.currentUserLoad$ = null;
        this.restoringSession.set(false);
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    return this.currentUserLoad$;
  }

  loadCurrentUser(): Observable<void> {
    return this.apiClient.get<AccountInfo>('/api/account/base').pipe(
      map((account) => {
        this.session.setCurrentUser(account);
      }),
    );
  }

  private storage(): Storage | null {
    try {
      return this.document.defaultView?.localStorage ?? null;
    } catch {
      return null;
    }
  }

  private storeAccessToken(accessToken: string): void {
    this.tokenService.setToken(accessToken);
    const storage = this.storage();
    if (storage === null) return;
    try {
      storage.setItem(SESSION_PRESENCE_STORAGE_KEY, 'true');
    } catch {
      return;
    }
  }
}
