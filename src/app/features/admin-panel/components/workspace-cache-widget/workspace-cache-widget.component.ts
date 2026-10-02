import { NotificationService, formatLocalizedDate } from '@alittlemore.dev/design-system';
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

import {
  CacheStatus,
  CacheDomain,
  CacheWarmOperation,
  CacheWarmStatus,
} from '../../models/workspace-cache.model';
import { WorkspaceCacheService } from '../../services/workspace-cache.service';

const CACHE_WARM_POLL_INTERVAL_MS = 1000;

@Component({
  selector: 'app-workspace-cache-widget',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workspace-cache-widget.component.html',
  styleUrl: './workspace-cache-widget.component.scss',
})
export class WorkspaceCacheWidgetComponent implements OnInit {
  private readonly service = inject(WorkspaceCacheService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  readonly cacheStatus = signal<CacheStatus | null>(null);
  readonly cacheLoading = signal(false);
  readonly cacheLoadError = signal<ApiError | null>(null);
  readonly cacheClearing = signal(false);
  readonly cacheWarming = signal(false);
  readonly cacheActionErrorKey = signal<string | null>(null);
  readonly activeWarmOperation = signal<CacheWarmOperation | null>(null);

  readonly cacheInitialLoading = computed(() => this.cacheLoading() && this.cacheStatus() === null);
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
              ? 'adminWorkspaceTools.cache.loadError'
              : 'adminWorkspaceTools.cache.refreshError';
          if (this.cacheStatus() === null) {
            this.cacheLoadError.set(error);
          } else {
            this.cacheActionErrorKey.set(errorKey);
          }
          this.notifications.error(this.i18n.translate(errorKey));
        },
      });
  }

  clearCache(): void {
    if (this.cacheMutationActive()) return;
    const confirmed =
      this.document.defaultView?.confirm(
        this.i18n.translate('adminWorkspaceTools.cache.confirmClear'),
      ) ?? false;
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
          this.notifications.success(this.i18n.translate('adminWorkspaceTools.cache.clearSuccess'));
        },
        error: () => {
          this.cacheClearing.set(false);
          this.cacheActionErrorKey.set('adminWorkspaceTools.cache.clearError');
          this.notifications.error(this.i18n.translate('adminWorkspaceTools.cache.clearError'));
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
          this.cacheActionErrorKey.set('adminWorkspaceTools.cache.warmStartError');
          this.notifications.error(this.i18n.translate('adminWorkspaceTools.cache.warmStartError'));
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

  domainLabelKey(domain: CacheDomain): string {
    const keys: Record<CacheDomain, string> = {
      i18n: 'adminWorkspaceTools.cache.domain.i18n',
    };
    return keys[domain];
  }

  warmStatusLabelKey(status: CacheWarmStatus): string {
    return `adminWorkspaceTools.cache.status.${status}`;
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
      this.notifications.success(this.i18n.translate('adminWorkspaceTools.cache.warmSuccess'));
    } else {
      this.cacheActionErrorKey.set('adminWorkspaceTools.cache.warmFailed');
      this.notifications.error(this.i18n.translate('adminWorkspaceTools.cache.warmFailed'));
    }
    this.loadCacheStatus();
  }

  private scheduleWarmPoll(operationId: string): void {
    const timerWindow = this.document.defaultView;
    if (timerWindow === null) {
      this.cacheWarming.set(false);
      this.cacheActionErrorKey.set('adminWorkspaceTools.cache.pollError');
      this.notifications.error(this.i18n.translate('adminWorkspaceTools.cache.pollError'));
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
          this.cacheActionErrorKey.set('adminWorkspaceTools.cache.pollError');
          this.notifications.error(this.i18n.translate('adminWorkspaceTools.cache.pollError'));
        },
      });
  }

  private clearWarmPoll(): void {
    if (this.warmPollTimeoutId === null) return;
    this.document.defaultView?.clearTimeout(this.warmPollTimeoutId);
    this.warmPollTimeoutId = null;
  }
}
