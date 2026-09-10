import {
  ApplicationConfig,
  ErrorHandler,
  afterNextRender,
  inject,
  provideAppInitializer,
  provideZoneChangeDetection,
  InjectionToken,
  PLATFORM_ID,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpRequest, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  provideClientHydration,
  withEventReplay,
  withHttpTransferCacheOptions,
} from '@angular/platform-browser';
import {
  provideRouter,
  TitleStrategy,
  withComponentInputBinding,
  withInMemoryScrolling,
} from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { browserApiOriginInterceptor } from './core/interceptors/browser-api-origin.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { GlobalErrorHandler } from './core/error/global-error-handler';
import { I18nService } from './core/i18n/i18n.service';
import { of } from 'rxjs';
import { AuthService } from './core/auth/auth.service';
import { LocalizedTitleStrategy } from './core/seo/localized-title.strategy';

export const SKIP_I18N_STARTUP = new InjectionToken<boolean>('SKIP_I18N_STARTUP', {
  providedIn: 'root',
  factory: () => false,
});

export const SKIP_AUTH_STARTUP = new InjectionToken<boolean>('SKIP_AUTH_STARTUP', {
  providedIn: 'root',
  factory: () => false,
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }),
    ),
    provideClientHydration(
      withEventReplay(),
      withHttpTransferCacheOptions({ filter: shouldTransferCacheRequest }),
    ),
    provideHttpClient(
      withInterceptors([authInterceptor, errorInterceptor, browserApiOriginInterceptor]),
    ),
    provideAppInitializer(() => initializeAuth()),
    provideAppInitializer(() => initializeI18n()),
    { provide: TitleStrategy, useClass: LocalizedTitleStrategy },
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
  ],
};

function initializeAuth() {
  if (inject(SKIP_AUTH_STARTUP)) {
    return of(void 0);
  }
  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    return of(void 0);
  }
  const authService = inject(AuthService);
  const startupMode = authStartupMode(
    inject(DOCUMENT).location.pathname,
    authService.hasKnownSession(),
  );
  if (startupMode === 'blocking') {
    return authService.restoreSession();
  }
  if (startupMode === 'after-render') {
    afterNextRender({ read: () => authService.restoreSession().subscribe() });
  }
  return of(void 0);
}

function initializeI18n() {
  if (inject(SKIP_I18N_STARTUP)) {
    return of(void 0);
  }
  return inject(I18nService).initialize();
}

export function shouldTransferCacheRequest(req: HttpRequest<unknown>): boolean {
  if (req.method !== 'GET') return false;

  const pathname = readPathname(req.url);
  return (
    pathname.startsWith('/api/articles/detail/') ||
    pathname.startsWith('/api/competency-matrix/items/public/') ||
    pathname === '/api/articles/public-stats' ||
    pathname === '/api/articles/tags' ||
    pathname === '/api/articles/tree' ||
    pathname === '/api/articles'
  );
}

export type AuthStartupMode = 'skip' | 'after-render' | 'blocking';

export function authStartupMode(url: string, hasKnownSession: boolean): AuthStartupMode {
  const pathname = readPathname(url);
  if (pathname === '/admin-panel' || pathname.startsWith('/admin-panel/')) {
    return 'blocking';
  }
  return hasKnownSession ? 'after-render' : 'skip';
}

function readPathname(url: string): string {
  return new URL(url, 'http://localhost').pathname;
}
