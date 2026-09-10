import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpInterceptorFn } from '@angular/common/http';
import { PLATFORM_ID, inject } from '@angular/core';

export const browserApiOriginInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isPlatformBrowser(inject(PLATFORM_ID)) || !req.url.startsWith('/api/')) {
    return next(req);
  }

  const publicOrigin = inject(DOCUMENT).location.origin;
  return next(req.clone({ url: `${publicOrigin}${req.url}` }));
};
