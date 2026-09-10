import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, HttpHandlerFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { errorInterceptor } from './error.interceptor';
import { AuthModalService } from '../auth/auth-modal.service';
import { AuthService } from '../auth/auth.service';
import { AuthTokenService } from '../auth/auth-token.service';

describe('errorInterceptor', () => {
  function setup(
    authService: Partial<AuthService> = {},
    openLogin = jest.fn(),
    accessToken: string | null = null,
  ): void {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            refreshAccessToken: jest.fn(() => of(void 0)),
            clearLocalSession: jest.fn(),
            ...authService,
          },
        },
        { provide: AuthModalService, useValue: { openLogin } },
        { provide: AuthTokenService, useValue: { token: jest.fn(() => accessToken) } },
      ],
    });
  }

  function httpError(status: number, error: unknown): HttpErrorResponse {
    return new HttpErrorResponse({ status, error });
  }

  it('maps HttpErrorResponse to ApiError', (done) => {
    const req = new HttpRequest('GET', '/api/test');
    const next: HttpHandlerFn = () =>
      throwError(() =>
        httpError(500, { code: 'server_error', type: 'server_error', message: 'Broken' }),
      );
    setup();

    TestBed.runInInjectionContext(() => errorInterceptor(req, next)).subscribe({
      error: (err: unknown) => {
        expect(err).toEqual({
          code: 'server_error',
          type: 'server_error',
          message: 'Broken',
          status: 500,
          location: null,
          attr: null,
          nested_errors: undefined,
        });
        done();
      },
    });
  });

  it('preserves backend error context and nested errors', (done) => {
    const req = new HttpRequest('POST', '/api/admin/queue/import');
    const next: HttpHandlerFn = () =>
      throwError(() =>
        httpError(400, {
          code: 'client_error',
          type: 'bad_request',
          message: 'Question queue import file is invalid.',
          location: 'body',
          attr: 'file',
          nested_errors: [
            {
              code: 'client_error',
              type: 'bad_request',
              message: 'Row 2 question must not be blank.',
              location: 'body',
              attr: 'file.row.2',
            },
          ],
        }),
      );
    setup();

    TestBed.runInInjectionContext(() => errorInterceptor(req, next)).subscribe({
      error: (err: unknown) => {
        expect(err).toEqual({
          code: 'client_error',
          type: 'bad_request',
          message: 'Question queue import file is invalid.',
          status: 400,
          location: 'body',
          attr: 'file',
          nested_errors: [
            {
              code: 'client_error',
              type: 'bad_request',
              message: 'Row 2 question must not be blank.',
              location: 'body',
              attr: 'file.row.2',
            },
          ],
        });
        done();
      },
    });
  });

  it('refreshes and retries a protected request once after a 401', (done) => {
    const refreshAccessToken = jest.fn(() => of(void 0));
    const req = new HttpRequest('GET', '/api/admin/articles').clone({
      setHeaders: { Authorization: 'Bearer old-token' },
    });
    const responses: Observable<HttpResponse<unknown>>[] = [
      throwError(() =>
        httpError(401, { code: 'unauthorized', type: 'auth', message: 'Unauthorized' }),
      ),
      of(new HttpResponse({ status: 200, body: { ok: true } })),
    ];
    const next = jest.fn(() => responses.shift() ?? of(new HttpResponse({ status: 204 })));
    setup({ refreshAccessToken }, jest.fn(), 'fresh-token');

    TestBed.runInInjectionContext(() => errorInterceptor(req, next)).subscribe({
      next: (response) => {
        expect(response).toBeInstanceOf(HttpResponse);
        expect(refreshAccessToken).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledTimes(2);
        const retriedRequest = next.mock.calls[1][0] as HttpRequest<unknown>;
        expect(retriedRequest.headers.get('Authorization')).toBe('Bearer fresh-token');
        done();
      },
    });
  });

  it('clears local session and opens login when retry is still unauthorized', (done) => {
    const clearLocalSession = jest.fn();
    const openLogin = jest.fn();
    const req = new HttpRequest('GET', '/api/admin/articles');
    const next: HttpHandlerFn = () =>
      throwError(() =>
        httpError(401, { code: 'unauthorized', type: 'auth', message: 'Unauthorized' }),
      );
    setup({ clearLocalSession }, openLogin);

    TestBed.runInInjectionContext(() => errorInterceptor(req, next)).subscribe({
      error: (err: unknown) => {
        expect(err).toEqual(
          expect.objectContaining({
            code: 'unauthorized',
            status: 401,
          }),
        );
        expect(clearLocalSession).toHaveBeenCalledTimes(1);
        expect(openLogin).toHaveBeenCalledTimes(1);
        done();
      },
    });
  });

  it('does not refresh-loop or open login for auth endpoint 401 responses', (done) => {
    const refreshAccessToken = jest.fn(() => of(void 0));
    const clearLocalSession = jest.fn();
    const openLogin = jest.fn();
    const req = new HttpRequest('POST', '/api/auth/refresh', {});
    const next: HttpHandlerFn = () =>
      throwError(() =>
        httpError(401, { code: 'unauthorized', type: 'auth', message: 'Unauthorized' }),
      );
    setup({ refreshAccessToken, clearLocalSession }, openLogin);

    TestBed.runInInjectionContext(() => errorInterceptor(req, next)).subscribe({
      error: (err: unknown) => {
        expect(err).toEqual(
          expect.objectContaining({
            code: 'unauthorized',
            status: 401,
          }),
        );
        expect(refreshAccessToken).not.toHaveBeenCalled();
        expect(clearLocalSession).not.toHaveBeenCalled();
        expect(openLogin).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('preserves status when backend returns non-json error body', (done) => {
    const req = new HttpRequest('POST', '/api/competency-matrix/question-suggestions');
    const next: HttpHandlerFn = () =>
      throwError(
        () =>
          new HttpErrorResponse({
            status: 429,
            statusText: 'Too Many Requests',
            error: '<html>Too many requests</html>',
          }),
      );
    setup();

    TestBed.runInInjectionContext(() => errorInterceptor(req, next)).subscribe({
      error: (err: unknown) => {
        expect(err).toEqual({
          code: 'unknown',
          type: 'unknown',
          message: expect.any(String),
          status: 429,
          location: null,
          attr: null,
          nested_errors: undefined,
        });
        done();
      },
    });
  });
});
