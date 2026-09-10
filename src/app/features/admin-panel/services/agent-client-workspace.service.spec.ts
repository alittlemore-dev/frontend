import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiClient } from '../../../core/http/api-client.service';
import { AgentClientWorkspaceService } from './agent-client-workspace.service';

const CLIENT_ID = '00000000000000000000000000000011';

describe('AgentClientWorkspaceService', () => {
  let service: AgentClientWorkspaceService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AgentClientWorkspaceService,
        ApiClient,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(AgentClientWorkspaceService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads clients and maps certificate metadata', () => {
    let fingerprint: string | undefined;

    service.listClients().subscribe((clients) => {
      fingerprint = clients[0].certificates[0].fingerprintSha256;
    });

    const req = httpMock.expectOne((request) => request.url.endsWith('/api/admin/agent-clients'));
    expect(req.request.method).toBe('GET');
    req.flush({
      clients: [clientDto()],
    });

    expect(fingerprint).toBe('A1:B2:C3');
  });

  it('registers a client with the selected scopes and CSR', () => {
    const payload = {
      name: 'desktop-codex',
      scopes: ['matrix.queue.claim', 'matrix.draft.create'] as const,
      csrPem: '-----BEGIN CERTIFICATE REQUEST-----\nCSR\n-----END CERTIFICATE REQUEST-----',
    };
    let certificatePem: string | undefined;

    service.registerClient(payload).subscribe((result) => {
      certificatePem = result.certificatePem;
    });

    const req = httpMock.expectOne((request) => request.url.endsWith('/api/admin/agent-clients'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({
      client: clientDto(),
      certificatePem: 'CLIENT CERTIFICATE',
      certificateChainPem: 'ISSUING CHAIN',
    });

    expect(certificatePem).toBe('CLIENT CERTIFICATE');
  });

  it('permanently revokes a client', () => {
    service.revokeClient(CLIENT_ID).subscribe();

    const req = httpMock.expectOne((request) =>
      request.url.endsWith(`/api/admin/agent-clients/${CLIENT_ID}/revoke`),
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('loads the first privacy-safe audit page with the caller-owned page size', () => {
    let action: string | undefined;
    let nextEventId: string | undefined;

    service.listAuditEvents(CLIENT_ID, 50, null).subscribe((page) => {
      action = page.events[0].action;
      nextEventId = page.nextCursor?.eventId;
    });

    const req = httpMock.expectOne((request) =>
      request.url.endsWith(`/api/admin/agent-clients/${CLIENT_ID}/audit`),
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual(['pageSize']);
    expect(req.request.params.get('pageSize')).toBe('50');
    req.flush({
      events: [
        {
          id: 'event-1',
          agentClientId: CLIENT_ID,
          certificateId: 'certificate-1',
          action: 'rotate_agent_certificate',
          queueItemId: 'queue-1',
          matrixItemId: 'matrix-1',
          requestId: 'request-1',
          result: 'success',
          inputDigest: 'sha256:privacy-safe',
          createdAt: '2026-07-14T12:00:00+00:00',
        },
      ],
      nextCursor: {
        createdAt: '2026-07-14T12:00:00+00:00',
        eventId: 'event-1',
      },
    });

    expect(action).toBe('rotate_agent_certificate');
    expect(nextEventId).toBe('event-1');
  });

  it('loads a subsequent audit page with the paired cursor fields', () => {
    service
      .listAuditEvents(CLIENT_ID, 50, {
        createdAt: '2026-07-14T12:00:00+00:00',
        eventId: 'event-1',
      })
      .subscribe((page) => expect(page.nextCursor).toBeNull());

    const req = httpMock.expectOne((request) =>
      request.url.endsWith(`/api/admin/agent-clients/${CLIENT_ID}/audit`),
    );
    expect(req.request.params.get('pageSize')).toBe('50');
    expect(req.request.params.get('cursorCreatedAt')).toBe('2026-07-14T12:00:00+00:00');
    expect(req.request.params.get('cursorEventId')).toBe('event-1');
    req.flush({ events: [], nextCursor: null });
  });
});

function clientDto(): object {
  return {
    id: CLIENT_ID,
    name: 'desktop-codex',
    status: 'active',
    scopes: ['matrix.queue.claim', 'matrix.draft.create'],
    createdAt: '2026-07-14T10:00:00+00:00',
    revokedAt: null,
    certificates: [
      {
        id: 'certificate-1',
        fingerprintSha256: 'A1:B2:C3',
        serialNumber: '42',
        validFrom: '2026-07-14T10:00:00+00:00',
        expiresAt: '2026-10-12T10:00:00+00:00',
        createdAt: '2026-07-14T10:00:00+00:00',
        revokedAt: null,
      },
    ],
  };
}
