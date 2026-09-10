import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WritableSignal, signal } from '@angular/core';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthModalService } from '../../../../core/auth/auth-modal.service';
import { AccountInfo, AuthService } from '../../../../core/auth/auth.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import {
  chooseSiteSelectOption,
  siteSelectOptionValues,
} from '../../../../testing/site-select-testing';
import { ManagedAccount, ManagedAccountSession } from '../../models/team-workspace.model';
import { TeamWorkspaceService } from '../../services/team-workspace.service';
import { AdminUnsavedChangesService } from '../../services/admin-unsaved-changes.service';
import { TeamMemberDetailPageComponent } from './team-member-detail-page.component';

describe('TeamMemberDetailPageComponent', () => {
  let fixture: ComponentFixture<TeamMemberDetailPageComponent>;
  let service: {
    getAccount: jest.Mock;
    updateAccountRole: jest.Mock;
    updateAccountPassword: jest.Mock;
    activateAccount: jest.Mock;
    deactivateAccount: jest.Mock;
    deleteAccount: jest.Mock;
    listAccountSessions: jest.Mock;
    revokeAccountSession: jest.Mock;
    revokeAllAccountSessions: jest.Mock;
    revokeOtherAccountSessions: jest.Mock;
  };
  let auth: {
    currentUser: WritableSignal<AccountInfo | null>;
    clearLocalSession: jest.Mock;
  };
  let authModal: {
    openLogin: jest.Mock;
  };
  let currentUser: WritableSignal<AccountInfo | null>;
  let router: Router;
  let notifications: {
    success: jest.Mock;
    error: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      getAccount: jest.fn().mockReturnValue(of(account())),
      updateAccountRole: jest.fn().mockReturnValue(of(account({ role: 'moderator' }))),
      updateAccountPassword: jest.fn().mockReturnValue(of(account())),
      activateAccount: jest.fn().mockReturnValue(of(account())),
      deactivateAccount: jest.fn().mockReturnValue(of(account({ isActive: false }))),
      deleteAccount: jest.fn().mockReturnValue(of(undefined)),
      listAccountSessions: jest.fn().mockReturnValue(of({ sessions: sessions() })),
      revokeAccountSession: jest.fn().mockReturnValue(of({ currentSessionRevoked: false })),
      revokeAllAccountSessions: jest.fn().mockReturnValue(of({ currentSessionRevoked: false })),
      revokeOtherAccountSessions: jest.fn().mockReturnValue(of({ currentSessionRevoked: false })),
    };
    currentUser = signal({ username: 'admin', role: 'admin' });
    auth = {
      currentUser,
      clearLocalSession: jest.fn(),
    };
    authModal = {
      openLogin: jest.fn(),
    };
    notifications = {
      success: jest.fn(),
      error: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [TeamMemberDetailPageComponent],
      providers: [
        provideRouter([]),
        provideI18nTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'username' ? 'AdminUser' : null),
              },
            },
          },
        },
        { provide: TeamWorkspaceService, useValue: service },
        { provide: NotificationService, useValue: notifications },
        { provide: AuthService, useValue: auth },
        { provide: AuthModalService, useValue: authModal },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(TeamMemberDetailPageComponent);
    fixture.detectChanges();
  });

  it('loads and renders readonly team member detail', () => {
    expect(service.getAccount).toHaveBeenCalledWith('AdminUser');
    expect(service.listAccountSessions).toHaveBeenCalledWith('AdminUser');
    expect(fixture.nativeElement.textContent).toContain('AdminUser');
    expect(fixture.nativeElement.textContent).toContain('Администратор');
    expect(fixture.nativeElement.textContent).toContain('Активен');
    expect(fixture.nativeElement.textContent).toContain('Firefox on Linux');
    expect(fixture.nativeElement.textContent).toContain('Текущая');
    expect(fixture.nativeElement.textContent).toContain(
      formatExpectedDateTime(sessions()[0]!.lastUsedAt, 'ru-RU'),
    );
    expect(fixture.nativeElement.textContent).not.toContain(sessions()[0]!.lastUsedAt);
    expect(queryByTestId('team-detail-actions-toggle')).toBeNull();
  });

  it('renders session timestamps in the selected language and preserves ISO values', () => {
    const timestamps = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLTimeElement>('[data-testid="team-session-time"]'),
    );

    expect(timestamps).toHaveLength(6);
    expect(timestamps[0]?.dateTime).toBe(sessions()[0]!.createdAt);
    expect(timestamps[0]?.textContent?.trim()).toBe(
      formatExpectedDateTime(sessions()[0]!.createdAt, 'ru-RU'),
    );

    TestBed.inject(I18nService).switchLanguage('en').subscribe();
    fixture.detectChanges();

    expect(timestamps[0]?.textContent?.trim()).toBe(
      formatExpectedDateTime(sessions()[0]!.createdAt, 'en-US'),
    );
  });

  it('renders empty session state', () => {
    service.listAccountSessions.mockReturnValue(of({ sessions: [] }));
    fixture.componentInstance.loadSessions();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Активных сессий нет.');
  });

  it('shows revoke others only while viewing self', () => {
    expect(queryByTestId('team-sessions-revoke-others')).toBeNull();

    currentUser.set({ username: 'AdminUser', role: 'admin' });
    fixture.detectChanges();

    expect(queryByTestId('team-sessions-revoke-others')).not.toBeNull();
  });

  it('revokes sessions and opens login when the current session is revoked', () => {
    currentUser.set({ username: 'AdminUser', role: 'admin' });
    service.revokeAccountSession.mockReturnValue(of({ currentSessionRevoked: true }));
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    fixture.detectChanges();

    elementByTestId<HTMLButtonElement>(
      'team-session-revoke-10000000000040008000000000000001',
    ).click();
    fixture.detectChanges();

    expect(service.revokeAccountSession).toHaveBeenCalledWith(
      'AdminUser',
      '10000000000040008000000000000001',
    );
    expect(auth.clearLocalSession).toHaveBeenCalledTimes(1);
    expect(authModal.openLogin).toHaveBeenCalledTimes(1);
  });

  it('revokes other self sessions without clearing the current session', () => {
    currentUser.set({ username: 'AdminUser', role: 'admin' });
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    fixture.detectChanges();

    elementByTestId<HTMLButtonElement>('team-sessions-revoke-others').click();
    fixture.detectChanges();

    expect(service.revokeOtherAccountSessions).toHaveBeenCalledWith('AdminUser');
    expect(auth.clearLocalSession).not.toHaveBeenCalled();
    expect(authModal.openLogin).not.toHaveBeenCalled();
  });

  it('renders owner account role labels', () => {
    service.getAccount.mockReturnValue(of(account({ username: 'OwnerUser', role: 'owner' })));
    fixture.componentInstance.loadAccount();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('OwnerUser');
    expect(fixture.nativeElement.textContent).toContain('Владелец');
  });

  it('updates role and password through modal forms', () => {
    currentUser.set({ username: 'owner', role: 'owner' });
    fixture.detectChanges();
    openActions();
    elementByTestId<HTMLButtonElement>('team-detail-actions-role').click();
    fixture.detectChanges();
    setInputValue('team-role-role', 'moderator');
    submitForm('team-role-form');

    openActions();
    elementByTestId<HTMLButtonElement>('team-detail-actions-password').click();
    fixture.detectChanges();
    setInputValue('team-password-password', 'new-password');
    submitForm('team-password-form');

    expect(service.updateAccountRole).toHaveBeenCalledWith('AdminUser', 'moderator');
    expect(service.updateAccountPassword).toHaveBeenCalledWith('AdminUser', 'new-password');
    expect(notifications.success).toHaveBeenCalledWith('Роль обновлена.');
    expect(notifications.success).toHaveBeenCalledWith('Пароль обновлён.');
  });

  it('guards changed role and password dialogs and commits successful updates', () => {
    const unsavedChanges = TestBed.inject(AdminUnsavedChangesService);
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    currentUser.set({ username: 'owner', role: 'owner' });
    fixture.componentInstance.openRoleDialog();
    fixture.componentInstance.roleForm.controls.role.setValue('moderator');
    fixture.componentInstance.closeRoleDialog();
    expect(fixture.componentInstance.roleDialogOpen()).toBe(true);
    expect(unsavedChanges.hasChanges()).toBe(true);

    fixture.componentInstance.updateRole();
    expect(unsavedChanges.hasChanges()).toBe(false);

    confirm.mockClear();
    fixture.componentInstance.openPasswordDialog();
    fixture.componentInstance.passwordForm.controls.password.setValue('new-password');
    fixture.componentInstance.closePasswordDialog();
    expect(fixture.componentInstance.passwordDialogOpen()).toBe(true);
    expect(confirm).toHaveBeenCalledTimes(1);

    fixture.componentInstance.updatePassword();
    expect(unsavedChanges.hasChanges()).toBe(false);
  });

  it('deactivates and deletes the current detail account with confirmation', () => {
    currentUser.set({ username: 'owner', role: 'owner' });
    fixture.detectChanges();
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    fixture.componentInstance.deactivateAccount();
    fixture.componentInstance.deleteAccount();

    expect(service.deactivateAccount).toHaveBeenCalledWith('AdminUser');
    expect(service.deleteAccount).toHaveBeenCalledWith('AdminUser');
    expect(notifications.success).toHaveBeenCalledWith('Участник деактивирован.');
    expect(notifications.success).toHaveBeenCalledWith('Участник удалён.');
    expect(router.navigate).toHaveBeenCalledWith(['/admin-panel/workspace/team'], {
      queryParamsHandling: 'preserve',
      replaceUrl: true,
    });
  });

  it('hides unavailable self actions but allows self password updates', () => {
    currentUser.set({ username: 'AdminUser', role: 'admin' });
    fixture.detectChanges();

    openActions();

    expect(queryByTestId('team-detail-actions-role')).toBeNull();
    expect(queryByTestId('team-detail-actions-deactivate')).toBeNull();
    expect(queryByTestId('team-detail-actions-delete')).toBeNull();
    expect(elementByTestId<HTMLButtonElement>('team-detail-actions-password').disabled).toBe(false);
  });

  it('hides owner and admin detail actions from admins', () => {
    service.getAccount.mockReturnValue(of(account({ username: 'OwnerUser', role: 'owner' })));
    fixture.componentInstance.loadAccount();
    fixture.detectChanges();

    expect(queryByTestId('team-detail-actions-toggle')).toBeNull();

    service.getAccount.mockReturnValue(of(account({ username: 'OtherAdmin', role: 'admin' })));
    fixture.componentInstance.loadAccount();
    fixture.detectChanges();

    expect(queryByTestId('team-detail-actions-toggle')).toBeNull();
  });

  it('lets owners manage admin details with admin and moderator role options', () => {
    currentUser.set({ username: 'owner', role: 'owner' });
    service.getAccount.mockReturnValue(of(account({ username: 'OtherAdmin', role: 'admin' })));
    fixture.componentInstance.loadAccount();
    fixture.detectChanges();

    openActions();
    expect(elementByTestId<HTMLButtonElement>('team-detail-actions-role').disabled).toBe(false);
    expect(elementByTestId<HTMLButtonElement>('team-detail-actions-password').disabled).toBe(false);
    expect(elementByTestId<HTMLButtonElement>('team-detail-actions-deactivate').disabled).toBe(
      false,
    );
    expect(elementByTestId<HTMLButtonElement>('team-detail-actions-delete').disabled).toBe(false);

    elementByTestId<HTMLButtonElement>('team-detail-actions-role').click();
    fixture.detectChanges();
    expect(selectOptionValues('team-role-role')).toEqual(['admin', 'moderator']);
  });

  function openActions(): void {
    elementByTestId<HTMLButtonElement>('team-detail-actions-toggle').click();
    fixture.detectChanges();
  }

  function setInputValue(testId: string, value: string): void {
    const input = elementByTestId<HTMLInputElement | HTMLButtonElement>(testId);
    if (input instanceof HTMLButtonElement) {
      chooseSiteSelectOption(fixture, `[data-testid="${testId}"]`, value);
      return;
    }
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function selectOptionValues(testId: string): string[] {
    return siteSelectOptionValues(fixture, `[data-testid="${testId}"]`);
  }

  function submitForm(testId: string): void {
    elementByTestId<HTMLFormElement>(testId).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  function elementByTestId<T extends Element>(testId: string): T {
    const element = fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as T | null;
    expect(element).not.toBeNull();
    return element as T;
  }

  function queryByTestId(testId: string): Element | null {
    return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as Element | null;
  }
});

function account(overrides: Partial<ManagedAccount> = {}): ManagedAccount {
  return {
    username: 'AdminUser',
    role: 'admin',
    isActive: true,
    ...overrides,
  };
}

function sessions(): ManagedAccountSession[] {
  return [
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
    {
      id: '20000000000040008000000000000002',
      userAgentDisplay: 'Chrome on Linux',
      userAgentBrowser: 'Chrome',
      userAgentOs: 'Linux',
      userAgentDevice: 'desktop',
      authMethod: 'password',
      createdAt: '2026-07-06T11:30:00+00:00',
      lastUsedAt: '2026-07-07T11:30:00+00:00',
      expiresAt: '2026-08-06T11:30:00+00:00',
      isCurrent: false,
    },
  ];
}

function formatExpectedDateTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
