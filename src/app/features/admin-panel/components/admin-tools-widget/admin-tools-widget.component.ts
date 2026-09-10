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
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ApiError } from '../../../../core/models/api-error.model';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { formatLocalizedDate } from '../../../../shared/utils/localized-date';
import {
  AdminCacheStatus,
  AuthSessionsStatus,
  CacheDomain,
  CacheWarmOperation,
  CacheWarmStatus,
} from '../../models/admin-tools.model';
import { AdminToolsService } from '../../services/admin-tools.service';

const CACHE_WARM_POLL_INTERVAL_MS = 1000;

@Component({
  selector: 'app-admin-tools-widget',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-tools-widget.component.html',
  styleUrl: './admin-tools-widget.component.scss',
})
export class AdminToolsWidgetComponent implements OnInit {
  private readonly service = inject(AdminToolsService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  readonly cacheStatus = signal<AdminCacheStatus | null>(null);
  readonly cacheLoading = signal(false);
  readonly cacheLoadError = signal<ApiError | null>(null);
  readonly cacheClearing = signal(false);
  readonly cacheWarming = signal(false);
  readonly cacheActionErrorKey = signal<string | null>(null);
  readonly activeWarmOperation = signal<CacheWarmOperation | null>(null);
  readonly sessionsStatus = signal<AuthSessionsStatus | null>(null);
  readonly sessionsLoading = signal(false);
  readonly sessionsLoadError = signal<ApiError | null>(null);
  readonly sessionsPruning = signal(false);
  readonly sessionsActionErrorKey = signal<string | null>(null);

  readonly cacheInitialLoading = computed(() => this.cacheLoading() && this.cacheStatus() === null);
  readonly sessionsInitialLoading = computed(
    () => this.sessionsLoading() && this.sessionsStatus() === null,
  );
  readonly cacheMutationActive = computed(() => this.cacheClearing() || this.cacheWarming());
  readonly displayedWarmOperation = computed(
    () => this.activeWarmOperation() ?? this.cacheStatus()?.lastManualWarmOperation ?? null,
  );
  readonly cacheActionsDisabled = computed(
    () => this.cacheMutationActive() || this.cacheStatus()?.enabled !== true,
  );
  private warmPollTimeoutId: number | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.clearWarmPoll());
  }

  ngOnInit(): void {
    this.loadCacheStatus();
    this.loadSessionsStatus();
  }

  loadCacheStatus(): void {
    this.cacheLoading.set(true);
    this.cacheLoadError.set(null);
    this.service
      .getCacheStatus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (status) => {
          this.cacheStatus.set(status);
          this.cacheLoading.set(false);
          const lastWarm = status.lastManualWarmOperation;
          if (
            this.activeWarmOperation() === null &&
            lastWarm !== null &&
            (lastWarm.status === 'queued' || lastWarm.status === 'running')
          ) {
            this.cacheWarming.set(true);
            this.handleWarmOperation(lastWarm);
          }
        },
        error: (error: ApiError) => {
          this.cacheLoading.set(false);
          const errorKey =
            this.cacheStatus() === null
              ? 'adminTools.cache.loadError'
              : 'adminTools.cache.refreshError';
          if (this.cacheStatus() === null) {
            this.cacheLoadError.set(error);
          } else {
            this.cacheActionErrorKey.set(errorKey);
          }
          this.notifications.error(this.i18n.translate(errorKey));
        },
      });
  }

  loadSessionsStatus(): void {
    this.sessionsLoading.set(true);
    this.sessionsLoadError.set(null);
    this.service
      .getAuthSessionsStatus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (status) => {
          this.sessionsStatus.set(status);
          this.sessionsLoading.set(false);
        },
        error: (error: ApiError) => {
          this.sessionsLoadError.set(error);
          this.sessionsLoading.set(false);
          this.notifications.error(this.i18n.translate('adminTools.sessions.loadError'));
        },
      });
  }

  clearCache(): void {
    if (this.cacheMutationActive()) return;
    const confirmed =
      this.document.defaultView?.confirm(this.i18n.translate('adminTools.cache.confirmClear')) ??
      false;
    if (!confirmed) return;

    this.cacheClearing.set(true);
    this.cacheActionErrorKey.set(null);
    this.service
      .clearCache()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (status) => {
          this.cacheStatus.set(status);
          this.cacheClearing.set(false);
          this.notifications.success(this.i18n.translate('adminTools.cache.clearSuccess'));
        },
        error: () => {
          this.cacheClearing.set(false);
          this.cacheActionErrorKey.set('adminTools.cache.clearError');
          this.notifications.error(this.i18n.translate('adminTools.cache.clearError'));
        },
      });
  }

  startCacheWarm(): void {
    if (this.cacheMutationActive()) return;
    this.clearWarmPoll();
    this.cacheWarming.set(true);
    this.cacheActionErrorKey.set(null);
    this.service
      .startCacheWarm()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (operation) => this.handleWarmOperation(operation),
        error: () => {
          this.cacheWarming.set(false);
          this.cacheActionErrorKey.set('adminTools.cache.warmStartError');
          this.notifications.error(this.i18n.translate('adminTools.cache.warmStartError'));
        },
      });
  }

  retryCacheWarmPoll(): void {
    const operation = this.activeWarmOperation();
    if (operation === null || (operation.status !== 'queued' && operation.status !== 'running')) {
      return;
    }
    this.cacheActionErrorKey.set(null);
    this.pollWarmOperation(operation.operationId);
  }

  pruneAuthSessions(): void {
    if (this.sessionsPruning()) return;
    const confirmed =
      this.document.defaultView?.confirm(this.i18n.translate('adminTools.sessions.confirmPrune')) ??
      false;
    if (!confirmed) return;

    this.sessionsPruning.set(true);
    this.sessionsActionErrorKey.set(null);
    this.service
      .pruneAuthSessions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.sessionsStatus.set({
            expiredCount: result.expiredCount,
            expiringSoonCount: result.expiringSoonCount,
            expiringSoonDays: result.expiringSoonDays,
            scheduledPruneIntervalSeconds: result.scheduledPruneIntervalSeconds,
          });
          this.sessionsPruning.set(false);
          this.notifications.success(
            this.i18n.translate('adminTools.sessions.pruneSuccess', {
              count: result.deletedCount,
            }),
          );
        },
        error: () => {
          this.sessionsPruning.set(false);
          this.sessionsActionErrorKey.set('adminTools.sessions.pruneError');
          this.notifications.error(this.i18n.translate('adminTools.sessions.pruneError'));
        },
      });
  }

  domainLabelKey(domain: CacheDomain): string {
    const keys: Record<CacheDomain, string> = {
      i18n: 'adminTools.cache.domain.i18n',
      articles: 'adminTools.cache.domain.articles',
      competency_matrix: 'adminTools.cache.domain.competencyMatrix',
    };
    return keys[domain];
  }

  warmStatusLabelKey(status: CacheWarmStatus): string {
    return `adminTools.cache.status.${status}`;
  }

  warmStatusBadgeClass(status: CacheWarmStatus): string {
    const classes: Record<CacheWarmStatus, string> = {
      queued: 'text-bg-secondary',
      running: 'text-bg-primary',
      succeeded: 'text-bg-success',
      failed: 'text-bg-danger',
    };
    return classes[status];
  }

  formatDate(value: string): string {
    return formatLocalizedDate(value, this.i18n.dateLocale(), 'dateTime');
  }

  private handleWarmOperation(operation: CacheWarmOperation): void {
    this.activeWarmOperation.set(operation);
    if (operation.status === 'queued' || operation.status === 'running') {
      this.scheduleWarmPoll(operation.operationId);
      return;
    }

    this.cacheWarming.set(false);
    if (operation.status === 'succeeded') {
      this.notifications.success(this.i18n.translate('adminTools.cache.warmSuccess'));
    } else {
      this.cacheActionErrorKey.set('adminTools.cache.warmFailed');
      this.notifications.error(this.i18n.translate('adminTools.cache.warmFailed'));
    }
    this.loadCacheStatus();
  }

  private scheduleWarmPoll(operationId: string): void {
    const timerWindow = this.document.defaultView;
    if (timerWindow === null) {
      this.cacheWarming.set(false);
      this.cacheActionErrorKey.set('adminTools.cache.pollError');
      this.notifications.error(this.i18n.translate('adminTools.cache.pollError'));
      return;
    }
    this.clearWarmPoll();
    this.warmPollTimeoutId = timerWindow.setTimeout(() => {
      this.warmPollTimeoutId = null;
      this.pollWarmOperation(operationId);
    }, CACHE_WARM_POLL_INTERVAL_MS);
  }

  private pollWarmOperation(operationId: string): void {
    this.service
      .getCacheWarmOperation(operationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (operation) => this.handleWarmOperation(operation),
        error: () => {
          this.cacheActionErrorKey.set('adminTools.cache.pollError');
          this.notifications.error(this.i18n.translate('adminTools.cache.pollError'));
        },
      });
  }

  private clearWarmPoll(): void {
    if (this.warmPollTimeoutId === null) return;
    this.document.defaultView?.clearTimeout(this.warmPollTimeoutId);
    this.warmPollTimeoutId = null;
  }
}
