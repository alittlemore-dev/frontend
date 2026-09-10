import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WritableSignal, signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { AccountInfo, AuthService } from '../../../../core/auth/auth.service';
import { ApiError } from '../../../../core/models/api-error.model';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import {
  chooseSiteSelectOption,
  siteSelectOptionValues,
} from '../../../../testing/site-select-testing';
import { ManagedAccount, ManagedAccounts } from '../../models/team-workspace.model';
import { TeamWorkspaceService } from '../../services/team-workspace.service';
import { AdminUnsavedChangesService } from '../../services/admin-unsaved-changes.service';
import { TeamPageComponent } from './team-page.component';

describe('TeamPageComponent', () => {
  let fixture: ComponentFixture<TeamPageComponent>;
  let service: {
    listAccounts: jest.Mock;
    createAccount: jest.Mock;
    updateAccountRole: jest.Mock;
    updateAccountPassword: jest.Mock;
    activateAccount: jest.Mock;
    deactivateAccount: jest.Mock;
    deleteAccount: jest.Mock;
  };
  let currentUser: WritableSignal<AccountInfo | null>;
  let router: Router;
  let notifications: {
    success: jest.Mock;
    error: jest.Mock;
  };
  let routeQueryParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(async () => {
    service = {
      listAccounts: jest.fn().mockReturnValue(of(accountsList([account()]))),
      createAccount: jest.fn().mockReturnValue(of(account({ username: 'NewAdmin' }))),
      updateAccountRole: jest.fn().mockReturnValue(of(account({ role: 'moderator' }))),
      updateAccountPassword: jest.fn().mockReturnValue(of(account())),
      activateAccount: jest.fn().mockReturnValue(of(account())),
      deactivateAccount: jest.fn().mockReturnValue(of(account({ isActive: false }))),
      deleteAccount: jest.fn().mockReturnValue(of(undefined)),
    };
    currentUser = signal({ username: 'admin', role: 'admin' });
    notifications = {
      success: jest.fn(),
      error: jest.fn(),
    };
    routeQueryParams = new BehaviorSubject(convertToParamMap({}));

    await TestBed.configureTestingModule({
      imports: [TeamPageComponent],
      providers: [
        provideRouter([]),
        provideI18nTesting(),
        { provide: TeamWorkspaceService, useValue: service },
        { provide: NotificationService, useValue: notifications },
        {
          provide: AuthService,
          useValue: {
            currentUser,
          },
        },
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: routeQueryParams.asObservable() },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(TeamPageComponent);
    fixture.detectChanges();
  });

  it('loads and renders the managed team list', () => {
    expect(service.listAccounts).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
    expect(fixture.nativeElement.textContent).toContain('Команда');
    expect(fixture.nativeElement.textContent).toContain('AdminUser');
    expect(fixture.nativeElement.textContent).toContain('Администратор');
    expect(fixture.nativeElement.textContent).toContain('Активен');
  });

  it('restores pagination from the URL before the first request', () => {
    fixture.destroy();
    service.listAccounts.mockClear();
    service.listAccounts.mockReturnValue(
      of({ ...accountsList([account()]), totalCount: 41, totalPages: 3 }),
    );
    routeQueryParams.next(convertToParamMap({ page: '2' }));

    fixture = TestBed.createComponent(TeamPageComponent);
    fixture.detectChanges();

    expect(service.listAccounts).toHaveBeenCalledTimes(1);
    expect(service.listAccounts).toHaveBeenCalledWith({ page: 2, pageSize: 20 });
  });

  it('renders owner accounts and owner role labels', () => {
    service.listAccounts.mockReturnValue(
      of(accountsList([account({ username: 'OwnerUser', role: 'owner' })])),
    );
    fixture.componentInstance.loadAccounts();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('OwnerUser');
    expect(fixture.nativeElement.textContent).toContain('Владелец');
  });

  it('shows admin and moderator creation role options for owners', () => {
    currentUser.set({ username: 'owner', role: 'owner' });
    fixture.detectChanges();

    openCreateDialog();

    expect(selectOptionValues('team-create-role')).toEqual(['', 'admin', 'moderator']);
  });

  it('shows only moderator creation role options for admins', () => {
    openCreateDialog();

    expect(selectOptionValues('team-create-role')).toEqual(['', 'moderator']);
  });

  it('creates an active managed account and navigates to detail', () => {
    currentUser.set({ username: 'owner', role: 'owner' });
    fixture.detectChanges();
    openCreateDialog();

    setInputValue('team-create-username', 'NewAdmin');
    setInputValue('team-create-role', 'moderator');
    setInputValue('team-create-password', 'password123');
    submitForm('team-create-form');

    expect(service.createAccount).toHaveBeenCalledWith({
      username: 'NewAdmin',
      role: 'moderator',
      password: 'password123',
      isActive: true,
    });
    expect(notifications.success).toHaveBeenCalledWith('Участник создан.');
    expect(router.navigate).toHaveBeenCalledWith(['/admin-panel/workspace/team', 'NewAdmin'], {
      queryParamsHandling: 'preserve',
    });
  });

  it('guards changed create, role, and password dialogs and accepts exact reverts', () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    openCreateDialog();
    setInputValue('team-create-username', 'DraftUser');
    fixture.componentInstance.closeCreateDialog();
    expect(fixture.componentInstance.createDialogOpen()).toBe(true);

    setInputValue('team-create-username', '');
    fixture.componentInstance.closeCreateDialog();
    expect(fixture.componentInstance.createDialogOpen()).toBe(false);

    currentUser.set({ username: 'owner', role: 'owner' });
    fixture.componentInstance.openRoleDialog(account());
    fixture.componentInstance.roleForm.controls.role.setValue('moderator');
    fixture.componentInstance.closeRoleDialog();
    expect(fixture.componentInstance.roleDialogOpen()).toBe(true);

    fixture.componentInstance.openPasswordDialog(account());
    fixture.componentInstance.passwordForm.controls.password.setValue('new-password');
    fixture.componentInstance.closePasswordDialog();
    expect(fixture.componentInstance.passwordDialogOpen()).toBe(true);
    expect(confirm).toHaveBeenCalledTimes(3);
  });

  it('keeps failed modal updates dirty and commits successful updates', () => {
    const unsavedChanges = TestBed.inject(AdminUnsavedChangesService);
    currentUser.set({ username: 'owner', role: 'owner' });
    service.updateAccountRole.mockReturnValueOnce(throwError(() => apiError()));
    fixture.componentInstance.openRoleDialog(account());
    fixture.componentInstance.roleForm.controls.role.setValue('moderator');

    fixture.componentInstance.updateRole();
    expect(unsavedChanges.hasChanges()).toBe(true);

    service.updateAccountRole.mockReturnValueOnce(of(account({ role: 'moderator' })));
    fixture.componentInstance.updateRole();
    expect(unsavedChanges.hasChanges()).toBe(false);
  });

  it('marks invalid usernames before calling the create endpoint', () => {
    openCreateDialog();

    setInputValue('team-create-username', 'кириллица');
    setInputValue('team-create-role', 'moderator');
    setInputValue('team-create-password', 'password123');
    submitForm('team-create-form');

    const username = elementByTestId<HTMLInputElement>('team-create-username');
    expect(username.classList).toContain('is-invalid');
    expect(service.createAccount).not.toHaveBeenCalled();
    expect(notifications.error).toHaveBeenCalledWith('Проверьте поля участника.');
  });

  it('hides unavailable self actions in the row dropdown', () => {
    service.listAccounts.mockReturnValue(of(accountsList([account({ username: 'admin' })])));
    fixture.componentInstance.loadAccounts();
    fixture.detectChanges();

    openActions('admin');

    expect(queryByTestId('team-actions-admin-role')).toBeNull();
    expect(queryByTestId('team-actions-admin-deactivate')).toBeNull();
    expect(queryByTestId('team-actions-admin-delete')).toBeNull();
    expect(elementByTestId<HTMLButtonElement>('team-actions-admin-password').disabled).toBe(false);
  });

  it('hides privileged owner and admin row actions from admins', () => {
    service.listAccounts.mockReturnValue(
      of(
        accountsList([
          account({ username: 'OwnerUser', role: 'owner' }),
          account({ username: 'OtherAdmin', role: 'admin' }),
        ]),
      ),
    );
    fixture.componentInstance.loadAccounts();
    fixture.detectChanges();

    openActions('OwnerUser');
    expect(elementByTestId<HTMLButtonElement>('team-actions-OwnerUser-detail')).not.toBeNull();
    expect(queryByTestId('team-actions-OwnerUser-role')).toBeNull();
    expect(queryByTestId('team-actions-OwnerUser-password')).toBeNull();
    expect(queryByTestId('team-actions-OwnerUser-deactivate')).toBeNull();
    expect(queryByTestId('team-actions-OwnerUser-delete')).toBeNull();

    openActions('OtherAdmin');
    expect(elementByTestId<HTMLButtonElement>('team-actions-OtherAdmin-detail')).not.toBeNull();
    expect(queryByTestId('team-actions-OtherAdmin-role')).toBeNull();
    expect(queryByTestId('team-actions-OtherAdmin-password')).toBeNull();
    expect(queryByTestId('team-actions-OtherAdmin-deactivate')).toBeNull();
    expect(queryByTestId('team-actions-OtherAdmin-delete')).toBeNull();
  });

  it('lets admins manage moderator rows except hidden role changes', () => {
    service.listAccounts.mockReturnValue(
      of(accountsList([account({ username: 'Moderator1', role: 'moderator' })])),
    );
    fixture.componentInstance.loadAccounts();
    fixture.detectChanges();

    openActions('Moderator1');

    expect(queryByTestId('team-actions-Moderator1-role')).toBeNull();
    expect(elementByTestId<HTMLButtonElement>('team-actions-Moderator1-password').disabled).toBe(
      false,
    );
    expect(elementByTestId<HTMLButtonElement>('team-actions-Moderator1-deactivate').disabled).toBe(
      false,
    );
    expect(elementByTestId<HTMLButtonElement>('team-actions-Moderator1-delete').disabled).toBe(
      false,
    );
  });

  it('lets owners manage admin rows', () => {
    currentUser.set({ username: 'owner', role: 'owner' });
    service.listAccounts.mockReturnValue(
      of(accountsList([account({ username: 'OtherAdmin', role: 'admin' })])),
    );
    fixture.componentInstance.loadAccounts();
    fixture.detectChanges();

    openActions('OtherAdmin');

    expect(elementByTestId<HTMLButtonElement>('team-actions-OtherAdmin-role').disabled).toBe(false);
    expect(elementByTestId<HTMLButtonElement>('team-actions-OtherAdmin-password').disabled).toBe(
      false,
    );
    expect(elementByTestId<HTMLButtonElement>('team-actions-OtherAdmin-deactivate').disabled).toBe(
      false,
    );
    expect(elementByTestId<HTMLButtonElement>('team-actions-OtherAdmin-delete').disabled).toBe(
      false,
    );
  });

  it('activates, deactivates, and deletes accounts from row actions with feedback', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    service.listAccounts.mockReturnValue(
      of(accountsList([account({ username: 'Moderator1', role: 'moderator', isActive: false })])),
    );
    fixture.componentInstance.loadAccounts();
    fixture.detectChanges();

    openActions('Moderator1');
    elementByTestId<HTMLButtonElement>('team-actions-Moderator1-activate').click();
    fixture.detectChanges();

    fixture.componentInstance.deactivateAccount(
      account({ username: 'Moderator1', role: 'moderator', isActive: true }),
    );
    fixture.componentInstance.deleteAccount(account({ username: 'Moderator1', role: 'moderator' }));

    expect(service.activateAccount).toHaveBeenCalledWith('Moderator1');
    expect(service.deactivateAccount).toHaveBeenCalledWith('Moderator1');
    expect(service.deleteAccount).toHaveBeenCalledWith('Moderator1');
    expect(notifications.success).toHaveBeenCalledWith('Участник активирован.');
    expect(notifications.success).toHaveBeenCalledWith('Участник деактивирован.');
    expect(notifications.success).toHaveBeenCalledWith('Участник удалён.');
  });

  it('shows an API error notification on create failure', () => {
    service.createAccount.mockReturnValue(throwError(() => apiError()));
    openCreateDialog();

    setInputValue('team-create-username', 'NewAdmin');
    setInputValue('team-create-role', 'moderator');
    setInputValue('team-create-password', 'password123');
    submitForm('team-create-form');

    expect(notifications.error).toHaveBeenCalledWith('Не удалось создать участника.');
  });

  function openCreateDialog(): void {
    elementByTestId<HTMLButtonElement>('team-create-open').click();
    fixture.detectChanges();
  }

  function openActions(username: string): void {
    elementByTestId<HTMLButtonElement>(`team-actions-${username}-toggle`).click();
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

function accountsList(accounts: ManagedAccount[]): ManagedAccounts {
  return {
    totalCount: accounts.length,
    totalPages: accounts.length > 0 ? 1 : 0,
    accounts,
  };
}

function account(overrides: Partial<ManagedAccount> = {}): ManagedAccount {
  return {
    username: 'AdminUser',
    role: 'admin',
    isActive: true,
    ...overrides,
  };
}

function apiError(): ApiError {
  return {
    code: 'bad_request',
    type: 'BadRequest',
    message: 'Bad request',
    location: null,
    attr: null,
  };
}
