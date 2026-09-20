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
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NotificationService } from '@alittlemore.dev/design-system';
import { AccountAvatarService } from '../../../../core/auth/account-avatar.service';
import { AccountGender, AccountInfo } from '../../../../core/auth/account.model';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import {
  UnsavedChangesService,
  UnsavedChangesSource,
} from '../../../../core/unsaved-changes/unsaved-changes.service';
import { AccountProfilePatch, AccountService } from '../../services/account.service';

const MAX_NAME_LENGTH = 100;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

interface ProfileForm {
  firstName: FormControl<string>;
  lastName: FormControl<string>;
  middleName: FormControl<string>;
  gender: FormControl<AccountGender | null>;
}

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.scss',
})
export class ProfilePageComponent implements OnInit {
  private readonly accountService = inject(AccountService);
  private readonly avatar = inject(AccountAvatarService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly unsavedScope = inject(UnsavedChangesService).createScope(this.destroyRef);
  private readonly formSnapshot = signal<unknown>({});
  private readonly formUnsavedSource: UnsavedChangesSource;
  private baseline: AccountInfo | null = null;

  readonly account = signal<AccountInfo | null>(null);
  readonly loading = signal(false);
  readonly loadFailed = signal(false);
  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly saveFailed = signal(false);
  readonly avatarBusy = signal(false);
  readonly avatarErrorKey = signal<string | null>(null);
  readonly avatarObjectUrl = this.avatar.objectUrl;

  readonly displayName = computed(() => {
    const account = this.account();
    if (account === null) return '';
    return (
      [account.firstName, account.lastName, account.middleName]
        .filter((part): part is string => part !== null && part.trim() !== '')
        .join(' ') || account.username
    );
  });
  readonly initials = computed(() => {
    const account = this.account();
    if (account === null) return '';
    const nameInitials = [account.firstName, account.lastName]
      .filter((part): part is string => part !== null && part.trim() !== '')
      .map((part) => Array.from(part.trim())[0])
      .join('');
    return (nameInitials || Array.from(account.username).slice(0, 2).join('')).toLocaleUpperCase();
  });
  readonly genderLabelKey = computed(() => {
    const gender = this.account()?.gender;
    return gender === null || gender === undefined
      ? 'shared.notSet'
      : `account.profile.gender.${gender}`;
  });

  readonly profileForm = new FormGroup<ProfileForm>({
    firstName: new FormControl('', {
      nonNullable: true,
      validators: Validators.maxLength(MAX_NAME_LENGTH),
    }),
    lastName: new FormControl('', {
      nonNullable: true,
      validators: Validators.maxLength(MAX_NAME_LENGTH),
    }),
    middleName: new FormControl('', {
      nonNullable: true,
      validators: Validators.maxLength(MAX_NAME_LENGTH),
    }),
    gender: new FormControl<AccountGender | null>(null),
  });

  constructor() {
    this.formSnapshot.set(this.profileForm.getRawValue());
    this.formUnsavedSource = this.unsavedScope.registerSource(this.formSnapshot, this.editing);
    this.profileForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.formSnapshot.set(this.profileForm.getRawValue());
    });
  }

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.accountService
      .ensureLoaded()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (account) => {
          this.applyServerAccount(account, true);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadFailed.set(true);
          this.notifications.error(this.i18n.translate('account.profile.loadFailed'));
        },
      });
  }

  startEditing(): void {
    const account = this.account();
    if (account === null) return;
    this.populateForm(account);
    this.formUnsavedSource.commit();
    this.saveFailed.set(false);
    this.editing.set(true);
  }

  cancelEditing(): void {
    if (this.baseline !== null) this.populateForm(this.baseline);
    this.formUnsavedSource.commit();
    this.saveFailed.set(false);
    this.editing.set(false);
  }

  saveProfile(): void {
    if (this.saving()) return;
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      this.notifications.error(this.i18n.translate('account.profile.invalid'));
      return;
    }
    const baseline = this.baseline;
    if (baseline === null) return;
    const value = this.profileForm.getRawValue();
    const normalized = {
      firstName: normalizeName(value.firstName),
      lastName: normalizeName(value.lastName),
      middleName: normalizeName(value.middleName),
      gender: value.gender,
    };
    const patch: AccountProfilePatch = {};
    if (normalized.firstName !== baseline.firstName) patch.firstName = normalized.firstName;
    if (normalized.lastName !== baseline.lastName) patch.lastName = normalized.lastName;
    if (normalized.middleName !== baseline.middleName) patch.middleName = normalized.middleName;
    if (normalized.gender !== baseline.gender) patch.gender = normalized.gender;

    if (Object.keys(patch).length === 0) {
      this.formUnsavedSource.commit();
      this.editing.set(false);
      this.notifications.success(this.i18n.translate('account.profile.noChanges'));
      return;
    }

    this.saving.set(true);
    this.saveFailed.set(false);
    this.accountService
      .updateProfile(patch)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (account) => {
          this.applyServerAccount(account, true);
          this.saving.set(false);
          this.editing.set(false);
          this.notifications.success(this.i18n.translate('account.profile.saveSuccess'));
        },
        error: () => {
          this.saving.set(false);
          this.saveFailed.set(true);
          this.notifications.error(this.i18n.translate('account.profile.saveFailed'));
        },
      });
  }

  selectAvatar(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item?.(0) ?? input.files?.[0] ?? null;
    input.value = '';
    if (file === null || this.avatarBusy()) return;
    if (!AVATAR_MIME_TYPES.has(file.type)) {
      this.rejectAvatar('account.profile.invalidAvatarType');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      this.rejectAvatar('account.profile.avatarTooLarge');
      return;
    }

    this.avatarBusy.set(true);
    this.avatarErrorKey.set(null);
    this.accountService
      .replaceAvatar(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (account) => {
          this.applyServerAccount(account, !this.editing());
          this.avatarBusy.set(false);
          this.notifications.success(this.i18n.translate('account.profile.avatarSaveSuccess'));
        },
        error: () => {
          this.avatarBusy.set(false);
          this.rejectAvatar('account.profile.avatarFailed');
        },
      });
  }

  removeAvatar(): void {
    if (this.avatarBusy()) return;
    this.avatarBusy.set(true);
    this.avatarErrorKey.set(null);
    this.accountService
      .removeAvatar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (account) => {
          this.applyServerAccount(account, !this.editing());
          this.avatarBusy.set(false);
          this.notifications.success(this.i18n.translate('account.profile.avatarRemoveSuccess'));
        },
        error: () => {
          this.avatarBusy.set(false);
          this.rejectAvatar('account.profile.avatarFailed');
        },
      });
  }

  private applyServerAccount(account: AccountInfo, populateForm: boolean): void {
    this.account.set(account);
    this.baseline = account;
    if (populateForm) {
      this.populateForm(account);
      this.formUnsavedSource.commit();
    }
  }

  private populateForm(account: AccountInfo): void {
    this.profileForm.setValue(
      {
        firstName: account.firstName ?? '',
        lastName: account.lastName ?? '',
        middleName: account.middleName ?? '',
        gender: account.gender,
      },
      { emitEvent: false },
    );
    this.formSnapshot.set(this.profileForm.getRawValue());
  }

  private rejectAvatar(key: string): void {
    this.avatarErrorKey.set(key);
    this.notifications.error(this.i18n.translate(key));
  }
}

function normalizeName(value: string): string | null {
  return value.trim() || null;
}
