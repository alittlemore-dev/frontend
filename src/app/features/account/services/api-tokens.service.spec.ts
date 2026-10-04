import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiTokensService } from './api-tokens.service';
import { ApiToken } from '../models/api-token.model';

const BASE = '/api/auth/account/me/api-tokens';
const token: ApiToken = {
  id: 'example-id',
  name: 'Example',
  permissions: ['workspace.resumes.create'],
  createdAt: '2026-10-01T00:00:00Z',
  expiresAt: '2026-10-02T00:00:00Z',
  lastUsedAt: null,
  revokedAt: null,
  status: 'active',
};

describe('ApiTokensService', () => {
  let service: ApiTokensService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ApiTokensService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ApiTokensService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('loads the server-filtered catalog and metadata separately', () => {
    const permissions = [
      {
        code: 'workspace.resumes.create',
        service: 'workspace',
        domain: 'resumes',
        action: 'create',
      },
    ];
    service.permissions().subscribe((result) => expect(result).toEqual(permissions));
    service.list().subscribe((result) => expect(result).toEqual([token]));
    http.expectOne((request) => request.url.endsWith(`${BASE}/permissions`)).flush({ permissions });
    http.expectOne((request) => request.url.endsWith(BASE)).flush({ tokens: [token] });
  });

  it('sends explicit permissions and password on create but returns metadata only', () => {
    const payload = {
      name: 'Example',
      password: 'example-password',
      permissions: ['workspace.resumes.create'],
      expiresAt: token.expiresAt,
    };
    service.create(payload).subscribe((result) => {
      expect(result).toEqual(token);
      expect(result).not.toHaveProperty('secret');
    });
    const request = http.expectOne((request) => request.url.endsWith(BASE));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    expect(request.request.headers.get('X-CSRF-Guard')).toBe('1');
    request.flush({ token, secret: 'example-token-value' });
  });

  it('requests a new secret with a password and revokes without one using CSRF', () => {
    service
      .reveal(token.id, 'example-password')
      .subscribe((result) => expect(result).toBe('example-token-value'));
    const reveal = http.expectOne((request) => request.url.endsWith(`${BASE}/${token.id}/reveal`));
    expect(reveal.request.body).toEqual({ password: 'example-password' });
    expect(reveal.request.headers.get('X-CSRF-Guard')).toBe('1');
    reveal.flush({ secret: 'example-token-value' });
    service.revoke(token.id).subscribe((result) => expect(result.status).toBe('revoked'));
    const revoke = http.expectOne((request) => request.url.endsWith(`${BASE}/${token.id}/revoke`));
    expect(revoke.request.method).toBe('POST');
    expect(revoke.request.body).toBeNull();
    expect(revoke.request.headers.get('X-CSRF-Guard')).toBe('1');
    revoke.flush({ ...token, status: 'revoked' });
  });
});
