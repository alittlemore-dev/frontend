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
import { ActivatedRoute, Router } from '@angular/router';
import { AuthModalService } from '../../../../core/auth/auth-modal.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ModalScrollDirective } from '../../../../core/layout/modal-scroll.directive';
import { ApiError } from '../../../../core/models/api-error.model';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { ErrorMessageComponent } from '../../../../shared/ui/error-message/error-message.component';
import { LoadingSpinnerComponent } from '../../../../shared/ui/loading-spinner/loading-spinner.component';
import {
  SiteSelectComponent,
  SiteSelectOption,
} from '../../../../shared/ui/site-select/site-select.component';
import { formatLocalizedDate } from '../../../../shared/utils/localized-date';
import {
  AdminAction,
  AdminActionsDropdownComponent,
} from '../../components/admin-actions-dropdown/admin-actions-dropdown.component';
import { AdminControlValidationStateDirective } from '../../directives/admin-control-validation-state.directive';
import {
  EditableManagedAccountRole,
  ManagedAccount,
  ManagedAccountRole,
  ManagedAccountSession,
  ManagedAccountSessionAuthMethod,
  ManagedAccountSessionDevice,
  ManagedAccountSessionRevocation,
} from '../../models/team-workspace.model';
import { TeamWorkspaceService } from '../../services/team-workspace.service';
import {
  AdminUnsavedChangesService,
  AdminUnsavedChangesSource,
} from '../../services/admin-unsaved-changes.service';
import {
  ADMIN_VALIDATION_LIMITS,
  controlInvalid,
  trimRequired,
  validationMessage,
} from '../../utils/admin-validation';

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
  selector: 'app-team-member-detail-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    LoadingSpinnerComponent,
    ErrorMessageComponent,
    AdminActionsDropdownComponent,
    AdminControlValidationStateDirective,
    ModalScrollDirective,
    SiteSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './team-member-detail-page.component.html',
})
export class TeamMemberDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly teamWorkspace = inject(TeamWorkspaceService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly auth = inject(AuthService);
  private readonly authModal = inject(AuthModalService);
  private readonly username = this.resolveUsername();
  private readonly unsavedChangesScope = inject(AdminUnsavedChangesService).createScope(
    this.destroyRef,
  );
  private readonly roleFormUnsavedSource: AdminUnsavedChangesSource;
  private readonly passwordFormUnsavedSource: AdminUnsavedChangesSource;

  readonly account = signal<ManagedAccount | null>(null);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly roleDialogOpen = signal(false);
  readonly roleSubmitting = signal(false);
  readonly roleFormSubmitted = signal(false);
  readonly roleError = signal<ApiError | null>(null);
  readonly passwordDialogOpen = signal(false);
  readonly passwordSubmitting = signal(false);
  readonly passwordFormSubmitted = signal(false);
  readonly passwordError = signal<ApiError | null>(null);
  readonly sessions = signal<ManagedAccountSession[]>([]);
  readonly sessionsLoading = signal(false);
  readonly sessionsError = signal<ApiError | null>(null);
  readonly sessionActionSubmitting = signal<string | null>(null);
  readonly roleFormSnapshot = signal({ role: '' });
  readonly passwordFormSnapshot = signal({ password: '' });
  readonly roleOptions = computed<readonly ManagedAccountRoleOption[]>(() =>
    this.currentUserRole() === 'owner'
      ? MANAGED_ACCOUNT_ROLE_OPTIONS
      : MANAGED_ACCOUNT_ROLE_OPTIONS.filter((role) => role.value === 'moderator'),
  );
  readonly roleSelectOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    return this.roleOptions().map((role) => ({
      value: role.value,
      label: this.i18n.translate(role.labelKey),
    }));
  });
  readonly canRevokeOtherSessions = computed(() => {
    const account = this.account();
    return (
      account !== null &&
      this.isSelfAccount(account) &&
      this.sessions().some((session) => !session.isCurrent)
    );
  });
  readonly validationLimits = ADMIN_VALIDATION_LIMITS;
  readonly currentUsername = computed(() => this.auth.currentUser()?.username ?? '');
  readonly currentUserRole = computed(() => this.auth.currentUser()?.role ?? 'anon');

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
    this.roleFormSnapshot.set(this.roleForm.getRawValue());
    this.passwordFormSnapshot.set(this.passwordForm.getRawValue());
    this.roleFormUnsavedSource = this.unsavedChangesScope.registerSource(
      this.roleFormSnapshot,
      this.roleDialogOpen,
    );
    this.passwordFormUnsavedSource = this.unsavedChangesScope.registerSource(
      this.passwordFormSnapshot,
      this.passwordDialogOpen,
    );
    this.roleForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.roleFormSnapshot.set(this.roleForm.getRawValue());
    });
    this.passwordForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.passwordFormSnapshot.set(this.passwordForm.getRawValue());
    });
  }

  ngOnInit(): void {
    this.loadAccount();
    this.loadSessions();
  }

  loadAccount(): void {
    this.loading.set(true);
    this.error.set(null);
    this.teamWorkspace
      .getAccount(this.username)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (account) => {
          this.account.set(account);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err);
          this.loading.set(false);
          this.notifications.error(this.i18n.translate('adminTeamWorkspace.loadDetailError'));
        },
      });
  }

  loadSessions(): void {
    this.sessionsLoading.set(true);
    this.sessionsError.set(null);
    this.teamWorkspace
      .listAccountSessions(this.username)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sessions) => {
          this.sessions.set(sessions.sessions);
          this.sessionsLoading.set(false);
        },
        error: (err: ApiError) => {
          this.sessionsError.set(err);
          this.sessionsLoading.set(false);
          this.notifications.error(this.i18n.translate('adminTeamWorkspace.sessions.loadError'));
        },
      });
  }

  goBack(): void {
    this.navigateToList();
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

  handleAccountAction(actionId: string): void {
    switch (actionId) {
      case 'role':
        this.openRoleDialog();
        return;
      case 'password':
        this.openPasswordDialog();
        return;
      case 'activate':
        this.activateAccount();
        return;
      case 'deactivate':
        this.deactivateAccount();
        return;
      case 'delete':
        this.deleteAccount();
        return;
      default:
        throw new Error(`Unsupported team account detail action: ${actionId}`);
    }
  }

  openRoleDialog(): void {
    const account = this.account();
    if (account === null || !this.canUpdateAccountRole(account)) return;
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
    const account = this.account();
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
          this.account.set(updatedAccount);
          this.roleSubmitting.set(false);
          this.roleForm.reset({ role: updatedAccount.role });
          this.roleFormUnsavedSource.commit();
          this.roleDialogOpen.set(false);
          this.notifications.success(this.i18n.translate('adminTeamWorkspace.roleUpdated'));
        },
        error: (err: ApiError) => {
          this.roleError.set(err);
          this.roleSubmitting.set(false);
          this.notifications.error(this.i18n.translate('adminTeamWorkspace.roleUpdateError'));
        },
      });
  }

  openPasswordDialog(): void {
    const account = this.account();
    if (account === null || !this.canUpdateAccountPassword(account)) return;
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
    const account = this.account();
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

  activateAccount(): void {
    const account = this.account();
    if (account === null || !this.canActivateAccount(account)) return;
    this.teamWorkspace
      .activateAccount(account.username)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updatedAccount) => {
          this.account.set(updatedAccount);
          this.notifications.success(this.i18n.translate('adminTeamWorkspace.activated'));
        },
        error: () =>
          this.notifications.error(this.i18n.translate('adminTeamWorkspace.activateError')),
      });
  }

  deactivateAccount(): void {
    const account = this.account();
    if (account === null || !this.canDeactivateAccount(account)) return;
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
          this.account.set(updatedAccount);
          this.notifications.success(this.i18n.translate('adminTeamWorkspace.deactivated'));
        },
        error: () =>
          this.notifications.error(this.i18n.translate('adminTeamWorkspace.deactivateError')),
      });
  }

  deleteAccount(): void {
    const account = this.account();
    if (account === null || !this.canDeleteAccount(account)) return;
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
          this.navigateToList();
        },
        error: () =>
          this.notifications.error(this.i18n.translate('adminTeamWorkspace.deleteError')),
      });
  }

  private navigateToList(): void {
    void this.router.navigate(['/admin-panel/workspace/team'], {
      queryParamsHandling: 'preserve',
      replaceUrl: true,
    });
  }

  revokeSession(session: ManagedAccountSession): void {
    const account = this.account();
    if (account === null) return;
    if (
      this.document.defaultView?.confirm(
        this.i18n.translate('adminTeamWorkspace.sessions.confirmRevoke'),
      ) !== true
    ) {
      return;
    }
    this.sessionActionSubmitting.set(session.id);
    this.teamWorkspace
      .revokeAccountSession(account.username, session.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) =>
          this.handleSessionRevocation(result, 'adminTeamWorkspace.sessions.revoked'),
        error: () => this.handleSessionRevocationError(),
      });
  }

  revokeAllSessions(): void {
    const account = this.account();
    if (account === null) return;
    if (
      this.document.defaultView?.confirm(
        this.i18n.translate('adminTeamWorkspace.sessions.confirmRevokeAll'),
      ) !== true
    ) {
      return;
    }
    this.sessionActionSubmitting.set('all');
    this.teamWorkspace
      .revokeAllAccountSessions(account.username)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) =>
          this.handleSessionRevocation(result, 'adminTeamWorkspace.sessions.allRevoked'),
        error: () => this.handleSessionRevocationError(),
      });
  }

  revokeOtherSessions(): void {
    const account = this.account();
    if (account === null || !this.canRevokeOtherSessions()) return;
    if (
      this.document.defaultView?.confirm(
        this.i18n.translate('adminTeamWorkspace.sessions.confirmRevokeOthers'),
      ) !== true
    ) {
      return;
    }
    this.sessionActionSubmitting.set('others');
    this.teamWorkspace
      .revokeOtherAccountSessions(account.username)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) =>
          this.handleSessionRevocation(result, 'adminTeamWorkspace.sessions.othersRevoked'),
        error: () => this.handleSessionRevocationError(),
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

  sessionDeviceLabelKey(device: ManagedAccountSessionDevice): string {
    switch (device) {
      case 'desktop':
        return 'adminTeamWorkspace.sessions.device.desktop';
      case 'mobile':
        return 'adminTeamWorkspace.sessions.device.mobile';
      case 'tablet':
        return 'adminTeamWorkspace.sessions.device.tablet';
      case 'bot':
        return 'adminTeamWorkspace.sessions.device.bot';
      case 'unknown':
        return 'adminTeamWorkspace.sessions.device.unknown';
    }
  }

  sessionAuthMethodLabelKey(authMethod: ManagedAccountSessionAuthMethod): string {
    switch (authMethod) {
      case 'password':
        return 'adminTeamWorkspace.sessions.authMethod.password';
    }
  }

  formatSessionTimestamp(value: string): string {
    return formatLocalizedDate(value, this.i18n.dateLocale(), 'dateTime');
  }

  private resolveUsername(): string {
    const username = this.route.snapshot.paramMap.get('username');
    if (username === null) {
      throw new Error('Team member detail route requires username');
    }
    return username;
  }

  private canManageAccount(account: ManagedAccount): boolean {
    if (this.isSelfAccount(account)) return false;
    const actorRole = this.currentUserRole();
    if (actorRole === 'owner') return true;
    return actorRole === 'admin' && account.role === 'moderator';
  }

  private handleSessionRevocation(
    result: ManagedAccountSessionRevocation,
    successMessageKey: string,
  ): void {
    this.sessionActionSubmitting.set(null);
    this.notifications.success(this.i18n.translate(successMessageKey));
    if (result.currentSessionRevoked) {
      this.auth.clearLocalSession();
      this.authModal.openLogin();
      return;
    }
    this.loadSessions();
  }

  private handleSessionRevocationError(): void {
    this.sessionActionSubmitting.set(null);
    this.notifications.error(this.i18n.translate('adminTeamWorkspace.sessions.revokeError'));
  }
}

function toManagedAccountRole(value: string): EditableManagedAccountRole {
  if (value === 'admin' || value === 'moderator') return value;
  throw new Error(`Unsupported managed account role: ${value}`);
}
