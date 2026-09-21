import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { ThemeService } from '@alittlemore.dev/design-system';
import {
  Observable,
  catchError,
  defer,
  filter,
  finalize,
  of,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import { I18nService } from '../i18n/i18n.service';
import { AccountInfo, AccountSettings } from './account.model';
import { AuthSessionService } from './auth-session.service';

@Injectable({ providedIn: 'root' })
export class AccountSettingsService {
  private readonly api = inject(ApiClient);
  private readonly session = inject(AuthSessionService);
  private readonly i18n = inject(I18nService);
  private readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly routeVersion = signal(0);
  private readonly retryVersion = signal(0);
  private mutationVersion = 0;
  readonly saving = signal(false);
  readonly applicationFailed = signal(false);
  readonly settings = computed(() => this.session.currentUser()?.settings ?? null);

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.routeVersion.update((value) => value + 1);
      });
    toObservable(
      computed(() => ({
        settings: this.settings(),
        route: this.routeVersion(),
        retry: this.retryVersion(),
      })),
    )
      .pipe(
        switchMap(({ settings }) => {
          this.applicationFailed.set(false);
          if (!settings) return of(void 0);
          this.theme.setTheme(settings.theme);
          this.i18n.persistLanguage(settings.language);
          const prefix = this.router.url.split(/[/?#]/)[1];
          const language = prefix === 'ru' || prefix === 'en' ? prefix : settings.language;
          return this.i18n.switchLanguage(language, false).pipe(
            catchError(() => {
              this.applicationFailed.set(true);
              return of(void 0);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  load(): Observable<AccountInfo> {
    return defer(() => {
      const generation = this.session.generation();
      const version = this.mutationVersion;
      return this.api.get<AccountInfo>('/api/auth/account/me').pipe(
        filter(() => generation === this.session.generation()),
        tap((account) => {
          if (version === this.mutationVersion && !this.saving())
            this.session.setCurrentUser(account);
        }),
      );
    });
  }

  update(settings: AccountSettings): Observable<AccountInfo> {
    return defer(() => {
      if (this.saving()) return throwError(() => new Error('Settings save already in progress'));
      const generation = this.session.generation();
      this.mutationVersion += 1;
      this.saving.set(true);
      return this.api.put<AccountInfo>('/api/auth/account/me/settings', settings).pipe(
        filter(() => generation === this.session.generation()),
        tap((account) => {
          this.mutationVersion += 1;
          this.session.setCurrentUser(account);
        }),
        finalize(() => this.saving.set(false)),
      );
    });
  }

  retryApplication(): void {
    this.retryVersion.update((value) => value + 1);
  }
}
