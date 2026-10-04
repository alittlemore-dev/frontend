import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AccountAvatarService } from '../../../core/auth/account-avatar.service';
import { AuthModalService } from '../../../core/auth/auth-modal.service';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import { AuthTokenService } from '../../../core/auth/auth-token.service';
import { AuthService } from '../../../core/auth/auth.service';
import { authInterceptor } from '../../../core/interceptors/auth.interceptor';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';
import { ApiTokensService } from './api-tokens.service';

const BASE = '/api/auth/account/me/api-tokens';
const metadata = {
  id: 'example-id',
  name: 'Example',
  permissions: ['workspace.resumes.create'],
  createdAt: '2026-10-01T00:00:00Z',
  expiresAt: '2026-10-02T00:00:00Z',
  lastUsedAt: null,
  revokedAt: null,
  status: 'active',
};
const createPayload = {
  name: 'Example',
  password: 'example-password',
  permissions: ['workspace.resumes.create'],
  expiresAt: metadata.expiresAt,
};

// Exercise real service + both interceptors + cookie refresh, not just request context flags.
describe('ApiTokensService browser authentication', () => {
  let service: ApiTokensService;
  let http: HttpTestingController;
  let tokens: AuthTokenService;
  let session: AuthSessionService;
  let auth: AuthService;
  let refresh: jest.SpyInstance;
  let clear: jest.SpyInstance;
  let login: jest.SpyInstance;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ApiTokensService,
        provideHttpClient(withInterceptors([errorInterceptor, authInterceptor])),
        provideHttpClientTesting(),
        {
          provide: AccountAvatarService,
          useValue: { clear: jest.fn(), loadFor: jest.fn(() => of(void 0)) },
        },
      ],
    });
    service = TestBed.inject(ApiTokensService);
    http = TestBed.inject(HttpTestingController);
    tokens = TestBed.inject(AuthTokenService);
    session = TestBed.inject(AuthSessionService);
    auth = TestBed.inject(AuthService);
    tokens.setToken('expired-example-bearer');
    session.setCurrentUser({ username: 'owner', role: 'owner' });
    refresh = jest.spyOn(auth, 'refreshAccessToken');
    clear = jest.spyOn(auth, 'clearLocalSession');
    login = jest.spyOn(TestBed.inject(AuthModalService), 'openLogin');
  });

  afterEach(() => http.verify());

  function request(
    action: 'create' | 'reveal',
    next: (value: unknown) => void,
    error: (value: unknown) => void,
  ): void {
    if (action === 'create') service.create(createPayload).subscribe({ next, error });
    else service.reveal(metadata.id, 'example-password').subscribe({ next, error });
  }

  function path(action: 'create' | 'reveal'): string {
    return action === 'create' ? BASE : `${BASE}/${metadata.id}/reveal`;
  }

  it.each(['create', 'reveal'] as const)(
    'keeps a wrong-password 403 local for %s without retry, refresh or logout',
    (action) => {
      let errorStatus: unknown;
      request(
        action,
        () => {
          throw new Error('Request must fail');
        },
        (error) => {
          errorStatus = (error as { status: number }).status;
        },
      );
      const attempt = http.expectOne((request) => request.url.endsWith(path(action)));
      expect(attempt.request.method).toBe('POST');
      attempt.flush(
        { code: 'forbidden', message: 'Password confirmation failed' },
        { status: 403, statusText: 'Forbidden' },
      );
      expect(errorStatus).toBe(403);
      http.expectNone((request) => request.url.endsWith(path(action)));
      http.expectNone((request) => request.url.endsWith('/api/auth/refresh'));
      expect(refresh).not.toHaveBeenCalled();
      expect(clear).not.toHaveBeenCalled();
      expect(login).not.toHaveBeenCalled();
      expect(session.isLoggedIn()).toBe(true);
    },
  );

  it.each(['create', 'reveal'] as const)(
    'recovers an expired bearer with cookie refresh and retries %s successfully',
    (action) => {
      let result: unknown;
      request(
        action,
        (value) => {
          result = value;
        },
        (error) => {
          throw error;
        },
      );
      const first = http.expectOne((request) => request.url.endsWith(path(action)));
      expect(first.request.headers.get('Authorization')).toBe('Bearer expired-example-bearer');
      first.flush({}, { status: 401, statusText: 'Unauthorized' });
      const cookieRefresh = http.expectOne((request) => request.url.endsWith('/api/auth/refresh'));
      expect(cookieRefresh.request.method).toBe('POST');
      expect(cookieRefresh.request.withCredentials).toBe(true);
      expect(cookieRefresh.request.headers.has('Authorization')).toBe(false);
      expect(cookieRefresh.request.headers.get('X-CSRF-Guard')).toBe('1');
      cookieRefresh.flush({
        accessToken: 'fresh-example-bearer',
        accessTokenExpiresInSeconds: 900,
      });
      const retry = http.expectOne((request) => request.url.endsWith(path(action)));
      expect(retry.request.method).toBe('POST');
      expect(retry.request.headers.get('Authorization')).toBe('Bearer fresh-example-bearer');
      expect(retry.request.headers.get('X-CSRF-Guard')).toBe('1');
      expect(retry.request.body).toEqual(
        action === 'create' ? createPayload : { password: 'example-password' },
      );
      retry.flush(
        action === 'create'
          ? { token: metadata, secret: 'example-api-value' }
          : { secret: 'example-api-value' },
      );
      expect(result).toEqual(action === 'create' ? metadata : 'example-api-value');
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(clear).not.toHaveBeenCalled();
      expect(login).not.toHaveBeenCalled();
      expect(session.isLoggedIn()).toBe(true);
    },
  );

  it('opens login recovery when a reveal session can no longer refresh', () => {
    let failed = false;
    request(
      'reveal',
      () => {
        throw new Error('Request must fail');
      },
      () => {
        failed = true;
      },
    );
    http
      .expectOne((request) => request.url.endsWith(path('reveal')))
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    http
      .expectOne((request) => request.url.endsWith('/api/auth/refresh'))
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(failed).toBe(true);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(clear).toHaveBeenCalledTimes(1);
    expect(login).toHaveBeenCalledWith(expect.objectContaining({ required: true }));
    expect(session.isLoggedIn()).toBe(false);
  });
});
