import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { ApiError } from '../../../../core/models/api-error.model';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { Subject, of, throwError } from 'rxjs';
import {
  AdminCacheStatus,
  AuthSessionsPruneResult,
  AuthSessionsStatus,
  CacheWarmOperation,
} from '../../models/admin-tools.model';
import { AdminToolsService } from '../../services/admin-tools.service';
import { AdminToolsWidgetComponent } from './admin-tools-widget.component';

describe('AdminToolsWidgetComponent', () => {
  let fixture: ComponentFixture<AdminToolsWidgetComponent>;
  let service: {
    getCacheStatus: jest.Mock;
    clearCache: jest.Mock;
    startCacheWarm: jest.Mock;
    getCacheWarmOperation: jest.Mock;
    getAuthSessionsStatus: jest.Mock;
    pruneAuthSessions: jest.Mock;
  };
  let notifications: { success: jest.Mock; error: jest.Mock };

  beforeEach(async () => {
    jest.useFakeTimers();
    service = {
      getCacheStatus: jest.fn().mockReturnValue(of(cacheStatus())),
      clearCache: jest.fn().mockReturnValue(of(cacheStatus({ domainsEmpty: true }))),
      startCacheWarm: jest.fn().mockReturnValue(of(warmOperation('queued'))),
      getCacheWarmOperation: jest.fn().mockReturnValue(of(warmOperation('succeeded'))),
      getAuthSessionsStatus: jest.fn().mockReturnValue(of(authSessionsStatus())),
      pruneAuthSessions: jest.fn().mockReturnValue(of(authSessionsPruneResult())),
    };
    notifications = { success: jest.fn(), error: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [AdminToolsWidgetComponent],
      providers: [
        provideI18nTesting(),
        { provide: AdminToolsService, useValue: service },
        { provide: NotificationService, useValue: notifications },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminToolsWidgetComponent);
  });

  afterEach(() => {
    if (!fixture.componentRef.hostView.destroyed) fixture.destroy();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('renders stable card skeletons while both initial requests are pending', () => {
    service.getCacheStatus.mockReturnValue(new Subject<AdminCacheStatus>());
    service.getAuthSessionsStatus.mockReturnValue(new Subject<AuthSessionsStatus>());

    fixture.detectChanges();

    expect(element('[data-testid="admin-tools-cache-card"]')).not.toBeNull();
    expect(element('[data-testid="admin-tools-sessions-card"]')).not.toBeNull();
    expect(element('[data-testid="admin-tools-cache-skeleton"]')).not.toBeNull();
    expect(element('[data-testid="admin-tools-sessions-skeleton"]')).not.toBeNull();
  });

  it('renders cache configuration, per-domain metrics, and session counts', () => {
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).not.toContain('Служебные инструменты');
    expect(text).toContain('Кэш ответов');
    expect(text).toContain('86400');
    expect(text).toContain('Локализация');
    expect(text).toContain('3');
    expect(text).toContain('120');
    expect(text).toContain('Не истекают: 1');
    expect(text).toContain('Протухшие сессии');
    expect(text).toContain('12');
    expect(text).toContain('4');
    expect(text).toContain('7 дней');
    expect(text).toContain('Успешно');
  });

  it('shows an actionable cache load error and retries only that card', () => {
    service.getCacheStatus
      .mockReturnValueOnce(throwError(() => apiError('cache unavailable')))
      .mockReturnValueOnce(of(cacheStatus()));

    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('cache unavailable');

    click('[data-testid="admin-tools-cache-retry"]');

    expect(service.getCacheStatus).toHaveBeenCalledTimes(2);
    expect(service.getAuthSessionsStatus).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('Локализация');
  });

  it('requires confirmation before clearing and never starts warming implicitly', () => {
    const confirm = jest
      .spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    fixture.detectChanges();

    click('[data-testid="admin-tools-cache-clear"]');
    expect(service.clearCache).not.toHaveBeenCalled();

    click('[data-testid="admin-tools-cache-clear"]');
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(service.clearCache).toHaveBeenCalledTimes(1);
    expect(service.startCacheWarm).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Ключей: 0');
    expect(notifications.success).toHaveBeenCalledWith('Кэш очищен. Прогрев не запускался.');
  });

  it('keeps the cache action controls disabled until a clear request completes', () => {
    const clearResult = new Subject<AdminCacheStatus>();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    service.clearCache.mockReturnValue(clearResult);
    fixture.detectChanges();

    click('[data-testid="admin-tools-cache-clear"]');

    expect(button('[data-testid="admin-tools-cache-clear"]').disabled).toBe(true);
    expect(button('[data-testid="admin-tools-cache-warm"]').disabled).toBe(true);

    clearResult.next(cacheStatus({ domainsEmpty: true }));
    clearResult.complete();
    fixture.detectChanges();

    expect(button('[data-testid="admin-tools-cache-clear"]').disabled).toBe(false);
    expect(button('[data-testid="admin-tools-cache-warm"]').disabled).toBe(false);
  });

  it('polls a warm only while it is queued or running and refreshes terminal metrics', () => {
    service.getCacheWarmOperation
      .mockReturnValueOnce(of(warmOperation('running')))
      .mockReturnValueOnce(of(warmOperation('succeeded')));
    fixture.detectChanges();

    click('[data-testid="admin-tools-cache-warm"]');
    expect(button('[data-testid="admin-tools-cache-warm"]').disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('В очереди');

    jest.advanceTimersByTime(1000);
    fixture.detectChanges();
    expect(service.getCacheWarmOperation).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('Выполняется');

    jest.advanceTimersByTime(1000);
    fixture.detectChanges();
    expect(service.getCacheWarmOperation).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('Успешно');
    expect(service.getCacheStatus).toHaveBeenCalledTimes(2);
    expect(notifications.success).toHaveBeenCalledWith('Прогрев кэша завершён.');

    jest.advanceTimersByTime(5000);
    expect(service.getCacheWarmOperation).toHaveBeenCalledTimes(2);
  });

  it('resumes polling when the last manual warm is still active on page load', () => {
    service.getCacheStatus.mockReturnValue(
      of({ ...cacheStatus(), lastManualWarmOperation: warmOperation('running') }),
    );
    fixture.detectChanges();

    expect(button('[data-testid="admin-tools-cache-warm"]').disabled).toBe(true);
    jest.advanceTimersByTime(1000);
    fixture.detectChanges();

    expect(service.getCacheWarmOperation).toHaveBeenCalledWith('operation-1');
  });

  it('keeps loaded cache context visible when the post-warm metric refresh fails', () => {
    service.getCacheStatus
      .mockReturnValueOnce(of(cacheStatus()))
      .mockReturnValueOnce(throwError(() => apiError('refresh unavailable')));
    fixture.detectChanges();

    click('[data-testid="admin-tools-cache-warm"]');
    jest.advanceTimersByTime(1000);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Локализация');
    expect(fixture.nativeElement.textContent).toContain('Успешно');
    expect(element('[data-testid="admin-tools-cache-action-error"]')).not.toBeNull();
  });

  it('keeps actions locked after a polling error and retries the same operation', () => {
    service.getCacheWarmOperation
      .mockReturnValueOnce(throwError(() => apiError('poll unavailable')))
      .mockReturnValueOnce(of(warmOperation('succeeded')));
    fixture.detectChanges();

    click('[data-testid="admin-tools-cache-warm"]');
    jest.advanceTimersByTime(1000);
    fixture.detectChanges();

    expect(service.getCacheWarmOperation).toHaveBeenCalledTimes(1);
    expect(button('[data-testid="admin-tools-cache-clear"]').disabled).toBe(true);
    expect(button('[data-testid="admin-tools-cache-warm"]').disabled).toBe(true);
    expect(element('[data-testid="admin-tools-cache-action-error"]')).not.toBeNull();
    expect(element('[data-testid="admin-tools-cache-poll-retry"]')).not.toBeNull();
    expect(notifications.error).toHaveBeenCalledWith(
      'Не удалось получить состояние прогрева кэша.',
    );

    jest.advanceTimersByTime(5000);
    expect(service.getCacheWarmOperation).toHaveBeenCalledTimes(1);

    click('[data-testid="admin-tools-cache-poll-retry"]');

    expect(service.getCacheWarmOperation).toHaveBeenLastCalledWith('operation-1');
    expect(fixture.nativeElement.textContent).toContain('Успешно');
    expect(button('[data-testid="admin-tools-cache-clear"]').disabled).toBe(false);
    expect(button('[data-testid="admin-tools-cache-warm"]').disabled).toBe(false);
  });

  it('cancels pending cache warm polling when the page is destroyed', () => {
    fixture.detectChanges();
    click('[data-testid="admin-tools-cache-warm"]');

    fixture.destroy();
    jest.advanceTimersByTime(5000);

    expect(service.getCacheWarmOperation).not.toHaveBeenCalled();
  });

  it('confirms session pruning, updates refreshed counts, and reports deleted sessions', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    fixture.detectChanges();

    click('[data-testid="admin-tools-sessions-prune"]');

    expect(service.pruneAuthSessions).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('Протухшие: 0');
    expect(notifications.success).toHaveBeenCalledWith('Удалено протухших сессий: 12.');
  });

  function click(selector: string): void {
    button(selector).click();
    fixture.detectChanges();
  }

  function button(selector: string): HTMLButtonElement {
    const value = element(selector) as HTMLButtonElement | null;
    expect(value).not.toBeNull();
    return value!;
  }

  function element(selector: string): Element | null {
    return fixture.nativeElement.querySelector(selector) as Element | null;
  }
});

function cacheStatus(options: { domainsEmpty?: boolean } = {}): AdminCacheStatus {
  const keyCount = options.domainsEmpty === true ? 0 : 3;
  return {
    enabled: true,
    configuredTtlSeconds: 86400,
    scheduledWarmIntervalSeconds: 3600,
    domains: [
      {
        domain: 'i18n',
        keyCount,
        minimumRemainingTtlSeconds: keyCount === 0 ? null : 120,
        nonExpiringKeyCount: keyCount === 0 ? 0 : 1,
      },
      {
        domain: 'articles',
        keyCount: 2,
        minimumRemainingTtlSeconds: 60,
        nonExpiringKeyCount: 0,
      },
      {
        domain: 'competency_matrix',
        keyCount: 1,
        minimumRemainingTtlSeconds: 30,
        nonExpiringKeyCount: 0,
      },
    ],
    lastManualWarmOperation: warmOperation('succeeded'),
  };
}

function warmOperation(status: 'queued' | 'running' | 'succeeded' | 'failed'): CacheWarmOperation {
  return {
    operationId: 'operation-1',
    status,
    queuedAt: '2026-07-16T12:00:00Z',
    summary:
      status === 'succeeded'
        ? {
            attempted: 8,
            written: 7,
            skipped: 1,
          }
        : null,
  };
}

function authSessionsStatus(): AuthSessionsStatus {
  return {
    expiredCount: 12,
    expiringSoonCount: 4,
    expiringSoonDays: 7,
    scheduledPruneIntervalSeconds: 3600,
  };
}

function authSessionsPruneResult(): AuthSessionsPruneResult {
  return {
    deletedCount: 12,
    expiredCount: 0,
    expiringSoonCount: 4,
    expiringSoonDays: 7,
    scheduledPruneIntervalSeconds: 3600,
  };
}

function apiError(message: string): ApiError {
  return {
    code: 'admin_tools_error',
    type: 'server_error',
    message,
    location: null,
    attr: null,
  };
}
