import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiClient } from '../../../core/http/api-client.service';
import { CacheStatus, CacheWarmOperation } from '../models/tools.model';
import { ToolsService } from './tools.service';

describe('ToolsService', () => {
  let service: ToolsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ToolsService, ApiClient, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ToolsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads and maps the cache status returned by the protected endpoint', () => {
    let result: CacheStatus | undefined;
    service.getCacheStatus().subscribe((status) => {
      result = status;
    });

    const request = httpMock.expectOne((item) =>
      item.url.endsWith('/api/personal-workspace/tools/cache'),
    );
    expect(request.request.method).toBe('GET');
    request.flush(cacheStatusDto());

    expect(result).toEqual({
      enabled: true,
      configuredTtlSeconds: 86400,
      scheduledWarmIntervalSeconds: 3600,
      domains: [
        {
          domain: 'i18n',
          keyCount: 3,
          minimumRemainingTtlSeconds: 120,
          nonExpiringKeyCount: 1,
        },
      ],
      lastManualWarmOperation: {
        operationId: 'operation-1',
        status: 'succeeded',
        queuedAt: '2026-08-11T12:00:00Z',
        summary: { attempted: 2, written: 2, skipped: 0 },
      },
    });
  });

  it('clears the cache through its explicit mutation endpoint', () => {
    let result: CacheStatus | undefined;
    service.clearCache().subscribe((status) => {
      result = status;
    });

    const request = httpMock.expectOne((item) =>
      item.url.endsWith('/api/personal-workspace/tools/cache/clear'),
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush({
      ...cacheStatusDto(),
      domains: [
        {
          domain: 'i18n',
          keyCount: 0,
          minimumRemainingTtlSeconds: null,
          nonExpiringKeyCount: 0,
        },
      ],
    });

    expect(result?.domains[0]).toEqual({
      domain: 'i18n',
      keyCount: 0,
      minimumRemainingTtlSeconds: null,
      nonExpiringKeyCount: 0,
    });
  });

  it('starts and polls the same manual cache-warm operation', () => {
    let started: CacheWarmOperation | undefined;
    let completed: CacheWarmOperation | undefined;

    service.startCacheWarm().subscribe((operation) => {
      started = operation;
    });
    const start = httpMock.expectOne((item) =>
      item.url.endsWith('/api/personal-workspace/tools/cache/warm'),
    );
    expect(start.request.method).toBe('POST');
    expect(start.request.body).toEqual({});
    start.flush(cacheWarmOperationDto('queued'));

    service.getCacheWarmOperation('operation-1').subscribe((operation) => {
      completed = operation;
    });
    const poll = httpMock.expectOne((item) =>
      item.url.endsWith('/api/personal-workspace/tools/cache/warm/operation-1'),
    );
    expect(poll.request.method).toBe('GET');
    poll.flush(cacheWarmOperationDto('succeeded'));

    expect(started?.status).toBe('queued');
    expect(completed).toEqual({
      operationId: 'operation-1',
      status: 'succeeded',
      queuedAt: '2026-08-11T12:00:00Z',
      summary: { attempted: 2, written: 2, skipped: 0 },
    });
  });
});

function cacheStatusDto(): object {
  return {
    enabled: true,
    configuredTtlSeconds: 86400,
    scheduledWarmIntervalSeconds: 3600,
    domains: [
      {
        domain: 'i18n',
        keyCount: 3,
        minimumRemainingTtlSeconds: 120,
        nonExpiringKeyCount: 1,
      },
    ],
    lastManualWarmOperation: cacheWarmOperationDto('succeeded'),
  };
}

function cacheWarmOperationDto(status: 'queued' | 'succeeded'): object {
  return {
    operationId: 'operation-1',
    status,
    queuedAt: '2026-08-11T12:00:00Z',
    summary: status === 'succeeded' ? { attempted: 2, written: 2, skipped: 0 } : null,
  };
}
