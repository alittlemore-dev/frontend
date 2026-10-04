import express from 'express';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { isErrorResult, merge } from 'openapi-merge';
import type { MergeInput, OpenApiDocument } from 'openapi-merge';
import { normalizeOrigin } from './server-seo';

const SCHEMA_CACHE_MS = 30_000;
const SCHEMA_TIMEOUT_MS = 5_000;
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'] as const;

interface SchemaSource {
  readonly name: string;
  readonly path: string;
  readonly publicPrefix: string | null;
}

const SOURCES: readonly SchemaSource[] = [
  { name: 'Auth', path: '/openapi/auth.json', publicPrefix: null },
  { name: 'Competency', path: '/openapi/competency.json', publicPrefix: '/api/competency' },
  {
    name: 'Personal Workspace',
    path: '/openapi/personal-workspace.json',
    publicPrefix: '/api/personal-workspace',
  },
  { name: 'I18n', path: '/openapi/i18n.json', publicPrefix: null },
];

export class ApiSchemaError extends Error {}

export class ApiSchemaAggregator {
  private cached: OpenApiDocument | null = null;
  private expiresAt = 0;
  private pending: Promise<OpenApiDocument> | null = null;

  constructor(
    private readonly fetchSchema: typeof fetch,
    private readonly now: () => number,
  ) {}

  async getSchema(): Promise<OpenApiDocument> {
    if (this.cached !== null && this.now() < this.expiresAt) return this.cached;
    if (this.pending !== null) return this.pending;
    this.pending = this.loadSchema();
    try {
      const schema = await this.pending;
      this.cached = schema;
      this.expiresAt = this.now() + SCHEMA_CACHE_MS;
      return schema;
    } finally {
      this.pending = null;
    }
  }

  private async loadSchema(): Promise<OpenApiDocument> {
    const value = process.env['API_SCHEMA_ORIGIN']?.trim();
    if (!value) throw new ApiSchemaError('API_SCHEMA_ORIGIN is required.');
    const origin = normalizeOrigin(value, 'API_SCHEMA_ORIGIN');
    const inputs: MergeInput = await Promise.all(
      SOURCES.map(async (source) => ({
        oas: await this.loadSource(origin, source),
        dispute: { prefix: source.name.replaceAll(' ', ''), alwaysApply: true },
        ...(source.publicPrefix === null
          ? {}
          : { pathModification: { stripStart: '/api', prepend: source.publicPrefix } }),
      })),
    );
    const result = merge(inputs, { info: { title: 'alittlemore.dev API' } });
    if (isErrorResult(result)) {
      throw new ApiSchemaError(`Auth, Competency, Personal Workspace, I18n: ${result.type}.`);
    }
    result.output.servers = [{ url: '/' }];
    delete result.output.security;
    return result.output;
  }

  private async loadSource(origin: string, source: SchemaSource): Promise<OpenApiDocument> {
    try {
      const response = await this.fetchSchema(new URL(source.path, origin), {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(SCHEMA_TIMEOUT_MS),
        redirect: 'error',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: unknown = await response.json();
      if (!isOpenApiDocument(data)) throw new Error('invalid OpenAPI document');
      const tagNames = new Set<string>();
      for (const pathItem of Object.values(data.paths ?? {})) {
        delete pathItem.servers;
        for (const method of HTTP_METHODS) {
          const operation = pathItem[method];
          if (!operation) continue;
          // Root-level security belongs to this source, not to the entire merged API.
          operation.security ??= data.security ?? [];
          delete operation.servers;
          const tags = (operation.tags ?? []).filter(
            (tag) => !['api', 'protected api'].includes(tag),
          );
          operation.tags =
            tags.length === 0 ? [source.name] : tags.map((tag) => `${source.name} / ${tag}`);
          for (const tag of operation.tags) tagNames.add(tag);
        }
      }
      data.tags = [...tagNames].map((name) => ({ name }));
      delete data.security;
      return data;
    } catch (error) {
      const detail =
        error instanceof Error && error.message.startsWith('HTTP ')
          ? error.message
          : 'schema unavailable or invalid';
      throw new ApiSchemaError(`${source.name}: ${detail}.`);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOpenApiDocument(value: unknown): value is OpenApiDocument {
  return (
    isRecord(value) &&
    typeof value['openapi'] === 'string' &&
    isRecord(value['info']) &&
    typeof value['info']['title'] === 'string' &&
    typeof value['info']['version'] === 'string' &&
    isRecord(value['paths'])
  );
}

export function registerApiDocsRoutes(app: express.Express): void {
  const aggregator = new ApiSchemaAggregator((...args) => fetch(...args), Date.now);
  const requireFromApp = createRequire(resolve('package.json'));
  const swaggerFolder = dirname(requireFromApp.resolve('swagger-ui-dist/package.json'));
  const assets = new Set(['swagger-ui.css', 'swagger-ui-bundle.js']);

  app.get(['/api/docs', '/api/docs/'], (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>alittlemore.dev API</title><link rel="stylesheet" href="/api/docs/swagger-ui.css"></head>
<body><div id="swagger-ui"></div><script src="/api/docs/swagger-ui-bundle.js"></script>
<script src="/api/docs/initializer.js"></script></body></html>`);
  });
  app.get('/api/docs/initializer.js', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.type('js').send(`window.ui = SwaggerUIBundle({
      url: '/api/openapi.json', dom_id: '#swagger-ui', deepLinking: true,
      validatorUrl: null, persistAuthorization: false, queryConfigEnabled: false
    });`);
  });
  app.get('/api/docs/:asset', (req, res) => {
    if (!assets.has(req.params['asset'])) {
      res.sendStatus(404);
      return;
    }
    res.sendFile(req.params['asset'], { root: swaggerFolder, maxAge: 0 });
  });
  app.get('/api/openapi.json', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    void aggregator
      .getSchema()
      .then((schema) => res.json(schema))
      .catch((error: unknown) => {
        res.status(503).json({
          error: 'API documentation is temporarily unavailable.',
          detail: error instanceof ApiSchemaError ? error.message : 'Schema aggregation failed.',
        });
      });
  });
}
