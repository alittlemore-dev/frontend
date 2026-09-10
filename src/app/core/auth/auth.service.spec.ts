import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AuthService, AccountInfo } from './auth.service';
import { AuthTokenService } from './auth-token.service';
import { ApiClient } from '../http/api-client.service';
import { SKIP_AUTH_HEADER, SKIP_AUTH_REFRESH } from './auth-http-context';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let tokenService: AuthTokenService;

  function setup(): void {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ApiClient, AuthService],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    tokenService = TestBed.inject(AuthTokenService);
  }

  beforeEach(() => setup());

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  describe('login', () => {
    it('stores token and loads user', () => {
      const mockAccount: AccountInfo = { username: 'moderator', role: 'moderator' };

      service.login('admin', 'secret').subscribe();

      const loginReq = httpMock.expectOne((req) => req.url.includes('/api/auth/login'));
      expect(loginReq.request.method).toBe('POST');
      expect(loginReq.request.withCredentials).toBe(true);
      loginReq.flush({ accessToken: 'new-token', accessTokenExpiresInSeconds: 900 });

      const accountReq = httpMock.expectOne((req) => req.url.includes('/api/account/base'));
      expect(accountReq.request.method).toBe('GET');
      accountReq.flush(mockAccount);

      expect(tokenService.token()).toBe('new-token');
      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(localStorage.getItem('authSessionPresent')).toBe('true');
      expect(service.currentUser()).toEqual(mockAccount);
      expect(service.isLoggedIn()).toBe(true);
      expect(service.canManageContent()).toBe(true);
      expect(service.canManageTeam()).toBe(false);
    });
  });

  describe('refreshAccessToken', () => {
    it('refreshes the in-memory access token from the session cookie', () => {
      service.refreshAccessToken().subscribe();

      const refreshReq = httpMock.expectOne((req) => req.url.includes('/api/auth/refresh'));
      expect(refreshReq.request.method).toBe('POST');
      expect(refreshReq.request.withCredentials).toBe(true);
      expect(refreshReq.request.headers.get('X-CSRF-Guard')).toBe('1');
      expect(refreshReq.request.context.get(SKIP_AUTH_REFRESH)).toBe(true);
      expect(refreshReq.request.context.get(SKIP_AUTH_HEADER)).toBe(true);
      refreshReq.flush({ accessToken: 'fresh-token', accessTokenExpiresInSeconds: 900 });

      expect(tokenService.token()).toBe('fresh-token');
      expect(localStorage.getItem('authSessionPresent')).toBe('true');
    });

    it('shares a concurrent refresh request', () => {
      let completions = 0;

      service.refreshAccessToken().subscribe(() => {
        completions += 1;
      });
      service.refreshAccessToken().subscribe(() => {
        completions += 1;
      });

      const refreshRequests = httpMock.match((req) => req.url.includes('/api/auth/refresh'));
      expect(refreshRequests).toHaveLength(1);
      refreshRequests[0].flush({ accessToken: 'shared-token', accessTokenExpiresInSeconds: 900 });

      expect(completions).toBe(2);
      expect(tokenService.token()).toBe('shared-token');
    });
  });

  describe('restoreSession', () => {
    it('restores auth state from refresh and current account on startup', () => {
      const mockAccount: AccountInfo = { username: 'owner', role: 'owner' };
      let completed = false;

      service.restoreSession().subscribe(() => {
        completed = true;
      });

      const refreshReq = httpMock.expectOne((req) => req.url.includes('/api/auth/refresh'));
      refreshReq.flush({ accessToken: 'startup-token', accessTokenExpiresInSeconds: 900 });

      const accountReq = httpMock.expectOne((req) => req.url.includes('/api/account/base'));
      accountReq.flush(mockAccount);

      expect(completed).toBe(true);
      expect(tokenService.token()).toBe('startup-token');
      expect(service.currentUser()).toEqual(mockAccount);
      expect(service.canManageContent()).toBe(true);
      expect(service.canManageTeam()).toBe(true);
    });

    it('shares the complete concurrent session restore', () => {
      const mockAccount: AccountInfo = { username: 'owner', role: 'owner' };
      let completions = 0;

      service.restoreSession().subscribe(() => {
        completions += 1;
      });
      service.restoreSession().subscribe(() => {
        completions += 1;
      });

      const refreshRequests = httpMock.match((req) => req.url.includes('/api/auth/refresh'));
      expect(refreshRequests).toHaveLength(1);
      refreshRequests[0].flush({
        accessToken: 'shared-session-token',
        accessTokenExpiresInSeconds: 900,
      });

      const accountRequests = httpMock.match((req) => req.url.includes('/api/account/base'));
      expect(accountRequests).toHaveLength(1);
      accountRequests[0].flush(mockAccount);

      expect(completions).toBe(2);
      expect(service.currentUser()).toEqual(mockAccount);
    });

    it('reuses the active restore after refresh has returned but account loading is pending', () => {
      const mockAccount: AccountInfo = { username: 'owner', role: 'owner' };
      let completions = 0;

      service.restoreSession().subscribe(() => {
        completions += 1;
      });
      expect(service.isRestoringSession()).toBe(true);

      httpMock
        .expectOne((req) => req.url.includes('/api/auth/refresh'))
        .flush({ accessToken: 'restored-token', accessTokenExpiresInSeconds: 900 });

      service.ensureCurrentUserLoaded().subscribe(() => {
        completions += 1;
      });

      const accountRequests = httpMock.match((req) => req.url.includes('/api/account/base'));
      expect(accountRequests).toHaveLength(1);
      accountRequests[0].flush(mockAccount);

      expect(completions).toBe(2);
      expect(service.isRestoringSession()).toBe(false);
    });

    it('clears local state and completes when startup refresh is rejected', () => {
      tokenService.setToken('stale-token');
      service.currentUser.set({ username: 'admin', role: 'admin' });
      let completed = false;

      service.restoreSession().subscribe(() => {
        completed = true;
      });

      const refreshReq = httpMock.expectOne((req) => req.url.includes('/api/auth/refresh'));
      refreshReq.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

      expect(completed).toBe(true);
      expect(tokenService.token()).toBeNull();
      expect(service.currentUser()).toBeNull();
      httpMock.expectNone((req) => req.url.includes('/api/account/base'));
    });
  });

  describe('logout', () => {
    it('clears token and user', () => {
      service.currentUser.set({ username: 'admin', role: 'admin' });
      tokenService.setToken('some-token');

      service.logout().subscribe();

      const logoutReq = httpMock.expectOne((req) => req.url.includes('/api/auth/logout'));
      expect(logoutReq.request.method).toBe('POST');
      expect(logoutReq.request.withCredentials).toBe(true);
      expect(logoutReq.request.headers.get('X-CSRF-Guard')).toBe('1');
      expect(logoutReq.request.context.get(SKIP_AUTH_REFRESH)).toBe(true);
      logoutReq.flush(null);

      expect(tokenService.token()).toBeNull();
      expect(service.currentUser()).toBeNull();
      expect(service.isLoggedIn()).toBe(false);
    });

    it('clears token and user when logout request fails', (done) => {
      service.currentUser.set({ username: 'admin', role: 'admin' });
      tokenService.setToken('some-token');

      service.logout().subscribe({
        next: () => {
          done.fail('Expected logout request to fail');
        },
        error: () => {
          expect(tokenService.token()).toBeNull();
          expect(service.currentUser()).toBeNull();
          expect(service.isLoggedIn()).toBe(false);
          done();
        },
      });

      const logoutReq = httpMock.expectOne((req) => req.url.includes('/api/auth/logout'));
      expect(logoutReq.request.headers.get('X-CSRF-Guard')).toBe('1');
      logoutReq.flush(
        { message: 'Logout failed' },
        { status: 500, statusText: 'Internal Server Error' },
      );
    });
  });

  describe('clearLocalSession', () => {
    it('removes the persisted session presence marker', () => {
      localStorage.setItem('authSessionPresent', 'true');

      service.clearLocalSession();

      expect(localStorage.getItem('authSessionPresent')).toBeNull();
    });
  });

  describe('hasKnownSession', () => {
    it('reports no known session when the marker is absent', () => {
      expect(service.hasKnownSession()).toBe(false);
    });

    it('reports a persisted session presence marker', () => {
      localStorage.setItem('authSessionPresent', 'true');

      expect(service.hasKnownSession()).toBe(true);
    });
  });

  describe('loadCurrentUser', () => {
    it('populates currentUser signal', () => {
      const mockAccount: AccountInfo = { username: 'moderator', role: 'moderator' };

      service.loadCurrentUser().subscribe();

      const req = httpMock.expectOne((r) => r.url.includes('/api/account/base'));
      req.flush(mockAccount);

      expect(service.currentUser()).toEqual(mockAccount);
      expect(service.isLoggedIn()).toBe(true);
      expect(service.canManageContent()).toBe(true);
      expect(service.canManageTeam()).toBe(false);
    });
  });

  describe('ensureCurrentUserLoaded', () => {
    it('restores current user from the session cookie when there is no in-memory token', () => {
      const mockAccount: AccountInfo = { username: 'moderator', role: 'moderator' };
      let completed = false;

      service.ensureCurrentUserLoaded().subscribe(() => {
        completed = true;
      });

      const refreshReq = httpMock.expectOne((r) => r.url.includes('/api/auth/refresh'));
      expect(refreshReq.request.method).toBe('POST');
      expect(refreshReq.request.withCredentials).toBe(true);
      refreshReq.flush({ accessToken: 'session-token', accessTokenExpiresInSeconds: 900 });

      const accountReq = httpMock.expectOne((r) => r.url.includes('/api/account/base'));
      expect(accountReq.request.method).toBe('GET');
      accountReq.flush(mockAccount);

      expect(completed).toBe(true);
      expect(tokenService.token()).toBe('session-token');
      expect(service.currentUser()).toEqual(mockAccount);
    });

    it('restores current user when a token is already in memory', () => {
      const mockAccount: AccountInfo = { username: 'owner', role: 'owner' };
      tokenService.setToken('existing-token');
      let completed = false;

      service.ensureCurrentUserLoaded().subscribe(() => {
        completed = true;
      });
      const req = httpMock.expectOne((r) => r.url.includes('/api/account/base'));
      expect(req.request.method).toBe('GET');
      req.flush(mockAccount);

      expect(completed).toBe(true);
      expect(service.currentUser()).toEqual(mockAccount);
      expect(service.canManageContent()).toBe(true);
      expect(service.canManageTeam()).toBe(true);
    });

    it('shares the in-flight account restore request', () => {
      const mockAccount: AccountInfo = { username: 'admin', role: 'admin' };
      tokenService.setToken('existing-token');
      let completions = 0;

      service.ensureCurrentUserLoaded().subscribe(() => {
        completions += 1;
      });
      service.ensureCurrentUserLoaded().subscribe(() => {
        completions += 1;
      });
      const requests = httpMock.match((r) => r.url.includes('/api/account/base'));
      expect(requests).toHaveLength(1);
      requests[0].flush(mockAccount);

      expect(completions).toBe(2);
      expect(service.currentUser()).toEqual(mockAccount);
    });

    it('clears the local session when account restore fails', () => {
      tokenService.setToken('existing-token');
      let failed = false;

      service.ensureCurrentUserLoaded().subscribe({
        error: () => {
          failed = true;
        },
      });
      const req = httpMock.expectOne((r) => r.url.includes('/api/account/base'));
      req.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

      expect(failed).toBe(true);
      expect(tokenService.token()).toBeNull();
      expect(service.currentUser()).toBeNull();
    });
  });
});

describe('AuthService without a browser document', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not touch browser storage when checking or clearing session presence', () => {
    const getItem = jest.spyOn(Storage.prototype, 'getItem');
    const removeItem = jest.spyOn(Storage.prototype, 'removeItem');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        ApiClient,
        AuthService,
        { provide: DOCUMENT, useValue: { defaultView: null } },
      ],
    });
    const service = TestBed.inject(AuthService);

    expect(service.hasKnownSession()).toBe(false);
    service.clearLocalSession();

    expect(getItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });
});

describe('AuthService with unavailable browser storage', () => {
  it('fails closed when the localStorage getter throws', () => {
    const defaultView = {} as Window;
    Object.defineProperty(defaultView, 'localStorage', {
      get: () => {
        throw new DOMException('Blocked', 'SecurityError');
      },
    });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        ApiClient,
        AuthService,
        { provide: DOCUMENT, useValue: { defaultView } },
      ],
    });
    const service = TestBed.inject(AuthService);

    expect(service.hasKnownSession()).toBe(false);
    expect(() => service.clearLocalSession()).not.toThrow();
  });

  it('keeps authentication functional when localStorage operations throw', () => {
    const unavailableStorage = {
      getItem: jest.fn(() => {
        throw new DOMException('Blocked', 'SecurityError');
      }),
      setItem: jest.fn(() => {
        throw new DOMException('Blocked', 'SecurityError');
      }),
      removeItem: jest.fn(() => {
        throw new DOMException('Blocked', 'SecurityError');
      }),
    } as unknown as Storage;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ApiClient,
        AuthService,
        { provide: DOCUMENT, useValue: { defaultView: { localStorage: unavailableStorage } } },
      ],
    });
    const service = TestBed.inject(AuthService);
    const httpMock = TestBed.inject(HttpTestingController);
    let completed = false;

    expect(service.hasKnownSession()).toBe(false);
    expect(() => service.clearLocalSession()).not.toThrow();

    service.login('admin', 'secret').subscribe(() => {
      completed = true;
    });
    httpMock
      .expectOne((req) => req.url.includes('/api/auth/login'))
      .flush({ accessToken: 'token', accessTokenExpiresInSeconds: 900 });
    httpMock
      .expectOne((req) => req.url.includes('/api/account/base'))
      .flush({ username: 'admin', role: 'admin' } satisfies AccountInfo);

    expect(completed).toBe(true);
    expect(service.isLoggedIn()).toBe(true);
    httpMock.verify();
  });
});
