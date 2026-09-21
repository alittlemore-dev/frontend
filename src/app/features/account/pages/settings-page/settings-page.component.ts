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
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [TranslatePipe, SiteSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-page.component.html',
})
export class SettingsPageComponent {
  readonly preferences = inject(AccountSettingsService);
  readonly i18n = inject(I18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  readonly activeTab = signal<'general' | 'appearance'>('general');
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly saveFailed = signal(false);

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

  constructor() {
    this.load();
  }

  changeLanguage(value: string): void {
    if (value === 'en' || value === 'ru') this.update({ language: value });
  }

  changeTheme(value: string): void {
    if (value === 'light' || value === 'dark') this.update({ theme: value });
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
