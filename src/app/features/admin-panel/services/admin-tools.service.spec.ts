import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiClient } from '../../../core/http/api-client.service';
import { AdminToolsService } from './admin-tools.service';

describe('AdminToolsService', () => {
  let service: AdminToolsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AdminToolsService, ApiClient, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AdminToolsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads and maps cache status including domain TTLs and the last manual warm', () => {
    let minimumTtl: number | null | undefined;
    let queuedAt: string | undefined;

    service.getCacheStatus().subscribe((status) => {
      minimumTtl = status.domains[0].minimumRemainingTtlSeconds;
      queuedAt = status.lastManualWarmOperation?.queuedAt;
    });

    const req = httpMock.expectOne((request) => request.url.endsWith('/api/admin/tools/cache'));
    expect(req.request.method).toBe('GET');
    req.flush(cacheStatusDto());

    expect(minimumTtl).toBe(120);
    expect(queuedAt).toBe('2026-07-16T12:00:00Z');
  });

  it('clears cache without starting a warm operation', () => {
    service.clearCache().subscribe();

    const req = httpMock.expectOne((request) =>
      request.url.endsWith('/api/admin/tools/cache/clear'),
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(cacheStatusDto());

    httpMock.expectNone((request) => request.url.endsWith('/api/admin/tools/cache/warm'));
  });

  it('starts and polls a manual cache warm operation', () => {
    service.startCacheWarm().subscribe((operation) => expect(operation.status).toBe('queued'));

    const start = httpMock.expectOne((request) =>
      request.url.endsWith('/api/admin/tools/cache/warm'),
    );
    expect(start.request.method).toBe('POST');
    expect(start.request.body).toEqual({});
    start.flush(cacheWarmOperationDto('queued'));

    service
      .getCacheWarmOperation('operation-1')
      .subscribe((operation) => expect(operation.status).toBe('succeeded'));

    const poll = httpMock.expectOne((request) =>
      request.url.endsWith('/api/admin/tools/cache/warm/operation-1'),
    );
    expect(poll.request.method).toBe('GET');
    poll.flush(cacheWarmOperationDto('succeeded'));
  });

  it('loads session cleanup status and maps its server-owned window', () => {
    service.getAuthSessionsStatus().subscribe((status) => {
      expect(status).toEqual({
        expiredCount: 12,
        expiringSoonCount: 4,
        expiringSoonDays: 7,
        scheduledPruneIntervalSeconds: 3600,
      });
    });

    const req = httpMock.expectOne((request) =>
      request.url.endsWith('/api/admin/tools/auth-sessions'),
    );
    expect(req.request.method).toBe('GET');
    req.flush(authSessionsStatusDto());
  });

  it('prunes expired sessions and maps refreshed counts', () => {
    service.pruneAuthSessions().subscribe((result) => expect(result.deletedCount).toBe(12));

    const req = httpMock.expectOne((request) =>
      request.url.endsWith('/api/admin/tools/auth-sessions/prune'),
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({ ...authSessionsStatusDto(), deletedCount: 12, expiredCount: 0 });
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
      {
        domain: 'articles',
        keyCount: 0,
        minimumRemainingTtlSeconds: null,
        nonExpiringKeyCount: 0,
      },
      {
        domain: 'competency_matrix',
        keyCount: 5,
        minimumRemainingTtlSeconds: 30,
        nonExpiringKeyCount: 0,
      },
    ],
    lastManualWarmOperation: cacheWarmOperationDto('succeeded'),
  };
}

function cacheWarmOperationDto(status: 'queued' | 'succeeded'): object {
  return {
    operationId: 'operation-1',
    status,
    queuedAt: '2026-07-16T12:00:00Z',
    summary:
      status === 'succeeded'
        ? {
            attempted: 8,
            written: 7,
            skipped: 1,
          }
        : null,
  };
}

function authSessionsStatusDto(): object {
  return {
    expiredCount: 12,
    expiringSoonCount: 4,
    expiringSoonDays: 7,
    scheduledPruneIntervalSeconds: 3600,
  };
}
