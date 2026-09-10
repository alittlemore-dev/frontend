import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { ApiError } from '../../../../core/models/api-error.model';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { AgentAuditEventPage, AgentClient } from '../../models/agent-client-workspace.model';
import { AgentClientWorkspaceService } from '../../services/agent-client-workspace.service';
import { AgentClientsPageComponent } from './agent-clients-page.component';

describe('AgentClientsPageComponent', () => {
  let fixture: ComponentFixture<AgentClientsPageComponent>;
  let service: {
    listClients: jest.Mock;
    registerClient: jest.Mock;
    revokeClient: jest.Mock;
    listAuditEvents: jest.Mock;
  };
  let notifications: { success: jest.Mock; error: jest.Mock };

  beforeEach(async () => {
    service = {
      listClients: jest.fn().mockReturnValue(of([client()])),
      registerClient: jest.fn().mockReturnValue(
        of({
          client: client({ name: 'runner-codex' }),
          certificatePem: '-----BEGIN CERTIFICATE-----\nCLIENT\n-----END CERTIFICATE-----',
          certificateChainPem: '-----BEGIN CERTIFICATE-----\nCHAIN\n-----END CERTIFICATE-----',
        }),
      ),
      revokeClient: jest.fn().mockReturnValue(of(undefined)),
      listAuditEvents: jest.fn().mockReturnValue(of(auditPage())),
    };
    notifications = { success: jest.fn(), error: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [AgentClientsPageComponent],
      providers: [
        provideI18nTesting(),
        { provide: AgentClientWorkspaceService, useValue: service },
        { provide: NotificationService, useValue: notifications },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AgentClientsPageComponent);
    fixture.detectChanges();
  });

  it('renders client status, scopes, fingerprint, and expiry without private keys', () => {
    expect(fixture.nativeElement.textContent).toContain('desktop-codex');
    expect(fixture.nativeElement.textContent).toContain('Активен');
    expect(fixture.nativeElement.textContent).toContain('matrix.queue.claim');
    expect(fixture.nativeElement.textContent).toContain('A1:B2:C3');
    expect(fixture.nativeElement.textContent).not.toContain('Приватный ключ');
    expect(Object.keys(fixture.componentInstance.registrationForm.controls)).toEqual([
      'name',
      'csrPem',
    ]);
  });

  it('shows local CSR generation guidance with advanced platform options collapsed', () => {
    fixture.componentInstance.openRegistration();
    fixture.detectChanges();

    const instructions = fixture.nativeElement.querySelector<HTMLElement>(
      '[data-testid="agent-csr-instructions"]',
    );
    const posixCommand = fixture.nativeElement.querySelector<HTMLElement>(
      '[data-testid="agent-csr-posix-command"]',
    );
    const advancedOptions = fixture.nativeElement.querySelector<HTMLDetailsElement>(
      '[data-testid="agent-csr-advanced-options"]',
    );

    expect(instructions?.textContent).toContain('OpenSSL');
    expect(instructions?.textContent).toContain('Linux/macOS');
    expect(instructions?.textContent).toContain('Windows PowerShell');
    expect(instructions?.textContent).toContain('вставьте только CSR');
    expect(posixCommand?.textContent).toContain('ec_paramgen_curve:P-256');
    expect(posixCommand?.textContent).toContain('agent.key.pem');
    expect(posixCommand?.textContent).toContain('agent.csr.pem');
    expect(posixCommand?.textContent).not.toContain('\n');
    expect(advancedOptions?.open).toBe(false);
    expect(fixture.nativeElement.querySelectorAll('[data-command-copy]')).toHaveLength(4);
  });

  it('copies the complete command and reports success', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    fixture.componentInstance.openRegistration();
    fixture.detectChanges();
    const command = fixture.nativeElement.querySelector<HTMLElement>(
      '[data-testid="agent-csr-posix-command"]',
    )!.textContent!;

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="agent-csr-copy-posix"]')!
      .click();
    await fixture.whenStable();

    expect(writeText).toHaveBeenCalledWith(command);
    expect(notifications.success).toHaveBeenCalledWith('Команда скопирована.');
  });

  it('reports when browser clipboard access is unavailable or rejected', async () => {
    setClipboard(undefined);
    fixture.componentInstance.copyCsrCommand('command');
    expect(notifications.error).toHaveBeenCalledWith('Не удалось скопировать команду.');

    notifications.error.mockClear();
    setClipboard({ writeText: jest.fn().mockRejectedValue(new Error('Denied')) });
    fixture.componentInstance.copyCsrCommand('command');
    await fixture.whenStable();

    expect(notifications.error).toHaveBeenCalledWith('Не удалось скопировать команду.');
  });

  it('registers only a CSR and exposes the issued certificate and chain once', () => {
    fixture.componentInstance.openRegistration();
    fixture.componentInstance.registrationForm.controls.name.setValue('runner-codex');
    fixture.componentInstance.registrationForm.controls.csrPem.setValue('CSR PEM');
    fixture.componentInstance.toggleScope('matrix.queue.claim', true);
    fixture.componentInstance.registerClient();
    fixture.detectChanges();

    expect(service.registerClient).toHaveBeenCalledWith({
      name: 'runner-codex',
      scopes: ['matrix.queue.claim'],
      csrPem: 'CSR PEM',
    });
    expect(service.registerClient.mock.calls[0][0]).not.toHaveProperty('privateKey');
    expect(fixture.nativeElement.textContent).toContain('Сохраните сертификат и цепочку сейчас');
    expect(
      fixture.nativeElement.querySelector('[data-testid="agent-certificate-pem"]').value,
    ).toContain('CLIENT');
    expect(
      fixture.nativeElement.querySelector('[data-testid="agent-certificate-chain-pem"]').value,
    ).toContain('CHAIN');
  });

  it('keeps registration data and shows a localized duplicate-name error for 409', () => {
    service.registerClient.mockReturnValue(
      throwError(() => apiError(409, 'Agent client name already exists')),
    );
    fixture.componentInstance.openRegistration();
    fixture.componentInstance.registrationForm.controls.name.setValue('desktop-codex');
    fixture.componentInstance.registrationForm.controls.csrPem.setValue('CSR PEM');
    fixture.componentInstance.toggleScope('matrix.queue.claim', true);

    fixture.componentInstance.registerClient();
    fixture.detectChanges();

    const error = fixture.nativeElement.querySelector<HTMLElement>(
      '[data-testid="agent-registration-error"]',
    );
    expect(error?.textContent).toContain('AI-агент с таким именем уже зарегистрирован.');
    expect(error?.textContent).not.toContain('Agent client name already exists');
    expect(notifications.error).toHaveBeenCalledWith(
      'AI-агент с таким именем уже зарегистрирован.',
    );
    expect(fixture.componentInstance.registrationForm.getRawValue()).toEqual({
      name: 'desktop-codex',
      csrPem: 'CSR PEM',
    });
    expect(fixture.componentInstance.selectedScopes()).toEqual(new Set(['matrix.queue.claim']));
  });

  it('keeps registration data and generic localized feedback for other failures', () => {
    service.registerClient.mockReturnValue(throwError(() => apiError(500, 'Sensitive detail')));
    fixture.componentInstance.openRegistration();
    fixture.componentInstance.registrationForm.controls.name.setValue('runner-codex');
    fixture.componentInstance.registrationForm.controls.csrPem.setValue('CSR PEM');
    fixture.componentInstance.toggleScope('matrix.queue.claim', true);

    fixture.componentInstance.registerClient();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector<HTMLElement>('[data-testid="agent-registration-error"]')
        ?.textContent,
    ).toContain('Не удалось зарегистрировать AI-агента.');
    expect(fixture.nativeElement.textContent).not.toContain('Sensitive detail');
    expect(fixture.componentInstance.registrationForm.controls.name.value).toBe('runner-codex');
  });

  it('requires explicit confirmation before irreversible revocation', () => {
    jest.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);

    fixture.componentInstance.revokeClient(client());
    expect(service.revokeClient).not.toHaveBeenCalled();

    fixture.componentInstance.revokeClient(client());
    expect(service.revokeClient).toHaveBeenCalledWith('client-1');
    expect(notifications.success).toHaveBeenCalledWith('Доступ агента отозван навсегда.');
  });

  it('shows privacy-safe action fields and an explicit end state', () => {
    fixture.componentInstance.loadAudit(client());
    fixture.detectChanges();

    expect(service.listAuditEvents).toHaveBeenCalledWith('client-1', 50, null);
    expect(fixture.nativeElement.textContent).toContain('Действие');
    expect(fixture.nativeElement.textContent).toContain('save_matrix_question_draft');
    expect(fixture.nativeElement.textContent).toContain('sha256:digest-only');
    expect(fixture.nativeElement.textContent).toContain('Больше событий нет.');
    expect(fixture.nativeElement.textContent).not.toContain('Полный prompt');
  });

  it('renders initial loading, failure with retry, and empty states distinctly', () => {
    const pending = new Subject<AgentAuditEventPage>();
    service.listAuditEvents.mockReturnValueOnce(pending);
    fixture.componentInstance.loadAudit(client());
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Загрузка журнала…');

    pending.error(apiError(500, 'Sensitive detail'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Не удалось загрузить журнал агента.');
    expect(fixture.nativeElement.textContent).not.toContain('Sensitive detail');

    service.listAuditEvents.mockReturnValueOnce(of({ events: [], nextCursor: null }));
    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="agent-audit-initial-retry"]')!
      .click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Действий пока нет.');
    expect(fixture.nativeElement.textContent).not.toContain('Больше событий нет.');
  });

  it('appends audit pages once, removes duplicate rows, and renders load-more progress and end', () => {
    const cursor = { createdAt: '2026-07-14T12:00:00+00:00', eventId: 'event-1' };
    const nextPage = new Subject<AgentAuditEventPage>();
    service.listAuditEvents
      .mockReturnValueOnce(of(auditPage(cursor)))
      .mockReturnValueOnce(nextPage);
    fixture.componentInstance.loadAudit(client());
    fixture.detectChanges();

    const loadMore = fixture.nativeElement.querySelector<HTMLButtonElement>(
      '[data-testid="agent-audit-load-more"]',
    )!;
    loadMore.click();
    loadMore.click();
    fixture.detectChanges();

    expect(service.listAuditEvents).toHaveBeenCalledTimes(2);
    expect(service.listAuditEvents).toHaveBeenLastCalledWith('client-1', 50, cursor);
    expect(fixture.nativeElement.textContent).toContain('Загрузка следующих событий…');

    nextPage.next({
      events: [auditPage().events[0], auditEvent('event-2', 'confirm_agent_certificate_rotation')],
      nextCursor: null,
    });
    nextPage.complete();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('[data-testid="agent-audit-row"]')).toHaveLength(
      2,
    );
    expect(fixture.nativeElement.textContent).toContain('confirm_agent_certificate_rotation');
    expect(fixture.nativeElement.textContent).toContain('Больше событий нет.');
  });

  it('retains loaded rows and offers a localized retry after a load-more failure', () => {
    const cursor = { createdAt: '2026-07-14T12:00:00+00:00', eventId: 'event-1' };
    service.listAuditEvents
      .mockReturnValueOnce(of(auditPage(cursor)))
      .mockReturnValueOnce(throwError(() => apiError(500, 'Sensitive detail')))
      .mockReturnValueOnce(of({ events: [auditEvent('event-2')], nextCursor: null }));
    fixture.componentInstance.loadAudit(client());
    fixture.detectChanges();

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="agent-audit-load-more"]')!
      .click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('[data-testid="agent-audit-row"]')).toHaveLength(
      1,
    );
    expect(fixture.nativeElement.textContent).toContain('Не удалось загрузить следующие события.');
    expect(fixture.nativeElement.textContent).not.toContain('Sensitive detail');

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="agent-audit-load-more-retry"]')!
      .click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[data-testid="agent-audit-row"]')).toHaveLength(
      2,
    );
  });

  it('ignores stale audit responses after closing and reopening for another client', () => {
    const first = new Subject<AgentAuditEventPage>();
    const second = new Subject<AgentAuditEventPage>();
    service.listAuditEvents.mockReturnValueOnce(first).mockReturnValueOnce(second);

    fixture.componentInstance.loadAudit(client());
    fixture.componentInstance.closeAudit();
    fixture.componentInstance.loadAudit(client({ id: 'client-2', name: 'second-agent' }));
    first.next({ events: [auditEvent('stale-event')], nextCursor: null });
    second.next({ events: [auditEvent('current-event')], nextCursor: null });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('second-agent');
    expect(fixture.nativeElement.textContent).toContain('current-event');
    expect(fixture.nativeElement.textContent).not.toContain('stale-event');
  });
});

function auditPage(nextCursor: AgentAuditEventPage['nextCursor'] = null): AgentAuditEventPage {
  return { events: [auditEvent('event-1')], nextCursor };
}

function auditEvent(id: string, action = 'save_matrix_question_draft' as const) {
  return {
    id,
    agentClientId: 'client-1',
    certificateId: 'certificate-1',
    action,
    queueItemId: 'queue-1',
    matrixItemId: 'matrix-1',
    requestId: `request-${id}`,
    result: 'success' as const,
    inputDigest: 'sha256:digest-only',
    createdAt: '2026-07-14T12:00:00+00:00',
  };
}

function apiError(status: number, message: string): ApiError {
  return {
    code: 'error',
    type: 'error',
    message,
    status,
    location: null,
    attr: null,
  };
}

function client(overrides: Partial<AgentClient> = {}): AgentClient {
  return {
    id: 'client-1',
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
    ...overrides,
  };
}

function setClipboard(clipboard: Pick<Clipboard, 'writeText'> | undefined): void {
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: clipboard,
  });
}
