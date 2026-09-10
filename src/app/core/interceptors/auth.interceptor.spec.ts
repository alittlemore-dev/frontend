import { TestBed } from '@angular/core/testing';
import { HttpContext, HttpRequest, HttpHandlerFn, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { AuthTokenService } from '../auth/auth-token.service';
import { SKIP_AUTH_HEADER } from '../auth/auth-http-context';

describe('authInterceptor', () => {
  function runInterceptor(
    req: HttpRequest<unknown>,
    tokenValue: string | null,
  ): { passedReq: HttpRequest<unknown> } {
    const captured: { passedReq: HttpRequest<unknown> } = { passedReq: req };
    const next: HttpHandlerFn = (r) => {
      captured.passedReq = r as HttpRequest<unknown>;
      return of(new HttpResponse({ status: 200 }));
    };

    const mockTokenService = { token: () => tokenValue };

    TestBed.configureTestingModule({
      providers: [{ provide: AuthTokenService, useValue: mockTokenService }],
    });

    TestBed.runInInjectionContext(() => authInterceptor(req, next));

    return captured;
  }

  it('skips requests when no token', () => {
    const req = new HttpRequest('GET', '/api/test');
    const result = runInterceptor(req, null);
    expect(result.passedReq.headers.has('Authorization')).toBe(false);
  });

  it('adds Authorization: Bearer <token> when token exists', () => {
    const req = new HttpRequest('GET', '/api/test');
    const result = runInterceptor(req, 'my-secret-token');
    expect(result.passedReq.headers.get('Authorization')).toBe('Bearer my-secret-token');
  });

  it('skips Authorization when request context opts out', () => {
    const req = new HttpRequest(
      'POST',
      '/api/auth/refresh',
      {},
      {
        context: new HttpContext().set(SKIP_AUTH_HEADER, true),
      },
    );

    const result = runInterceptor(req, 'expired-token');

    expect(result.passedReq.headers.has('Authorization')).toBe(false);
  });
});
