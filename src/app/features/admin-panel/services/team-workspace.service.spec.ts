import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiClient } from '../../../core/http/api-client.service';
import { ManagedAccountCreatePayload } from '../models/team-workspace.model';
import { TeamWorkspaceService } from './team-workspace.service';

describe('TeamWorkspaceService', () => {
  let service: TeamWorkspaceService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TeamWorkspaceService, ApiClient, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TeamWorkspaceService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads managed accounts with explicit pagination', () => {
    let firstUsername = '';
    let firstStatus = false;

    service.listAccounts({ page: 2, pageSize: 20 }).subscribe((list) => {
      firstUsername = list.accounts[0].username;
      firstStatus = list.accounts[0].isActive;
    });

    const listReq = httpMock.expectOne((request) => request.url.endsWith('/api/admin/accounts'));
    expect(listReq.request.method).toBe('GET');
    expect(listReq.request.params.get('page')).toBe('2');
    expect(listReq.request.params.get('pageSize')).toBe('20');
    listReq.flush({
      totalCount: 2,
      totalPages: 1,
      accounts: [{ ...accountDto(), username: 'OwnerUser', role: 'owner' }, accountDto()],
    });

    expect(firstUsername).toBe('OwnerUser');
    expect(firstStatus).toBe(true);
  });

  it('loads detail and mutates managed accounts through admin endpoints', () => {
    const payload: ManagedAccountCreatePayload = {
      username: 'NewAdmin',
      role: 'admin',
      password: 'password123',
      isActive: true,
    };

    service.getAccount('AdminUser').subscribe((account) => {
      expect(account.role).toBe('admin');
    });
    const detailReq = httpMock.expectOne((request) =>
      request.url.endsWith('/api/admin/accounts/AdminUser'),
    );
    expect(detailReq.request.method).toBe('GET');
    detailReq.flush(accountDto());

    service.createAccount(payload).subscribe((account) => {
      expect(account.username).toBe('AdminUser');
    });
    const createReq = httpMock.expectOne((request) => request.url.endsWith('/api/admin/accounts'));
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.body).toEqual(payload);
    createReq.flush(accountDto());

    service.updateAccountRole('AdminUser', 'moderator').subscribe();
    const roleReq = httpMock.expectOne((request) =>
      request.url.endsWith('/api/admin/accounts/AdminUser/role'),
    );
    expect(roleReq.request.method).toBe('PUT');
    expect(roleReq.request.body).toEqual({ role: 'moderator' });
    roleReq.flush({ ...accountDto(), role: 'moderator' });

    service.updateAccountPassword('AdminUser', 'new-password').subscribe();
    const passwordReq = httpMock.expectOne((request) =>
      request.url.endsWith('/api/admin/accounts/AdminUser/password'),
    );
    expect(passwordReq.request.method).toBe('PUT');
    expect(passwordReq.request.body).toEqual({ password: 'new-password' });
    passwordReq.flush(accountDto());

    service.activateAccount('AdminUser').subscribe();
    const activateReq = httpMock.expectOne((request) =>
      request.url.endsWith('/api/admin/accounts/AdminUser/activate'),
    );
    expect(activateReq.request.method).toBe('POST');
    expect(activateReq.request.body).toEqual({});
    activateReq.flush(accountDto());

    service.deactivateAccount('AdminUser').subscribe();
    const deactivateReq = httpMock.expectOne((request) =>
      request.url.endsWith('/api/admin/accounts/AdminUser/deactivate'),
    );
    expect(deactivateReq.request.method).toBe('POST');
    expect(deactivateReq.request.body).toEqual({});
    deactivateReq.flush({ ...accountDto(), isActive: false });

    service.deleteAccount('AdminUser').subscribe();
    const deleteReq = httpMock.expectOne((request) =>
      request.url.endsWith('/api/admin/accounts/AdminUser'),
    );
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush(null);
  });

  it('loads and revokes managed account sessions through admin endpoints', () => {
    service.listAccountSessions('AdminUser').subscribe((sessions) => {
      expect(sessions.sessions).toEqual([
        {
          id: '10000000000040008000000000000001',
          userAgentDisplay: 'Firefox on Linux',
          userAgentBrowser: 'Firefox',
          userAgentOs: 'Linux',
          userAgentDevice: 'desktop',
          authMethod: 'password',
          createdAt: '2026-07-07T11:30:00+00:00',
          lastUsedAt: '2026-07-08T11:30:00+00:00',
          expiresAt: '2026-08-07T11:30:00+00:00',
          isCurrent: true,
        },
      ]);
    });
    const listReq = httpMock.expectOne((request) =>
      request.url.endsWith('/api/admin/accounts/AdminUser/sessions'),
    );
    expect(listReq.request.method).toBe('GET');
    listReq.flush({
      sessions: [sessionDto()],
    });

    service
      .revokeAccountSession('AdminUser', '10000000000040008000000000000001')
      .subscribe((result) => {
        expect(result.currentSessionRevoked).toBe(true);
      });
    const revokeReq = httpMock.expectOne((request) =>
      request.url.endsWith(
        '/api/admin/accounts/AdminUser/sessions/10000000000040008000000000000001/revoke',
      ),
    );
    expect(revokeReq.request.method).toBe('POST');
    expect(revokeReq.request.body).toEqual({});
    revokeReq.flush({ currentSessionRevoked: true });

    service.revokeAllAccountSessions('AdminUser').subscribe((result) => {
      expect(result.currentSessionRevoked).toBe(true);
    });
    const revokeAllReq = httpMock.expectOne((request) =>
      request.url.endsWith('/api/admin/accounts/AdminUser/sessions/revoke-all'),
    );
    expect(revokeAllReq.request.method).toBe('POST');
    expect(revokeAllReq.request.body).toEqual({});
    revokeAllReq.flush({ currentSessionRevoked: true });

    service.revokeOtherAccountSessions('AdminUser').subscribe((result) => {
      expect(result.currentSessionRevoked).toBe(false);
    });
    const revokeOthersReq = httpMock.expectOne((request) =>
      request.url.endsWith('/api/admin/accounts/AdminUser/sessions/revoke-others'),
    );
    expect(revokeOthersReq.request.method).toBe('POST');
    expect(revokeOthersReq.request.body).toEqual({});
    revokeOthersReq.flush({ currentSessionRevoked: false });
  });
});

function accountDto(): {
  username: string;
  role: 'owner' | 'admin' | 'moderator';
  isActive: boolean;
} {
  return {
    username: 'AdminUser',
    role: 'admin',
    isActive: true,
  };
}

function sessionDto(): {
  id: string;
  userAgentDisplay: string;
  userAgentBrowser: string;
  userAgentOs: string;
  userAgentDevice: 'desktop';
  authMethod: 'password';
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  isCurrent: boolean;
} {
  return {
    id: '10000000000040008000000000000001',
    userAgentDisplay: 'Firefox on Linux',
    userAgentBrowser: 'Firefox',
    userAgentOs: 'Linux',
    userAgentDevice: 'desktop',
    authMethod: 'password',
    createdAt: '2026-07-07T11:30:00+00:00',
    lastUsedAt: '2026-07-08T11:30:00+00:00',
    expiresAt: '2026-08-07T11:30:00+00:00',
    isCurrent: true,
  };
}
