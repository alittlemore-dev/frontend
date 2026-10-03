import express from 'express';
import { createServer, get } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { OpenApiDocument } from 'openapi-merge';
import { ApiSchemaAggregator, registerApiDocsRoutes } from './server-api-docs';

function schema(path: string, kind: 'string' | 'number' = 'string'): OpenApiDocument {
  return {
    openapi: '3.1.0',
    info: { title: 'docs', version: '0.1.0' },
    servers: [{ url: 'http://backend.internal' }],
    paths: {
      [path]: {
        get: {
          operationId: 'getItem',
          tags: ['api', 'items'],
          responses: {
            '200': {
              description: 'OK',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Item' } } },
            },
          },
        },
      },
    },
    components: { schemas: { Item: { type: kind } } },
  };
}

function jsonResponse(data: unknown): Response {
  return { ok: true, status: 200, json: async () => data } as Response;
}

describe('Unified OpenAPI', () => {
  let originalOrigin: string | undefined;
  let fetchSchema: jest.MockedFunction<typeof fetch>;
  let clock: number;
  let aggregator: ApiSchemaAggregator;

  beforeEach(() => {
    originalOrigin = process.env['API_SCHEMA_ORIGIN'];
    process.env['API_SCHEMA_ORIGIN'] = 'http://schema-edge.internal';
    clock = 0;
    fetchSchema = jest.fn<typeof fetch>().mockImplementation(async (input) => {
      const path = new URL(String(input)).pathname;
      if (path === '/openapi/auth.json') {
        const doc = schema('/api/auth/account/me');
        doc.security = [{ bearerAuth: [] }];
        doc.components!.securitySchemes = {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'PASETO' },
        };
        return jsonResponse(doc);
      }
      if (path === '/openapi/competency.json')
        return jsonResponse(schema('/api/articles', 'number'));
      if (path === '/openapi/personal-workspace.json') {
        const doc = schema('/api/resumes');
        doc.paths!['/api/resumes'].get!.security = [{ bearerAuth: [] }];
        doc.components!.securitySchemes = {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'PASETO' },
        };
        return jsonResponse(doc);
      }
      return jsonResponse(schema('/api/i18n/languages'));
    });
    aggregator = new ApiSchemaAggregator(fetchSchema, () => clock);
  });

  afterEach(() => {
    if (originalOrigin === undefined) delete process.env['API_SCHEMA_ORIGIN'];
    else process.env['API_SCHEMA_ORIGIN'] = originalOrigin;
    jest.restoreAllMocks();
  });

  it('merges all external paths, refs, operation IDs, tags and effective security', async () => {
    const doc = await aggregator.getSchema();
    expect(Object.keys(doc.paths!)).toEqual([
      '/api/auth/account/me',
      '/api/competency/articles',
      '/api/personal-workspace/resumes',
      '/api/i18n/languages',
    ]);
    expect(doc.info.title).toBe('alittlemore.dev API');
    expect(doc.servers).toEqual([{ url: '/' }]);
    expect(doc.security).toBeUndefined();
    expect(doc.paths!['/api/competency/articles'].get!.security).toEqual([]);
    expect(doc.paths!['/api/auth/account/me'].get!.security).toEqual([{ bearerAuth: [] }]);
    expect(doc.paths!['/api/personal-workspace/resumes'].get!.security).toEqual([
      { bearerAuth: [] },
    ]);
    expect(Object.keys(doc.components!.securitySchemes!)).toEqual(['bearerAuth']);
    const operations = Object.values(doc.paths!).map((item) => item.get!);
    expect(new Set(operations.map((operation) => operation.operationId)).size).toBe(4);
    expect(operations[1].tags).toEqual(['Competency / items']);
    for (const operation of operations) {
      const response = operation.responses['200'];
      if (!('content' in response)) throw new Error('Expected a response body');
      const reference = response.content!['application/json'].schema;
      if (!reference || !('$ref' in reference)) throw new Error('Expected a schema reference');
      const name = reference.$ref.split('/').at(-1)!;
      expect(doc.components!.schemas![name]).toBeDefined();
    }
    expect(
      Object.values(doc.components!.schemas!).some(
        (item) => 'type' in item && item.type === 'number',
      ),
    ).toBe(true);
    expect(fetchSchema).toHaveBeenCalledTimes(4);
    expect(fetchSchema.mock.calls.every(([, options]) => options?.redirect === 'error')).toBe(true);
  });

  it('shares an in-flight refresh and expires the complete cache after 30 seconds', async () => {
    const [first, concurrent] = await Promise.all([aggregator.getSchema(), aggregator.getSchema()]);
    expect(first).toBe(concurrent);
    expect(fetchSchema).toHaveBeenCalledTimes(4);
    clock = 29_999;
    expect(await aggregator.getSchema()).toBe(first);
    clock = 30_000;
    expect(await aggregator.getSchema()).not.toBe(first);
    expect(fetchSchema).toHaveBeenCalledTimes(8);
  });

  it('rejects a failed service without returning a partial or expired schema and retries', async () => {
    await aggregator.getSchema();
    clock = 30_000;
    fetchSchema.mockResolvedValueOnce({ ok: false, status: 502 } as Response);
    await expect(aggregator.getSchema()).rejects.toThrow('Auth: HTTP 502');
    expect(Object.keys((await aggregator.getSchema()).paths!)).toHaveLength(4);
  });

  it('identifies invalid JSON and malformed source documents', async () => {
    fetchSchema.mockResolvedValueOnce({
      ok: true,
      json: async () => {
        throw new SyntaxError();
      },
    } as Response);
    await expect(aggregator.getSchema()).rejects.toThrow('Auth: schema unavailable or invalid');
    fetchSchema.mockResolvedValueOnce(jsonResponse({ openapi: '3.1.0', info: {}, paths: {} }));
    await expect(aggregator.getSchema()).rejects.toThrow('Auth: schema unavailable or invalid');
  });

  it('bounds source fetches with a five-second abort signal', async () => {
    const timeout = jest.spyOn(AbortSignal, 'timeout');
    fetchSchema.mockRejectedValueOnce(new DOMException('Timeout', 'TimeoutError'));
    await expect(aggregator.getSchema()).rejects.toThrow('Auth: schema unavailable or invalid');
    expect(timeout).toHaveBeenCalledWith(5_000);
    expect(fetchSchema.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('reports incompatible source versions as an aggregation failure', async () => {
    const incompatible = schema('/api/auth/login');
    incompatible.openapi = '3.0.3';
    fetchSchema.mockResolvedValueOnce(jsonResponse(incompatible));
    await expect(aggregator.getSchema()).rejects.toThrow('mixed-openapi-versions');
  });

  it('requires an explicit schema origin', async () => {
    delete process.env['API_SCHEMA_ORIGIN'];
    await expect(aggregator.getSchema()).rejects.toThrow('API_SCHEMA_ORIGIN is required');
    expect(fetchSchema).not.toHaveBeenCalled();
  });

  it('serves standalone Swagger assets and responds 503 with a source-specific error', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchSchema;
    const app = express();
    registerApiDocsRoutes(app);
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      const html = await request(`${origin}/api/docs`);
      expect(html.status).toBe(200);
      expect(html.body).toContain('/api/docs/initializer.js');
      expect(html.body).not.toContain('cdn.');
      expect((await request(`${origin}/api/docs/swagger-ui.css`)).status).toBe(200);
      expect((await request(`${origin}/api/docs/swagger-ui-bundle.js`)).status).toBe(200);
      expect((await request(`${origin}/api/docs/package.json`)).status).toBe(404);
      const initializer = await request(`${origin}/api/docs/initializer.js`);
      expect(initializer.body).toContain("url: '/api/openapi.json'");
      expect(initializer.body).toContain('persistAuthorization: false');
      fetchSchema.mockResolvedValueOnce({ ok: false, status: 503 } as Response);
      const failed = await request(`${origin}/api/openapi.json?url=http://untrusted.example`);
      expect(failed.status).toBe(503);
      expect(JSON.parse(failed.body).detail).toContain('Auth');
      const successful = await request(`${origin}/api/openapi.json`);
      expect(successful.status).toBe(200);
      expect(JSON.parse(successful.body).info.title).toBe('alittlemore.dev API');
    } finally {
      globalThis.fetch = originalFetch;
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

function request(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    get(url, (response) => {
      let body = '';
      response.on('data', (chunk: Buffer) => {
        body += chunk.toString();
      });
      response.on('end', () => resolve({ status: response.statusCode!, body }));
    }).on('error', reject);
  });
}
