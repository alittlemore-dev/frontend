import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NotificationService,
  SiteSelectComponent,
  SiteSelectOption,
} from '@alittlemore.dev/design-system';
import { finalize } from 'rxjs';
import { AccountSettingsService } from '../../../../core/auth/account-settings.service';
import { AccountSettings } from '../../../../core/auth/account.model';
import { deviceTimeZone } from '../../../../core/auth/time-zone';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { TelegramSettingsComponent } from './telegram-settings.component';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [TranslatePipe, SiteSelectComponent, TelegramSettingsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-page.component.html',
})
export class SettingsPageComponent {
  readonly preferences = inject(AccountSettingsService);
  readonly i18n = inject(I18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  readonly tabs = ['general', 'appearance', 'telegram'] as const;
  readonly activeTab = signal<(typeof this.tabs)[number]>('general');
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly saveFailed = signal(false);
  readonly deviceZone = deviceTimeZone();

  readonly languageOptions = computed<readonly SiteSelectOption[]>(() =>
    this.i18n.languages().map((language) => ({ value: language.code, label: language.label })),
  );
  readonly themeOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    return ['light', 'dark'].map((theme) => ({
      value: theme,
      label: this.i18n.translate(`shell.theme.${theme}`),
    }));
  });
  readonly timeZoneOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    const selected = this.preferences.settings()?.timeZone;
    const zones = new Set([
      'UTC',
      this.deviceZone,
      ...(Intl.supportedValuesOf?.('timeZone') ?? []),
    ]);
    if (selected) zones.add(selected);
    return [...zones].sort().map((zone) => ({ value: zone, label: zone }));
  });

  constructor() {
    this.load();
  }

  changeLanguage(value: string): void {
    if (value === 'en' || value === 'ru') this.update({ language: value });
  }

  changeTheme(value: string): void {
    if (value === 'light' || value === 'dark') this.update({ theme: value });
  }

  changeTimeZone(value: string): void {
    if (this.timeZoneOptions().some((option) => option.value === value)) {
      this.update({ timeZone: value });
    }
  }

  useDeviceTimeZone(): void {
    this.changeTimeZone(this.deviceZone);
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.preferences
      .load()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({ error: () => this.failed.set(true) });
  }

  update(change: Partial<AccountSettings>): void {
    const settings = this.preferences.settings();
    if (!settings || this.preferences.saving()) return;
    this.saveFailed.set(false);
    this.preferences
      .update({ ...settings, ...change })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.notifications.success(this.i18n.translate('account.settings.saved')),
        error: () => {
          this.saveFailed.set(true);
        },
      });
  }
}
