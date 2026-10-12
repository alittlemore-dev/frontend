import { DOCUMENT, DecimalPipe, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  PLATFORM_ID,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Subscription, finalize } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { HealthcheckOverview, SafeHealthcheckError } from '../../models/healthcheck.model';
import { HealthcheckService } from '../../services/healthcheck.service';

@Component({
  selector: 'app-dashboard-healthcheck',
  standalone: true,
  imports: [TranslatePipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-healthcheck.component.html',
  styleUrl: './dashboard-healthcheck.component.scss',
})
export class DashboardHealthcheckComponent {
  private readonly service = inject(HealthcheckService);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private request: Subscription | null = null;
  readonly active = input(false);
  readonly overview = signal<HealthcheckOverview | null>(null);
  readonly loading = signal(false);
  readonly unavailable = signal(false);

  constructor() {
    effect((cleanup) => {
      this.auth.currentUser();
      const enabled = this.active() && this.auth.isOwner();
      this.cancel();
      this.overview.set(null);
      this.unavailable.set(false);
      const window = this.document.defaultView;
      if (!enabled || !isPlatformBrowser(this.platformId) || window === null) return;
      untracked(() => this.refresh());
      const interval = window.setInterval(() => this.refresh(), 30000);
      const visibility = (): void => {
        if (this.document.visibilityState === 'hidden') this.cancel();
        else this.refresh();
      };
      this.document.addEventListener('visibilitychange', visibility);
      cleanup(() => {
        window.clearInterval(interval);
        this.document.removeEventListener('visibilitychange', visibility);
        this.cancel();
      });
    });
    this.destroyRef.onDestroy(() => this.cancel());
  }

  refresh(): void {
    if (
      !this.active() ||
      !this.auth.isOwner() ||
      !isPlatformBrowser(this.platformId) ||
      this.document.defaultView === null ||
      this.document.visibilityState === 'hidden' ||
      this.loading()
    )
      return;
    this.loading.set(true);
    this.unavailable.set(false);
    this.request = this.service
      .getHealthcheck()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (overview) => this.overview.set(overview),
        error: () => {
          this.overview.set(null);
          this.unavailable.set(true);
        },
      });
  }

  errorKey(error: SafeHealthcheckError): string {
    const known = [
      'source_failed',
      'delivery_failed',
      'cleanup_failed',
      'delivery_evicted',
      'interrupted',
      'projection_failed',
      'storage_full',
      'configuration_invalid',
    ];
    return `dashboard.healthcheck.error.${known.includes(error.code) ? error.code : 'unknown'}`;
  }

  formatTime(value: string | null): string {
    if (value === null) return this.i18n.translate('dashboard.healthcheck.empty');
    const timeZone = this.auth.currentUser()?.settings?.timeZone || 'UTC';
    return new Intl.DateTimeFormat(this.i18n.language() || 'ru', {
      timeZone,
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(new Date(value));
  }

  private cancel(): void {
    this.request?.unsubscribe();
    this.request = null;
    this.loading.set(false);
  }
}
