import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NavigationStart, Router } from '@angular/router';
import {
  LocalizedDateTimePickerComponent,
  LocalizedDateTimePickerLabels,
  FoldableSectionComponent,
  ModalDialogDirective,
  ModalScrollDirective,
  formatLocalizedDate,
} from '@alittlemore.dev/design-system';
import { Subscription, forkJoin } from 'rxjs';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ApiPermission, ApiToken } from '../../models/api-token.model';
import { ApiTokensService } from '../../services/api-tokens.service';
import { API_ACCESS_EXAMPLES } from './api-access-examples';

const MAX_DURATION = 365 * 24 * 60 * 60 * 1000;
interface SecretAction {
  id: string;
  action: 'show' | 'copy';
}

@Component({
  selector: 'app-api-access-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    LocalizedDateTimePickerComponent,
    FoldableSectionComponent,
    ModalDialogDirective,
    ModalScrollDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './api-access-page.component.html',
  styleUrl: './api-access-page.component.scss',
})
export class ApiAccessPageComponent implements OnInit {
  private readonly service = inject(ApiTokensService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  readonly i18n = inject(I18nService);
  private secretRequest: Subscription | null = null;
  private actionGeneration = 0;
  readonly tokens = signal<ApiToken[]>([]);
  readonly permissions = signal<ApiPermission[]>([]);
  readonly selectedPermissions = signal<ReadonlySet<string>>(new Set());
  readonly loading = signal(false);
  readonly loadFailed = signal(false);
  readonly busy = signal(false);
  readonly message = signal<string | null>(null);
  readonly failed = signal(false);
  readonly secretAction = signal<SecretAction | null>(null);
  readonly revealed = signal<{ id: string; value: string } | null>(null);
  readonly durations = ['1h', '1d', '7d', '30d', '90d', '365d', 'custom'] as const;
  readonly createOpen = signal(false);
  readonly createDialog = viewChild(ModalDialogDirective);
  readonly tokenName = viewChild<ElementRef<HTMLInputElement>>('tokenName');
  readonly expandedPermissions = signal<ReadonlySet<string>>(new Set());
  readonly expandedExamples = signal<ReadonlySet<string>>(new Set());
  readonly examples = API_ACCESS_EXAMPLES;
  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    password: new FormControl('', { nonNullable: true, validators: Validators.required }),
    duration: new FormControl<string>('1h', { nonNullable: true }),
    expiresAt: new FormControl<string | null>(null),
  });
  readonly actionPassword = new FormControl('', {
    nonNullable: true,
    validators: Validators.required,
  });
  readonly customDuration = signal(false);
  readonly permissionServices = computed(() => {
    const services = new Map<string, Map<string, ApiPermission[]>>();
    for (const permission of this.permissions()) {
      const groups = services.get(permission.service) ?? new Map<string, ApiPermission[]>();
      const name = `${permission.service}.${permission.domain}`;
      groups.set(name, [...(groups.get(name) ?? []), permission]);
      services.set(permission.service, groups);
    }
    return Array.from(services, ([name, domains]) => {
      const groups = Array.from(domains, ([name, permissions]) => ({ name, permissions }));
      const permissions = groups.flatMap((group) => group.permissions);
      return {
        name,
        groups,
        total: permissions.length,
        selected: permissions.filter((permission) =>
          this.selectedPermissions().has(permission.code),
        ).length,
      };
    });
  });
  readonly dateTimeLabels = computed<LocalizedDateTimePickerLabels>(() => ({
    placeholder: this.i18n.translate('account.apiAccess.dateTime.placeholder'),
    openPicker: this.i18n.translate('account.apiAccess.dateTime.open'),
    changeValue: this.i18n.translate('account.apiAccess.dateTime.change'),
    dialog: this.i18n.translate('account.apiAccess.expiresAt'),
    dateTimeInput: this.i18n.translate('account.apiAccess.expiresAt'),
    previousMonth: this.i18n.translate('shared.datePicker.previousMonth'),
    nextMonth: this.i18n.translate('shared.datePicker.nextMonth'),
    openMonthYearPicker: this.i18n.translate('shared.datePicker.openMonthYearPicker'),
    previousYear: this.i18n.translate('shared.datePicker.previousYear'),
    nextYear: this.i18n.translate('shared.datePicker.nextYear'),
    hour: this.i18n.translate('account.apiAccess.dateTime.hour'),
    minute: this.i18n.translate('account.apiAccess.dateTime.minute'),
    dateFormatHint: this.i18n.translate('shared.datePicker.formatHint'),
    timeFormatHint: this.i18n.translate('account.apiAccess.dateTime.timeFormat'),
    selectDate: this.i18n.translate('shared.datePicker.selectDate'),
    clear: this.i18n.translate('shared.datePicker.clear'),
    cancel: this.i18n.translate('shared.cancel'),
    done: this.i18n.translate('shared.datePicker.done'),
    today: this.i18n.translate('shared.datePicker.today'),
    now: this.i18n.translate('account.apiAccess.dateTime.now'),
    keyboardHelp: this.i18n.translate('shared.datePicker.keyboardHelp'),
    invalidDateTime: this.i18n.translate('account.apiAccess.invalidExpiry'),
    unavailableDateTime: this.i18n.translate('account.apiAccess.invalidExpiry'),
    requiredDateTime: this.i18n.translate('validation.required'),
  }));

  constructor() {
    this.form.controls.duration.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((duration) => this.customDuration.set(duration === 'custom'));
    inject(Router)
      .events.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (event instanceof NavigationStart) {
          this.clearSecrets();
          this.closeCreate();
        }
      });
    this.destroyRef.onDestroy(() => this.clearSecrets());
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    forkJoin({ tokens: this.service.list(), permissions: this.service.permissions() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ tokens, permissions }) => {
          this.tokens.set(tokens);
          this.permissions.set(permissions);
          this.selectedPermissions.update(
            (selected) =>
              new Set(
                permissions
                  .filter((permission) => selected.has(permission.code))
                  .map((permission) => permission.code),
              ),
          );
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadFailed.set(true);
        },
      });
  }

  togglePermission(code: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedPermissions.update((selected) => {
      const result = new Set(selected);
      if (checked) result.add(code);
      else result.delete(code);
      return result;
    });
  }

  selectAll(): void {
    this.selectedPermissions.set(new Set(this.permissions().map((permission) => permission.code)));
  }
  selectNone(): void {
    this.selectedPermissions.set(new Set());
  }

  openCreate(): void {
    if (this.busy()) return;
    this.clearSecrets();
    this.message.set(null);
    this.resetCreate();
    this.createOpen.set(true);
    afterNextRender(
      {
        write: () => {
          this.createDialog()?.open();
          if (this.createDialog()?.isOpen())
            this.tokenName()?.nativeElement.focus({ preventScroll: true });
        },
      },
      { injector: this.injector },
    );
  }

  closeCreate(): void {
    this.createDialog()?.close();
    this.createOpen.set(false);
    this.resetCreate();
    this.message.set(null);
  }

  setPermissionExpanded(name: string, expanded: boolean): void {
    this.expandedPermissions.update((current) => {
      const next = new Set(current);
      if (expanded) next.add(name);
      else next.delete(name);
      return next;
    });
  }

  setExampleExpanded(id: string, expanded: boolean): void {
    this.expandedExamples.update((current) => {
      const next = new Set(current);
      if (expanded) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  private resetCreate(): void {
    this.form.reset({ name: '', password: '', duration: '1h', expiresAt: null });
    this.selectedPermissions.set(new Set());
    this.expandedPermissions.set(new Set());
  }

  create(): void {
    if (this.busy()) return;
    const value = this.form.getRawValue();
    if (
      this.form.controls.name.invalid ||
      this.form.controls.password.invalid ||
      !value.name.trim() ||
      this.selectedPermissions().size === 0
    ) {
      this.form.markAllAsTouched();
      this.feedback('invalid', true);
      return;
    }
    const now = Date.now();
    const hours = value.duration === '1h' ? 1 : Number(value.duration.replace('d', '')) * 24;
    const expiry =
      value.duration === 'custom'
        ? new Date(value.expiresAt ?? '').getTime()
        : now + hours * 3600000;
    if (
      (value.duration === 'custom' && this.form.controls.expiresAt.invalid) ||
      !Number.isFinite(expiry) ||
      expiry <= now ||
      expiry > now + MAX_DURATION
    ) {
      this.feedback('invalidExpiry', true);
      return;
    }
    const payload = {
      name: value.name.trim(),
      password: value.password,
      permissions: [...this.selectedPermissions()],
      expiresAt: new Date(expiry).toISOString(),
    };
    this.clearSecrets();
    this.busy.set(true);
    this.service
      .create(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (token) => {
          this.tokens.update((tokens) => [token, ...tokens]);
          this.busy.set(false);
          this.closeCreate();
          this.feedback('created');
        },
        error: () => {
          this.busy.set(false);
          this.feedback('createFailed', true);
        },
      });
  }

  requestSecret(token: ApiToken, action: 'show' | 'copy'): void {
    if (this.busy() || token.status !== 'active') return;
    this.clearSecrets();
    this.message.set(null);
    this.secretAction.set({ id: token.id, action });
  }

  confirmSecret(): void {
    const action = this.secretAction();
    if (this.busy() || action === null) return;
    if (this.actionPassword.invalid) {
      this.actionPassword.markAsTouched();
      this.feedback('passwordRequired', true);
      return;
    }
    const password = this.actionPassword.value;
    this.actionPassword.reset();
    const generation = ++this.actionGeneration;
    this.busy.set(true);
    this.secretRequest = this.service
      .reveal(action.id, password)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (value) => {
          this.busy.set(false);
          this.secretAction.set(null);
          if (action.action === 'show') {
            this.revealed.set({ id: action.id, value });
            this.feedback('shown');
          } else {
            const clipboard = this.document.defaultView?.navigator.clipboard;
            if (!clipboard) {
              this.feedback('copyFailed', true);
              return;
            }
            void clipboard.writeText(value).then(
              () => {
                if (generation === this.actionGeneration && !this.destroyRef.destroyed)
                  this.feedback('copied');
              },
              () => {
                if (generation === this.actionGeneration && !this.destroyRef.destroyed)
                  this.feedback('copyFailed', true);
              },
            );
          }
        },
        error: () => {
          this.busy.set(false);
          this.feedback('revealFailed', true);
        },
      });
  }

  hide(): void {
    this.clearSecrets();
    this.feedback('hidden');
  }

  cancelSecret(): void {
    this.clearSecrets();
    this.message.set(null);
  }

  revoke(token: ApiToken): void {
    if (this.busy()) return;
    this.clearSecrets();
    this.busy.set(true);
    this.service
      .revoke(token.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (revoked) => {
          this.tokens.update((tokens) =>
            tokens.map((item) => (item.id === revoked.id ? revoked : item)),
          );
          this.busy.set(false);
          this.feedback('revoked');
        },
        error: () => {
          this.busy.set(false);
          this.feedback('revokeFailed', true);
        },
      });
  }

  date(value: string): string {
    return formatLocalizedDate(value, this.i18n.dateLocale(), 'dateTime');
  }

  private clearSecrets(): void {
    this.actionGeneration++;
    this.secretRequest?.unsubscribe();
    this.secretRequest = null;
    if (this.secretAction() !== null) this.busy.set(false);
    this.revealed.set(null);
    this.secretAction.set(null);
    this.actionPassword.reset();
    this.form.controls.password.reset();
  }

  private feedback(key: string, failed = false): void {
    this.message.set(`account.apiAccess.${key}`);
    this.failed.set(failed);
  }
}
