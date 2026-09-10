import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ModalScrollDirective } from '../../../../core/layout/modal-scroll.directive';
import { ApiError } from '../../../../core/models/api-error.model';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorMessageComponent } from '../../../../shared/ui/error-message/error-message.component';
import { LoadingSpinnerComponent } from '../../../../shared/ui/loading-spinner/loading-spinner.component';
import {
  SiteSelectComponent,
  SiteSelectOption,
} from '../../../../shared/ui/site-select/site-select.component';
import {
  AdminAction,
  AdminActionsDropdownComponent,
} from '../../components/admin-actions-dropdown/admin-actions-dropdown.component';
import { AdminControlValidationStateDirective } from '../../directives/admin-control-validation-state.directive';
import {
  EditableManagedAccountRole,
  ManagedAccount,
  ManagedAccountRole,
  ManagedAccounts,
} from '../../models/team-workspace.model';
import { TeamWorkspaceService } from '../../services/team-workspace.service';
import {
  AdminUnsavedChangesService,
  AdminUnsavedChangesSource,
} from '../../services/admin-unsaved-changes.service';
import {
  ADMIN_ACCOUNT_USERNAME_PATTERN_ATTRIBUTE,
  ADMIN_VALIDATION_LIMITS,
  accountUsernameValidator,
  controlInvalid,
  trimRequired,
  validationMessage,
} from '../../utils/admin-validation';
import {
  canonicalQueryMatches,
  queryNumber,
  readPositiveIntegerQuery,
  replaceAdminQueryParams,
} from '../../utils/admin-query-state';

const PAGE_SIZE = 20;
const TEAM_QUERY_KEYS = ['page'] as const;
type TeamCreateField = 'username' | 'role' | 'password';
type TeamRoleField = 'role';
type TeamPasswordField = 'password';

interface ManagedAccountRoleOption {
  value: EditableManagedAccountRole;
  labelKey: string;
}

const MANAGED_ACCOUNT_ROLE_OPTIONS: readonly ManagedAccountRoleOption[] = [
  { value: 'admin', labelKey: 'enum.role.admin' },
  { value: 'moderator', labelKey: 'enum.role.moderator' },
];

@Component({
  selector: 'app-team-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
    LoadingSpinnerComponent,
    ErrorMessageComponent,
    EmptyStateComponent,
    AdminActionsDropdownComponent,
    AdminControlValidationStateDirective,
    ModalScrollDirective,
    SiteSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './team-page.component.html',
})
export class TeamPageComponent implements OnInit {
  private readonly teamWorkspace = inject(TeamWorkspaceService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly auth = inject(AuthService);
  private readonly unsavedChangesScope = inject(AdminUnsavedChangesService).createScope(
    this.destroyRef,
  );
  private readonly createFormUnsavedSource: AdminUnsavedChangesSource;
  private readonly roleFormUnsavedSource: AdminUnsavedChangesSource;
  private readonly passwordFormUnsavedSource: AdminUnsavedChangesSource;
  private currentQueryParams: ParamMap | null = null;
  private skipNextCanonicalLoad: Record<string, string | null> | null = null;

  readonly page = signal(1);
  readonly accounts = signal<ManagedAccounts | null>(null);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly createDialogOpen = signal(false);
  readonly createSubmitting = signal(false);
  readonly createFormSubmitted = signal(false);
  readonly createError = signal<ApiError | null>(null);
  readonly roleDialogOpen = signal(false);
  readonly roleSubmitting = signal(false);
  readonly roleFormSubmitted = signal(false);
  readonly roleError = signal<ApiError | null>(null);
  readonly passwordDialogOpen = signal(false);
  readonly passwordSubmitting = signal(false);
  readonly passwordFormSubmitted = signal(false);
  readonly passwordError = signal<ApiError | null>(null);
  readonly selectedAccount = signal<ManagedAccount | null>(null);
  readonly createFormSnapshot = signal({ username: '', role: '', password: '' });
  readonly roleFormSnapshot = signal({ role: '' });
  readonly passwordFormSnapshot = signal({ password: '' });
  readonly roleOptions = computed<readonly ManagedAccountRoleOption[]>(() =>
    this.currentUserRole() === 'owner'
      ? MANAGED_ACCOUNT_ROLE_OPTIONS
      : MANAGED_ACCOUNT_ROLE_OPTIONS.filter((role) => role.value === 'moderator'),
  );
  readonly createRoleSelectOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    return [
      { value: '', label: this.i18n.translate('shared.notSet') },
      ...this.roleOptions().map((role) => ({
        value: role.value,
        label: this.i18n.translate(role.labelKey),
      })),
    ];
  });
  readonly roleSelectOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    return this.roleOptions().map((role) => ({
      value: role.value,
      label: this.i18n.translate(role.labelKey),
    }));
  });
  readonly validationLimits = ADMIN_VALIDATION_LIMITS;
  readonly usernamePattern = ADMIN_ACCOUNT_USERNAME_PATTERN_ATTRIBUTE;
  readonly currentUsername = computed(() => this.auth.currentUser()?.username ?? '');
  readonly currentUserRole = computed(() => this.auth.currentUser()?.role ?? 'anon');

  readonly createForm = this.formBuilder.group({
    username: [
      '',
      [
        trimRequired,
        Validators.minLength(ADMIN_VALIDATION_LIMITS.accountUsernameMin),
        Validators.maxLength(ADMIN_VALIDATION_LIMITS.shortText),
        accountUsernameValidator,
      ],
    ],
    role: ['', trimRequired],
    password: [
      '',
      [
        trimRequired,
        Validators.minLength(ADMIN_VALIDATION_LIMITS.accountPasswordMin),
        Validators.maxLength(ADMIN_VALIDATION_LIMITS.shortText),
      ],
    ],
  });

  readonly roleForm = this.formBuilder.group({
    role: ['', trimRequired],
  });

  readonly passwordForm = this.formBuilder.group({
    password: [
      '',
      [
        trimRequired,
        Validators.minLength(ADMIN_VALIDATION_LIMITS.accountPasswordMin),
        Validators.maxLength(ADMIN_VALIDATION_LIMITS.shortText),
      ],
    ],
  });

  constructor() {
    this.createFormSnapshot.set(this.createForm.getRawValue());
    this.roleFormSnapshot.set(this.roleForm.getRawValue());
    this.passwordFormSnapshot.set(this.passwordForm.getRawValue());
    this.createFormUnsavedSource = this.unsavedChangesScope.registerSource(
      this.createFormSnapshot,
      this.createDialogOpen,
    );
    this.roleFormUnsavedSource = this.unsavedChangesScope.registerSource(
      this.roleFormSnapshot,
      this.roleDialogOpen,
    );
    this.passwordFormUnsavedSource = this.unsavedChangesScope.registerSource(
      this.passwordFormSnapshot,
      this.passwordDialogOpen,
    );
    this.createForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.createFormSnapshot.set(this.createForm.getRawValue());
    });
    this.roleForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.roleFormSnapshot.set(this.roleForm.getRawValue());
    });
    this.passwordForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.passwordFormSnapshot.set(this.passwordForm.getRawValue());
    });
  }

  ngOnInit(): void {
    this.setupQueryState();
  }

  loadAccounts(): void {
    this.loading.set(true);
    this.error.set(null);
    this.teamWorkspace
      .listAccounts({ page: this.page(), pageSize: PAGE_SIZE })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (accounts) => {
          const lastPage = Math.max(1, accounts.totalPages);
          if (this.page() > lastPage) {
            this.commitPage(lastPage);
            return;
          }
          this.accounts.set(accounts);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err);
          this.loading.set(false);
          this.notifications.error(this.i18n.translate('adminTeamWorkspace.loadError'));
        },
      });
  }

  previousPage(): void {
    if (this.page() <= 1) return;
    this.commitPage(this.page() - 1);
  }

  nextPage(): void {
    if (this.page() >= (this.accounts()?.totalPages ?? 1)) return;
    this.commitPage(this.page() + 1);
  }

  openCreateDialog(): void {
    this.createForm.reset({
      username: '',
      role: '',
      password: '',
    });
    this.createError.set(null);
    this.createSubmitting.set(false);
    this.createFormSubmitted.set(false);
    this.createFormUnsavedSource.commit();
    this.createDialogOpen.set(true);
  }

  closeCreateDialog(): void {
    if (this.createSubmitting()) return;
    if (!this.unsavedChangesScope.confirmDiscard()) return;
    this.createDialogOpen.set(false);
    this.createError.set(null);
    this.createFormSubmitted.set(false);
  }

  createAccount(): void {
    this.createFormSubmitted.set(true);
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      this.notifications.error(this.i18n.translate('adminTeamWorkspace.validationError'));
      return;
    }
    this.createSubmitting.set(true);
    this.createError.set(null);
    const value = this.createForm.getRawValue();
    this.teamWorkspace
      .createAccount({
        username: value.username.trim(),
        role: toManagedAccountRole(value.role),
        password: value.password,
        isActive: true,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (account) => {
          this.createSubmitting.set(false);
          this.createFormUnsavedSource.commit();
          this.createDialogOpen.set(false);
          this.notifications.success(this.i18n.translate('adminTeamWorkspace.created'));
          void this.router.navigate(['/admin-panel/workspace/team', account.username], {
            queryParamsHandling: 'preserve',
          });
        },
        error: (err: ApiError) => {
          this.createError.set(err);
          this.createSubmitting.set(false);
          this.notifications.error(this.i18n.translate('adminTeamWorkspace.createError'));
        },
      });
  }

  accountActions(account: ManagedAccount): AdminAction[] {
    const statusAction: AdminAction = account.isActive
      ? {
          id: 'deactivate',
          label: this.i18n.translate('adminTeamWorkspace.action.deactivate'),
          destructive: true,
          disabled: !this.canDeactivateAccount(account),
        }
      : {
          id: 'activate',
          label: this.i18n.translate('adminTeamWorkspace.action.activate'),
          destructive: false,
          disabled: !this.canActivateAccount(account),
        };
    return [
      {
        id: 'detail',
        label: this.i18n.translate('adminTeamWorkspace.action.open'),
        destructive: false,
        disabled: false,
      },
      {
        id: 'role',
        label: this.i18n.translate('adminTeamWorkspace.action.changeRole'),
        destructive: false,
        disabled: !this.canUpdateAccountRole(account),
      },
      {
        id: 'password',
        label: this.i18n.translate('adminTeamWorkspace.action.changePassword'),
        destructive: false,
        disabled: !this.canUpdateAccountPassword(account),
      },
      statusAction,
      {
        id: 'delete',
        label: this.i18n.translate('shared.delete'),
        destructive: true,
        disabled: !this.canDeleteAccount(account),
      },
    ];
  }

  handleAccountAction(actionId: string, account: ManagedAccount): void {
    switch (actionId) {
      case 'detail':
        void this.router.navigate(['/admin-panel/workspace/team', account.username], {
          queryParamsHandling: 'preserve',
        });
        return;
      case 'role':
        this.openRoleDialog(account);
        return;
      case 'password':
        this.openPasswordDialog(account);
        return;
      case 'activate':
        this.activateAccount(account);
        return;
      case 'deactivate':
        this.deactivateAccount(account);
        return;
      case 'delete':
        this.deleteAccount(account);
        return;
      default:
        throw new Error(`Unsupported team account action: ${actionId}`);
    }
  }

  private setupQueryState(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.currentQueryParams = params;
      const page = readPositiveIntegerQuery(params, 'page', 1).value;
      const canonical = { page: queryNumber(page, 1) };
      if (
        this.skipNextCanonicalLoad !== null &&
        canonicalQueryMatches(params, TEAM_QUERY_KEYS, this.skipNextCanonicalLoad)
      ) {
        this.skipNextCanonicalLoad = null;
        return;
      }
      this.page.set(page);
      if (!canonicalQueryMatches(params, TEAM_QUERY_KEYS, canonical)) {
        this.replacePageAndLoad(page, canonical);
        return;
      }
      this.loadAccounts();
    });
  }

  private commitPage(page: number): void {
    const canonical = { page: queryNumber(page, 1) };
    if (
      this.currentQueryParams !== null &&
      canonicalQueryMatches(this.currentQueryParams, TEAM_QUERY_KEYS, canonical)
    ) {
      this.loadAccounts();
      return;
    }
    this.replacePageAndLoad(page, canonical);
  }

  private replacePageAndLoad(page: number, canonical: Record<string, string | null>): void {
    this.page.set(page);
    this.skipNextCanonicalLoad = canonical;
    void replaceAdminQueryParams(this.router, this.route, canonical);
    this.loadAccounts();
  }

  openRoleDialog(account: ManagedAccount): void {
    if (!this.canUpdateAccountRole(account)) return;
    this.selectedAccount.set(account);
    this.roleForm.reset({ role: account.role });
    this.roleError.set(null);
    this.roleSubmitting.set(false);
    this.roleFormSubmitted.set(false);
    this.roleFormUnsavedSource.commit();
    this.roleDialogOpen.set(true);
  }

  closeRoleDialog(): void {
    if (this.roleSubmitting()) return;
    if (!this.unsavedChangesScope.confirmDiscard()) return;
    this.roleDialogOpen.set(false);
    this.roleError.set(null);
    this.roleFormSubmitted.set(false);
  }

  updateRole(): void {
    const account = this.selectedAccount();
    if (account === null) return;
    this.roleFormSubmitted.set(true);
    if (this.roleForm.invalid) {
      this.roleForm.markAllAsTouched();
      this.notifications.error(this.i18n.translate('adminTeamWorkspace.validationError'));
      return;
    }
    this.roleSubmitting.set(true);
    this.roleError.set(null);
    const value = this.roleForm.getRawValue();
    this.teamWorkspace
      .updateAccountRole(account.username, toManagedAccountRole(value.role))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updatedAccount) => {
          this.roleSubmitting.set(false);
          this.roleForm.reset({ role: updatedAccount.role });
          this.roleFormUnsavedSource.commit();
          this.roleDialogOpen.set(false);
          this.replaceAccount(updatedAccount);
          this.notifications.success(this.i18n.translate('adminTeamWorkspace.roleUpdated'));
        },
        error: (err: ApiError) => {
          this.roleError.set(err);
          this.roleSubmitting.set(false);
          this.notifications.error(this.i18n.translate('adminTeamWorkspace.roleUpdateError'));
        },
      });
  }

  openPasswordDialog(account: ManagedAccount): void {
    if (!this.canUpdateAccountPassword(account)) return;
    this.selectedAccount.set(account);
    this.passwordForm.reset({ password: '' });
    this.passwordError.set(null);
    this.passwordSubmitting.set(false);
    this.passwordFormSubmitted.set(false);
    this.passwordFormUnsavedSource.commit();
    this.passwordDialogOpen.set(true);
  }

  closePasswordDialog(): void {
    if (this.passwordSubmitting()) return;
    if (!this.unsavedChangesScope.confirmDiscard()) return;
    this.passwordDialogOpen.set(false);
    this.passwordError.set(null);
    this.passwordFormSubmitted.set(false);
  }

  updatePassword(): void {
    const account = this.selectedAccount();
    if (account === null) return;
    this.passwordFormSubmitted.set(true);
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      this.notifications.error(this.i18n.translate('adminTeamWorkspace.validationError'));
      return;
    }
    this.passwordSubmitting.set(true);
    this.passwordError.set(null);
    const value = this.passwordForm.getRawValue();
    this.teamWorkspace
      .updateAccountPassword(account.username, value.password)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.passwordSubmitting.set(false);
          this.passwordForm.reset({ password: '' });
          this.passwordFormUnsavedSource.commit();
          this.passwordDialogOpen.set(false);
          this.notifications.success(this.i18n.translate('adminTeamWorkspace.passwordUpdated'));
        },
        error: (err: ApiError) => {
          this.passwordError.set(err);
          this.passwordSubmitting.set(false);
          this.notifications.error(this.i18n.translate('adminTeamWorkspace.passwordUpdateError'));
        },
      });
  }

  activateAccount(account: ManagedAccount): void {
    if (!this.canActivateAccount(account)) return;
    this.teamWorkspace
      .activateAccount(account.username)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updatedAccount) => {
          this.replaceAccount(updatedAccount);
          this.notifications.success(this.i18n.translate('adminTeamWorkspace.activated'));
        },
        error: () =>
          this.notifications.error(this.i18n.translate('adminTeamWorkspace.activateError')),
      });
  }

  deactivateAccount(account: ManagedAccount): void {
    if (!this.canDeactivateAccount(account)) return;
    if (
      this.document.defaultView?.confirm(
        this.i18n.translate('adminTeamWorkspace.confirmDeactivate'),
      ) !== true
    ) {
      return;
    }
    this.teamWorkspace
      .deactivateAccount(account.username)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updatedAccount) => {
          this.replaceAccount(updatedAccount);
          this.notifications.success(this.i18n.translate('adminTeamWorkspace.deactivated'));
        },
        error: () =>
          this.notifications.error(this.i18n.translate('adminTeamWorkspace.deactivateError')),
      });
  }

  deleteAccount(account: ManagedAccount): void {
    if (!this.canDeleteAccount(account)) return;
    if (
      this.document.defaultView?.confirm(
        this.i18n.translate('adminTeamWorkspace.confirmDelete'),
      ) !== true
    ) {
      return;
    }
    this.teamWorkspace
      .deleteAccount(account.username)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notifications.success(this.i18n.translate('adminTeamWorkspace.deleted'));
          if ((this.accounts()?.accounts.length ?? 0) <= 1 && this.page() > 1) {
            this.page.update((page) => page - 1);
          }
          this.loadAccounts();
        },
        error: () =>
          this.notifications.error(this.i18n.translate('adminTeamWorkspace.deleteError')),
      });
  }

  roleLabelKey(role: ManagedAccountRole): string {
    if (role === 'owner') return 'enum.role.owner';
    return role === 'admin' ? 'enum.role.admin' : 'enum.role.moderator';
  }

  statusLabelKey(account: ManagedAccount): string {
    return account.isActive
      ? 'adminTeamWorkspace.status.active'
      : 'adminTeamWorkspace.status.inactive';
  }

  isSelfAccount(account: ManagedAccount): boolean {
    const currentUsername = this.currentUsername();
    return (
      currentUsername.trim() !== '' &&
      account.username.toLocaleLowerCase() === currentUsername.toLocaleLowerCase()
    );
  }

  canUpdateAccountRole(account: ManagedAccount): boolean {
    return (
      this.currentUserRole() === 'owner' && !this.isSelfAccount(account) && account.role !== 'owner'
    );
  }

  canUpdateAccountPassword(account: ManagedAccount): boolean {
    return this.isSelfAccount(account) || this.canManageAccount(account);
  }

  canActivateAccount(account: ManagedAccount): boolean {
    return this.canManageAccount(account);
  }

  canDeactivateAccount(account: ManagedAccount): boolean {
    return this.canManageAccount(account);
  }

  canDeleteAccount(account: ManagedAccount): boolean {
    return this.canManageAccount(account);
  }

  createFieldInvalid(field: TeamCreateField): boolean {
    return controlInvalid(this.createForm.controls[field], this.createFormSubmitted());
  }

  createFieldMessage(field: TeamCreateField): string | null {
    return validationMessage(this.createForm.controls[field], this.i18n);
  }

  roleFieldInvalid(field: TeamRoleField): boolean {
    return controlInvalid(this.roleForm.controls[field], this.roleFormSubmitted());
  }

  roleFieldMessage(field: TeamRoleField): string | null {
    return validationMessage(this.roleForm.controls[field], this.i18n);
  }

  passwordFieldInvalid(field: TeamPasswordField): boolean {
    return controlInvalid(this.passwordForm.controls[field], this.passwordFormSubmitted());
  }

  passwordFieldMessage(field: TeamPasswordField): string | null {
    return validationMessage(this.passwordForm.controls[field], this.i18n);
  }

  private replaceAccount(updatedAccount: ManagedAccount): void {
    this.accounts.update((accounts) => {
      if (accounts === null) return null;
      return {
        ...accounts,
        accounts: accounts.accounts.map((account) =>
          account.username === updatedAccount.username ? updatedAccount : account,
        ),
      };
    });
  }

  private canManageAccount(account: ManagedAccount): boolean {
    if (this.isSelfAccount(account)) return false;
    const actorRole = this.currentUserRole();
    if (actorRole === 'owner') return true;
    return actorRole === 'admin' && account.role === 'moderator';
  }
}

function toManagedAccountRole(value: string): EditableManagedAccountRole {
  if (value === 'admin' || value === 'moderator') return value;
  throw new Error(`Unsupported managed account role: ${value}`);
}
