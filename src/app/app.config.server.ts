import {
  HTTP_TRANSFER_CACHE_ORIGIN_MAP,
  HttpInterceptorFn,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { ApplicationConfig, InjectionToken, mergeApplicationConfig, inject } from '@angular/core';
import { IS_DISCOVERING_ROUTES, provideServerRendering, withRoutes } from '@angular/ssr';
import { SKIP_I18N_STARTUP, appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

const SSR_API_ORIGIN = new InjectionToken<string>('SSR_API_ORIGIN');
const SSR_PUBLIC_ORIGIN = new InjectionToken<string>('SSR_PUBLIC_ORIGIN');

const serverApiOriginInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/')) {
    return next(req);
  }

  const apiOrigin = inject(SSR_API_ORIGIN);
  return next(req.clone({ url: `${apiOrigin}${req.url}` }));
};

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    provideHttpClient(withInterceptors([serverApiOriginInterceptor])),
    {
      provide: SKIP_I18N_STARTUP,
      useFactory: () => inject(IS_DISCOVERING_ROUTES),
    },
    {
      provide: SSR_API_ORIGIN,
      useFactory: () => readRequiredOrigin('SSR_API_ORIGIN'),
    },
    {
      provide: SSR_PUBLIC_ORIGIN,
      useFactory: readPublicOrigin,
    },
    {
      provide: HTTP_TRANSFER_CACHE_ORIGIN_MAP,
      useFactory: (apiOrigin: string, publicOrigin: string) => ({
        [apiOrigin]: publicOrigin,
      }),
      deps: [SSR_API_ORIGIN, SSR_PUBLIC_ORIGIN],
    },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);

function readPublicOrigin(): string {
  const explicitOrigin = readOptionalOrigin('SSR_PUBLIC_ORIGIN');
  if (explicitOrigin) return explicitOrigin;

  const schema = readRequiredEnv('APP_URL_SCHEMA');
  const domain = readRequiredEnv('APP_DOMAIN');
  return normalizeOrigin(`${schema}://${domain}`, 'public origin');
}

function readRequiredOrigin(name: string): string {
  return normalizeOrigin(readRequiredEnv(name), name);
}

function readOptionalOrigin(name: string): string | null {
  const value = process.env[name]?.trim();
  if (!value) return null;
  return normalizeOrigin(value, name);
}

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for Angular SSR runtime.`);
  }
  return value;
}

function normalizeOrigin(value: string, name: string): string {
  const origin = new URL(value).origin;
  if (origin !== value.replace(/\/$/, '')) {
    throw new Error(`${name} must be an origin without a path.`);
  }
  return origin;
}
