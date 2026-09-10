import express from 'express';
import {
  buildPublicNotFoundHtml,
  buildPublicSeoApiUrl,
  normalizeOrigin,
  parsePublicSeoPath,
} from './server-seo';
import type { PublicSeoRoute } from './server-seo';

const HASHED_JAVASCRIPT_OR_CSS_PATTERN = /-[a-z0-9]{8,}\.(?:css|js)$/i;
const IMMUTABLE_STATIC_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const STABLE_STATIC_CACHE_CONTROL = 'public, max-age=15552000';
const CSP_NONCE_HEADER = 'x-csp-nonce';
const CSP_NONCE_PLACEHOLDER = '__CSP_NONCE__';
const CSP_NONCE_PATTERN = /^[A-Za-z0-9+/_-]{16,128}={0,2}$/;

export interface AngularSsrEngine {
  handle(req: express.Request): Promise<Response | null>;
}

export type AngularSsrResponseWriter = (
  response: Response,
  res: express.Response,
) => Promise<void> | void;

interface CreateExpressAppOptions {
  readonly browserDistFolder: string;
  readonly angularApp: AngularSsrEngine;
  readonly responseWriter: AngularSsrResponseWriter;
}

export function createExpressApp(options: CreateExpressAppOptions): express.Express {
  const app = express();
  app.disable('x-powered-by');

  app.get('/healthz', (_req, res) => {
    res.status(200).type('text/plain').send('');
  });

  app.use(
    express.static(options.browserDistFolder, {
      maxAge: 0,
      index: false,
      redirect: false,
      setHeaders: setStaticCacheHeaders,
    }),
  );

  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }

    const route = parsePublicSeoPath(req.path);
    if (route === null) {
      next();
      return;
    }

    void runPublicSeoPreflight(route, res, next);
  });

  app.use((req, res, next) => {
    options.angularApp
      .handle(req)
      .then((response) => {
        if (!response) {
          next();
          return undefined;
        }
        return writeAngularResponse(req, response, res, options.responseWriter);
      })
      .catch(next);
  });

  return app;
}

async function writeAngularResponse(
  req: express.Request,
  response: Response,
  res: express.Response,
  responseWriter: AngularSsrResponseWriter,
): Promise<void> {
  const nonce = readCspNonce(req);
  const responseWithNonce =
    nonce === null ? response : await replaceCspNoncePlaceholders(response, nonce);
  await responseWriter(responseWithNonce, res);
}

function readCspNonce(req: express.Request): string | null {
  const nonce = req.get(CSP_NONCE_HEADER);
  if (!nonce || !CSP_NONCE_PATTERN.test(nonce)) return null;
  return nonce;
}

async function replaceCspNoncePlaceholders(response: Response, nonce: string): Promise<Response> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('text/html')) return response;

  const body = (await response.text()).replaceAll(CSP_NONCE_PLACEHOLDER, nonce);
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

function setStaticCacheHeaders(res: express.Response, filePath: string): void {
  const cacheControl = HASHED_JAVASCRIPT_OR_CSS_PATTERN.test(filePath)
    ? IMMUTABLE_STATIC_CACHE_CONTROL
    : STABLE_STATIC_CACHE_CONTROL;
  res.setHeader('Cache-Control', cacheControl);
}

async function runPublicSeoPreflight(
  route: PublicSeoRoute,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> {
  try {
    const apiUrl = buildPublicSeoApiUrl(readRequiredOrigin('SSR_API_ORIGIN'), route);
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });
    await response.body?.cancel();

    if (response.status === 404 || response.status === 403) {
      res.status(404).type('html').send(buildPublicNotFoundHtml(readPublicOrigin(), route));
      return;
    }

    if (!response.ok) {
      next(new Error(`Public SEO preflight failed with HTTP ${response.status}.`));
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
}

export function readRequiredPort(): number {
  const rawPort = process.env['PORT']?.trim();
  if (!rawPort) {
    throw new Error('PORT is required for Angular SSR runtime.');
  }
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('PORT must be a positive integer.');
  }
  return port;
}

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
