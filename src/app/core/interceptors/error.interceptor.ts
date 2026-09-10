import { HttpInterceptorFn, HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { ApiError } from '../models/api-error.model';
import { AuthModalService } from '../auth/auth-modal.service';
import { AuthService } from '../auth/auth.service';
import { AuthTokenService } from '../auth/auth-token.service';
import { AUTH_REFRESH_ATTEMPTED, SKIP_AUTH_REFRESH } from '../auth/auth-http-context';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const authModal = inject(AuthModalService);
  const tokenService = inject(AuthTokenService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }
      if (shouldRefreshAfterUnauthorized(req, error)) {
        return authService.refreshAccessToken().pipe(
          switchMap(() => next(createRetryRequest(req, tokenService.token()))),
          catchError((retryError: unknown) => {
            handleFinalAuthFailure(req, retryError, authService, authModal);
            return throwError(() => toApiError(retryError));
          }),
        );
      }
      handleFinalAuthFailure(req, error, authService, authModal);
      return throwError(() => toApiError(error));
    }),
  );
};

function shouldRefreshAfterUnauthorized(
  req: HttpRequest<unknown>,
  error: HttpErrorResponse,
): boolean {
  return (
    error.status === 401 &&
    !req.context.get(SKIP_AUTH_REFRESH) &&
    !req.context.get(AUTH_REFRESH_ATTEMPTED) &&
    !isAuthEndpoint(req.url)
  );
}

function createRetryRequest(
  req: HttpRequest<unknown>,
  accessToken: string | null,
): HttpRequest<unknown> {
  const context = req.context.set(AUTH_REFRESH_ATTEMPTED, true);
  if (!accessToken) {
    return req.clone({ context });
  }
  return req.clone({
    context,
    setHeaders: { Authorization: `Bearer ${accessToken}` },
  });
}

function handleFinalAuthFailure(
  req: HttpRequest<unknown>,
  error: unknown,
  authService: AuthService,
  authModal: AuthModalService,
): void {
  if (error instanceof HttpErrorResponse && error.status === 401 && !isAuthEndpoint(req.url)) {
    authService.clearLocalSession();
    authModal.openLogin();
  }
}

function toApiError(error: unknown): ApiError | unknown {
  if (!(error instanceof HttpErrorResponse)) {
    return error;
  }
  const body = isApiErrorBody(error.error) ? error.error : null;
  return {
    code: body?.code ?? 'unknown',
    type: body?.type ?? 'unknown',
    message: body?.message ?? error.message,
    status: error.status,
    location: body?.location ?? null,
    attr: body?.attr ?? null,
    nested_errors: body?.nested_errors,
  };
}

function isApiErrorBody(value: unknown): value is Partial<ApiError> {
  return value !== null && typeof value === 'object';
}

function isAuthEndpoint(url: string): boolean {
  return new URL(url, 'http://localhost').pathname.startsWith('/api/auth/');
}
