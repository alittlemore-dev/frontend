import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavigationStart, Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { ApiToken } from '../../models/api-token.model';
import { ApiTokensService } from '../../services/api-tokens.service';
import { ApiAccessPageComponent } from './api-access-page.component';

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
const catalog = [
  { code: 'workspace.resumes.create', service: 'workspace', domain: 'resumes', action: 'create' },
  { code: 'workspace.resumes.read', service: 'workspace', domain: 'resumes', action: 'read' },
];

describe('ApiAccessPageComponent', () => {
  let fixture: ComponentFixture<ApiAccessPageComponent>;
  let component: ApiAccessPageComponent;
  let events: Subject<NavigationStart>;
  let service: {
    list: jest.Mock;
    permissions: jest.Mock;
    create: jest.Mock;
    reveal: jest.Mock;
    revoke: jest.Mock;
  };
  let copy: jest.Mock;

  beforeEach(async () => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function (this: HTMLDialogElement): void {
        this.setAttribute('open', '');
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value: function (this: HTMLDialogElement): void {
        this.removeAttribute('open');
      },
    });
    events = new Subject();
    service = {
      list: jest.fn(() => of([token])),
      permissions: jest.fn(() => of(catalog)),
      create: jest.fn(() => of(token)),
      reveal: jest.fn(() => of('example-token-value')),
      revoke: jest.fn(() => of({ ...token, status: 'revoked' })),
    };
    copy = jest.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: copy },
    });
    await TestBed.configureTestingModule({
      imports: [ApiAccessPageComponent],
      providers: [
        provideI18nTesting(),
        { provide: ApiTokensService, useValue: service },
        { provide: Router, useValue: { events } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ApiAccessPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => fixture.destroy());

  function input(id: string, value: string): void {
    const element = fixture.nativeElement.querySelector(id) as HTMLInputElement;
    element.value = value;
    element.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }
  function click(label: string): void {
    const button = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find(
      (button) =>
        button.textContent?.trim() === label || button.getAttribute('aria-label') === label,
    );
    expect(button).toBeDefined();
    button!.click();
    fixture.detectChanges();
  }
  function openCreate(): void {
    click('account.apiAccess.create');
    expect(fixture.nativeElement.querySelector('dialog').open).toBe(true);
  }
  function submitCreate(): void {
    fixture.nativeElement.querySelector('dialog form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }
  function show(): void {
    click('account.apiAccess.show');
    input('#api-action-password-example-id', 'first-password');
    const form = fixture.nativeElement.querySelector('article form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  it('masks metadata, defaults to one hour, and snapshots concrete catalog permissions on create', () => {
    expect(
      fixture.nativeElement.querySelector('[data-testid="api-token-value"]').textContent,
    ).toContain('••••');
    openCreate();
    expect(
      (fixture.nativeElement.querySelector('#api-token-duration') as HTMLSelectElement).value,
    ).toBe('1h');
    input('#api-token-name', 'Import');
    input('#api-create-password', 'example-password');
    click('account.apiAccess.selectAll');
    submitCreate();
    expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
    const payload = service.create.mock.calls[0][0];
    expect(payload.permissions).toEqual(catalog.map((permission) => permission.code));
    expect(payload.password).toBe('example-password');
    expect(new Date(payload.expiresAt).getTime() - Date.now()).toBeGreaterThan(3590000);
    expect(new Date(payload.expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(3600000);
    expect(component.form.controls.password.value).toBe('');
    expect(fixture.nativeElement.textContent).not.toContain('example-token-value');
  });

  it('requires a new password for every show and copy and never copies the displayed value', async () => {
    expect(
      fixture.nativeElement.querySelector('button[aria-label="account.apiAccess.copy"]'),
    ).toBeNull();
    click('account.apiAccess.show');
    component.confirmSecret();
    fixture.detectChanges();
    expect(service.reveal).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'account.apiAccess.passwordRequired',
    );
    input('#api-action-password-example-id', 'first-password');
    component.confirmSecret();
    fixture.detectChanges();
    expect(service.reveal).toHaveBeenCalledWith(token.id, 'first-password');
    expect(
      fixture.nativeElement.querySelector('[data-testid="api-token-value"]').textContent,
    ).toContain('example-token-value');
    expect(
      fixture.nativeElement.querySelector('button[aria-label="account.apiAccess.copy"] svg'),
    ).not.toBeNull();
    service.reveal.mockReturnValueOnce(of('new-example-token-value'));
    click('account.apiAccess.copy');
    expect(fixture.nativeElement.textContent).not.toContain('example-token-value');
    expect(copy).not.toHaveBeenCalled();
    input('#api-action-password-example-id', 'second-password');
    component.confirmSecret();
    await Promise.resolve();
    fixture.detectChanges();
    expect(service.reveal).toHaveBeenLastCalledWith(token.id, 'second-password');
    expect(copy).toHaveBeenCalledWith('new-example-token-value');
    expect(fixture.nativeElement.textContent).not.toContain('new-example-token-value');
  });

  it.each(['show', 'copy'] as const)(
    'dismisses the %s password prompt without announcing a hidden token',
    (action) => {
      if (action === 'copy') show();
      click(`account.apiAccess.${action}`);
      input('#api-action-password-example-id', 'unsubmitted-password');
      click('Отмена');
      expect(fixture.nativeElement.querySelector('article form')).toBeNull();
      expect(fixture.nativeElement.querySelector('[role="status"], [role="alert"]')).toBeNull();
      expect(
        fixture.nativeElement.querySelector('[data-testid="api-token-value"]').textContent,
      ).toContain('••••');
      expect(service.reveal).toHaveBeenCalledTimes(action === 'copy' ? 1 : 0);
      expect(copy).not.toHaveBeenCalled();
      click('account.apiAccess.show');
      expect(
        (fixture.nativeElement.querySelector('#api-action-password-example-id') as HTMLInputElement)
          .value,
      ).toBe('');
    },
  );

  it('clears a displayed secret on hide, navigation and destruction', () => {
    show();
    click('account.apiAccess.hide');
    expect(fixture.nativeElement.textContent).not.toContain('example-token-value');
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain(
      'account.apiAccess.hidden',
    );
    show();
    events.next(new NavigationStart(1, '/account/settings'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('example-token-value');
    show();
    fixture.destroy();
    expect(component.revealed()).toBeNull();
    expect(component.actionPassword.value).toBe('');
  });

  it('cancels a pending reveal when confirmation is cancelled or navigating', () => {
    const pending = new Subject<string>();
    service.reveal.mockReturnValue(pending);
    show();
    click('Отмена');
    pending.next('late-example-value');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('late-example-value');
    expect(fixture.nativeElement.querySelector('[role="status"], [role="alert"]')).toBeNull();
    expect(component.busy()).toBe(false);
    show();
    events.next(new NavigationStart(1, '/account/me'));
    pending.next('late-example-value');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('late-example-value');
  });

  it('reports reveal failures without keeping raw errors or passwords and revokes the token', () => {
    service.reveal.mockReturnValueOnce(
      throwError(() => ({ secret: 'sensitive-example', password: 'first-password' })),
    );
    show();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'account.apiAccess.revealFailed',
    );
    expect(component.actionPassword.value).toBe('');
    expect(fixture.nativeElement.textContent).not.toContain('sensitive-example');
    click('account.apiAccess.revoke');
    expect(service.revoke).toHaveBeenCalledWith(token.id);
    expect(fixture.nativeElement.textContent).toContain('account.apiAccess.status.revoked');
  });

  it('rejects missing permissions and custom expiration outside the future year', () => {
    openCreate();
    input('#api-token-name', 'Import');
    input('#api-create-password', 'example-password');
    component.create();
    fixture.detectChanges();
    expect(service.create).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'account.apiAccess.invalid',
    );
    component.selectAll();
    component.form.controls.duration.setValue('custom');
    component.form.controls.expiresAt.setValue('2000-01-01T00:00');
    component.create();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'account.apiAccess.invalidExpiry',
    );
    component.form.controls.expiresAt.setValue(new Date(Date.now() + 366 * 86400000).toISOString());
    component.create();
    expect(service.create).not.toHaveBeenCalled();
  });

  it('sends an English manually entered custom expiry using month/day order', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-01T00:00:00Z'));
    try {
      openCreate();
      TestBed.inject(I18nService).language.set('en');
      component.form.controls.duration.setValue('custom');
      fixture.detectChanges();
      input('#api-token-name', 'Import');
      input('#api-create-password', 'example-password');
      component.selectAll();
      input('#api-token-expiry', '11/12/2026 12:00');
      (fixture.nativeElement.querySelector('#api-token-expiry') as HTMLInputElement).dispatchEvent(
        new Event('blur'),
      );
      fixture.detectChanges();
      component.create();
      expect(service.create).toHaveBeenCalledWith(
        expect.objectContaining({ expiresAt: new Date('2026-11-12T12:00').toISOString() }),
      );
    } finally {
      now.mockRestore();
    }
  });

  it('keeps creation in a modal, collapses permissions and resets them on dismissal', () => {
    expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    openCreate();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('#api-token-name'));
    const toggle = dialog.querySelector(
      '[data-testid="ds-section-toggle-api-permissions-workspace"]',
    ) as HTMLButtonElement;
    const body = dialog.querySelector(
      '[data-testid="ds-section-body-api-permissions-workspace"]',
    ) as HTMLElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(body.hidden).toBe(true);
    toggle.click();
    fixture.detectChanges();
    expect(body.hidden).toBe(false);
    const permission = body.querySelector('input') as HTMLInputElement;
    permission.click();
    input('#api-create-password', 'temporary-password');
    expect(component.selectedPermissions().size).toBe(1);
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    fixture.detectChanges();
    expect(dialog.open).toBe(false);
    expect(component.form.controls.password.value).toBe('');
    expect(component.selectedPermissions().size).toBe(0);
    expect(service.create).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
    openCreate();
    const reopenedToggle = fixture.nativeElement.querySelector(
      '[data-testid="ds-section-toggle-api-permissions-workspace"]',
    );
    expect(reopenedToggle.getAttribute('aria-expanded')).toBe('false');
    expect(component.expandedPermissions().size).toBe(0);
  });

  it('prevents dismissal while creation is pending and closes after success', () => {
    const pending = new Subject<ApiToken>();
    service.create.mockReturnValueOnce(pending);
    openCreate();
    input('#api-token-name', 'Import');
    input('#api-create-password', 'temporary-password');
    component.selectAll();
    submitCreate();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    const cancel = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancel);
    fixture.detectChanges();
    expect(cancel.defaultPrevented).toBe(true);
    expect(dialog.open).toBe(true);
    expect(component.form.controls.password.value).toBe('');
    expect(component.busy()).toBe(true);
    pending.next(token);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
    expect(component.busy()).toBe(false);
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain(
      'account.apiAccess.created',
    );
  });

  it('keeps a failed creation in the modal and clears the submitted password', () => {
    service.create.mockReturnValueOnce(throwError(() => new Error('private failure')));
    openCreate();
    input('#api-token-name', 'Import');
    input('#api-create-password', 'temporary-password');
    component.selectAll();
    submitCreate();
    const dialog = fixture.nativeElement.querySelector('dialog');
    expect(dialog.open).toBe(true);
    expect(dialog.querySelector('[role="alert"]').textContent).toContain(
      'account.apiAccess.createFailed',
    );
    expect(component.form.controls.password.value).toBe('');
    expect(dialog.textContent).not.toContain('private failure');
    expect(component.form.controls.name.value).toBe('Import');
  });

  it('starts all usage examples collapsed and expands each independently', () => {
    const toggles = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid^="ds-section-toggle-api-example-"]'),
    ) as HTMLButtonElement[];
    const bodies = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid^="ds-section-body-api-example-"]'),
    ) as HTMLElement[];
    expect(toggles).toHaveLength(4);
    expect(toggles.every((toggle) => toggle.getAttribute('aria-expanded') === 'false')).toBe(true);
    expect(bodies.every((body) => body.hidden)).toBe(true);
    toggles[0].click();
    fixture.detectChanges();
    expect(bodies[0].hidden).toBe(false);
    expect(bodies.slice(1).every((body) => body.hidden)).toBe(true);
    expect(bodies[0].textContent).toContain('Authorization: Bearer <YOUR_API_TOKEN>');
    toggles[0].click();
    fixture.detectChanges();
    expect(bodies[0].hidden).toBe(true);
    const documentation = fixture.nativeElement.querySelector('a[href="/api/docs"]');
    expect(documentation.closest('p')).not.toBeNull();
    expect(service.create).not.toHaveBeenCalled();
    expect(service.reveal).not.toHaveBeenCalled();
  });

  it('renders loading, empty, and retryable load error states', () => {
    const pending = new Subject<ApiToken[]>();
    service.list.mockReturnValue(pending);
    component.load();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Загрузка');
    pending.next([]);
    pending.complete();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('account.apiAccess.empty');
    service.list.mockReturnValueOnce(throwError(() => new Error('example failure')));
    component.load();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'account.apiAccess.loadFailed',
    );
  });
});
