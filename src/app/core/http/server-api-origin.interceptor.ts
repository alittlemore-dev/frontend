import { HttpInterceptorFn } from '@angular/common/http';
import { InjectionToken, inject } from '@angular/core';

export const SSR_API_ORIGIN = new InjectionToken<string>('SSR_API_ORIGIN');
export const SSR_I18N_ORIGIN = new InjectionToken<string>('SSR_I18N_ORIGIN');

export const serverApiOriginInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/')) return next(request);

  const origin = request.url.startsWith('/api/i18n/')
    ? inject(SSR_I18N_ORIGIN)
    : inject(SSR_API_ORIGIN);
  return next(request.clone({ url: `${origin}${request.url}` }));
};
