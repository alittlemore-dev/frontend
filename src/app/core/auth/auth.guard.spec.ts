import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  ActivatedRouteSnapshot,
  GuardResult,
  MaybeAsync,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { provideRouter } from '@angular/router';
import { firstValueFrom, isObservable, of, throwError } from 'rxjs';
import {
  accountChildGuard,
  accountGuard,
  authGuard,
  ownerGuard,
  teamGuard,
  workspaceGuard,
  workspaceChildGuard,
} from './auth.guard';
import { AuthService } from './auth.service';
import { AuthTokenService } from './auth-token.service';
import { ApiClient } from '../http/api-client.service';
import { I18nService } from '../i18n/i18n.service';

describe('authGuard', () => {
  function mockAuthService(canManageContent: boolean): Partial<AuthService> {
    return {
      canManageContent: () => canManageContent,
      isLoggedIn: () => true,
      ensureCurrentUserLoaded: () => of(void 0),
      clearLocalSession: jest.fn(),
    };
  }

  function runGuard(canManageContent: boolean): MaybeAsync<GuardResult> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService(canManageContent) },
        { provide: I18nService, useValue: { language: signal('ru') } },
      ],
    });
    return TestBed.runInInjectionContext(() =>
      authGuard(
        {} as ActivatedRouteSnapshot,
        { url: '/admin-panel/articles' } as RouterStateSnapshot,
      ),
    );
  }

  async function resolveGuardResult(result: MaybeAsync<GuardResult>): Promise<GuardResult> {
    if (isObservable(result)) {
      return firstValueFrom(result);
    }
    return Promise.resolve(result);
  }

  afterEach(() => {
    localStorage.clear();
  });

  it('returns true when user can manage content', async () => {
    await expect(resolveGuardResult(runGuard(true))).resolves.toBe(true);
  });

  it('returns UrlTree redirect to the localized public home when user cannot manage content', async () => {
    const result = await resolveGuardResult(runGuard(false));
    expect(result instanceof UrlTree).toBe(true);
    expect((result as UrlTree).toString()).toBe('/ru/how-this-site-is-built');
  });

  it('redirects failed account restoration to login with the target URL', async () => {
    const clearLocalSession = jest.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            ensureCurrentUserLoaded: () => throwError(() => new Error('restore failed')),
            clearLocalSession,
          },
        },
        { provide: I18nService, useValue: { language: signal('ru') } },
      ],
    });

    const result = await resolveGuardResult(
      TestBed.runInInjectionContext(() =>
        authGuard(
          {} as ActivatedRouteSnapshot,
          { url: '/admin-panel/articles' } as RouterStateSnapshot,
        ),
      ),
    );

    expect(clearLocalSession).toHaveBeenCalledTimes(1);
    expect(result instanceof UrlTree).toBe(true);
    expect((result as UrlTree).toString()).toBe('/login?returnUrl=%2Fadmin-panel%2Farticles');
  });

  it('waits for in-memory token account restore before allowing admin-panel reload', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ApiClient,
        AuthService,
        { provide: I18nService, useValue: { language: signal('ru') } },
      ],
    });
    const httpMock = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthTokenService).setToken('existing-token');

    const result = TestBed.runInInjectionContext(() =>
      resolveGuardResult(
        authGuard(
          {} as ActivatedRouteSnapshot,
          { url: '/admin-panel/articles' } as RouterStateSnapshot,
        ),
      ),
    );
    const accountReq = httpMock.expectOne((req) => req.url.includes('/api/auth/account/me'));
    expect(accountReq.request.method).toBe('GET');
    accountReq.flush({ username: 'moderator', role: 'moderator' });

    await expect(result).resolves.toBe(true);
    httpMock.verify();
  });

  it('waits for session cookie restore before allowing admin-panel reload without an in-memory token', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ApiClient,
        AuthService,
        { provide: I18nService, useValue: { language: signal('ru') } },
      ],
    });
    const httpMock = TestBed.inject(HttpTestingController);

    const result = TestBed.runInInjectionContext(() =>
      resolveGuardResult(
        authGuard(
          {} as ActivatedRouteSnapshot,
          { url: '/admin-panel/articles' } as RouterStateSnapshot,
        ),
      ),
    );
    const refreshReq = httpMock.expectOne((req) => req.url.includes('/api/auth/refresh'));
    expect(refreshReq.request.method).toBe('POST');
    refreshReq.flush({ accessToken: 'restored-token', accessTokenExpiresInSeconds: 900 });

    const accountReq = httpMock.expectOne((req) => req.url.includes('/api/auth/account/me'));
    expect(accountReq.request.method).toBe('GET');
    accountReq.flush({ username: 'moderator', role: 'moderator' });

    await expect(result).resolves.toBe(true);
    httpMock.verify();
  });
});

describe('teamGuard', () => {
  function mockAuthService(canManageTeam: boolean): Partial<AuthService> {
    return {
      canManageTeam: () => canManageTeam,
      isLoggedIn: () => true,
      ensureCurrentUserLoaded: () => of(void 0),
      clearLocalSession: jest.fn(),
    };
  }

  function runGuard(canManageTeam: boolean): MaybeAsync<GuardResult> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService(canManageTeam) },
        { provide: I18nService, useValue: { language: signal('ru') } },
      ],
    });
    return TestBed.runInInjectionContext(() =>
      teamGuard({} as ActivatedRouteSnapshot, { url: '/admin-panel/team' } as RouterStateSnapshot),
    );
  }

  async function resolveGuardResult(result: MaybeAsync<GuardResult>): Promise<GuardResult> {
    if (isObservable(result)) {
      return firstValueFrom(result);
    }
    return Promise.resolve(result);
  }

  it('returns true when user can manage team', async () => {
    await expect(resolveGuardResult(runGuard(true))).resolves.toBe(true);
  });

  it('redirects non-team content managers away from team workspaces', async () => {
    const result = await resolveGuardResult(runGuard(false));

    expect(result instanceof UrlTree).toBe(true);
    expect((result as UrlTree).toString()).toBe('/admin-panel/articles');
  });

  it('redirects a failed team account restore to login', async () => {
    const clearLocalSession = jest.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            ensureCurrentUserLoaded: () => throwError(() => new Error('restore failed')),
            clearLocalSession,
          },
        },
        { provide: I18nService, useValue: { language: signal('ru') } },
      ],
    });

    const result = await resolveGuardResult(
      TestBed.runInInjectionContext(() =>
        teamGuard(
          {} as ActivatedRouteSnapshot,
          { url: '/admin-panel/team' } as RouterStateSnapshot,
        ),
      ),
    );

    expect(clearLocalSession).toHaveBeenCalledTimes(1);
    expect(result instanceof UrlTree).toBe(true);
    expect((result as UrlTree).toString()).toBe('/login?returnUrl=%2Fadmin-panel%2Fteam');
  });
});

describe('ownerGuard', () => {
  function runGuard(isOwner: boolean): MaybeAsync<GuardResult> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            isOwner: () => isOwner,
            isLoggedIn: () => true,
            ensureCurrentUserLoaded: () => of(void 0),
            clearLocalSession: jest.fn(),
          },
        },
        { provide: I18nService, useValue: { language: signal('ru') } },
      ],
    });
    return TestBed.runInInjectionContext(() =>
      ownerGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  }

  async function resolveGuardResult(result: MaybeAsync<GuardResult>): Promise<GuardResult> {
    if (isObservable(result)) return firstValueFrom(result);
    return Promise.resolve(result);
  }

  it('allows only the owner into agent access management', async () => {
    await expect(resolveGuardResult(runGuard(true))).resolves.toBe(true);

    const denied = await resolveGuardResult(runGuard(false));
    expect(denied instanceof UrlTree).toBe(true);
    expect((denied as UrlTree).toString()).toBe('/admin-panel/articles');
  });
});

describe('workspace access', () => {
  it.each([workspaceGuard, workspaceChildGuard])(
    'preserves anonymous deep links through login',
    async (guard) => {
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          {
            provide: AuthService,
            useValue: {
              ensureCurrentUserLoaded: () => of(void 0),
              isOwner: () => false,
              isLoggedIn: () => false,
            },
          },
          { provide: I18nService, useValue: { language: signal('ru') } },
        ],
      });
      const result = await firstValueFrom(
        TestBed.runInInjectionContext(() =>
          guard(
            {} as ActivatedRouteSnapshot,
            { url: '/personal-workspace/resumes/123?tab=edit' } as RouterStateSnapshot,
          ),
        ) as import('rxjs').Observable<GuardResult>,
      );
      expect((result as UrlTree).toString()).toBe(
        '/login?returnUrl=%2Fpersonal-workspace%2Fresumes%2F123%3Ftab%3Dedit',
      );
    },
  );
  it.each([
    ['owner', true],
    ['admin', false],
    ['user', false],
  ])('applies owner access to role %s', async (role, permitted) => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            ensureCurrentUserLoaded: () => of(void 0),
            isOwner: () => role === 'owner',
            isLoggedIn: () => true,
          },
        },
        { provide: I18nService, useValue: { language: signal('ru') } },
      ],
    });
    const result = await firstValueFrom(
      TestBed.runInInjectionContext(() =>
        workspaceGuard(
          {} as ActivatedRouteSnapshot,
          { url: '/personal-workspace' } as RouterStateSnapshot,
        ),
      ) as import('rxjs').Observable<GuardResult>,
    );
    expect(permitted ? result : (result as UrlTree).toString()).toBe(
      permitted ? true : '/ru/how-this-site-is-built',
    );
  });
});

describe('account access', () => {
  async function resolveAccountGuard(
    guard: typeof accountGuard | typeof accountChildGuard,
    loggedIn: boolean,
  ): Promise<GuardResult> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            ensureCurrentUserLoaded: () => of(void 0),
            isLoggedIn: () => loggedIn,
            clearLocalSession: jest.fn(),
          },
        },
      ],
    });
    return firstValueFrom(
      TestBed.runInInjectionContext(() =>
        guard({} as ActivatedRouteSnapshot, { url: '/account/me' } as RouterStateSnapshot),
      ) as import('rxjs').Observable<GuardResult>,
    );
  }

  it.each([accountGuard, accountChildGuard])('allows every authenticated role', async (guard) => {
    await expect(resolveAccountGuard(guard, true)).resolves.toBe(true);
  });

  it.each([accountGuard, accountChildGuard])(
    'preserves an anonymous account deep link',
    async (guard) => {
      const result = await resolveAccountGuard(guard, false);

      expect((result as UrlTree).toString()).toBe('/login?returnUrl=%2Faccount%2Fme');
    },
  );
});
