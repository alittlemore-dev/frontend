import { DOCUMENT } from '@angular/common';
import { WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { AccountInfo, AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/models/api-error.model';
import { NotificationService } from '../../../core/notifications/notification.service';
import { provideI18nTesting } from '../../../testing/i18n-testing';
import {
  ModeratorDashboardMatrixStats,
  ModeratorDashboardQueueStats,
} from '../models/moderator-dashboard.model';
import { AdminToolsService } from '../services/admin-tools.service';
import { ModeratorDashboardService } from '../services/moderator-dashboard.service';
import { DashboardPageComponent } from './dashboard-page.component';

describe('DashboardPageComponent', () => {
  let fixture: ComponentFixture<DashboardPageComponent>;
  let canManageTeam: WritableSignal<boolean>;
  let currentUser: WritableSignal<AccountInfo | null>;
  let moderatorQueueResponse: Observable<ModeratorDashboardQueueStats>;
  let moderatorMatrixResponse: Observable<ModeratorDashboardMatrixStats>;
  let getQueueStats: jest.Mock;
  let getMatrixStats: jest.Mock;
  let toolsService: {
    getCacheStatus: jest.Mock;
    clearCache: jest.Mock;
    startCacheWarm: jest.Mock;
    getCacheWarmOperation: jest.Mock;
    getAuthSessionsStatus: jest.Mock;
    pruneAuthSessions: jest.Mock;
  };

  beforeEach(async () => {
    canManageTeam = signal(true);
    currentUser = signal({ username: 'admin', role: 'admin' });
    window.localStorage.clear();
    moderatorQueueResponse = of({ total: 3, available: 1, claimed: 2 });
    moderatorMatrixResponse = of({ draft: 8, missingDraft: 4, dangerousPublished: 2 });
    getQueueStats = jest.fn(() => moderatorQueueResponse);
    getMatrixStats = jest.fn(() => moderatorMatrixResponse);
    toolsService = {
      getCacheStatus: jest.fn().mockReturnValue(of(cacheStatus())),
      clearCache: jest.fn().mockReturnValue(of(cacheStatus())),
      startCacheWarm: jest.fn(),
      getCacheWarmOperation: jest.fn(),
      getAuthSessionsStatus: jest.fn().mockReturnValue(of(sessionsStatus())),
      pruneAuthSessions: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardPageComponent],
      providers: [
        provideRouter([]),
        provideI18nTesting(),
        { provide: AuthService, useValue: { canManageTeam, currentUser } },
        {
          provide: ModeratorDashboardService,
          useValue: { getQueueStats, getMatrixStats },
        },
        { provide: AdminToolsService, useValue: toolsService },
        {
          provide: NotificationService,
          useValue: { success: jest.fn(), error: jest.fn() },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    if (fixture && !fixture.componentRef.hostView.destroyed) fixture.destroy();
  });

  function render(): void {
    fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();
  }

  function renderModerator(): void {
    canManageTeam.set(false);
    currentUser.set({ username: 'moderator', role: 'moderator' });
    render();
  }

  it('renders manager operational tools directly without dashboard tabs', () => {
    render();

    const view = fixture.nativeElement.querySelector(
      '[data-testid="dashboard-manager-view"]',
    ) as HTMLElement;

    expect(view.querySelector('[role="tablist"]')).toBeNull();
    expect(view.querySelector('[role="tabpanel"]')).toBeNull();
    expect(view.querySelector('app-admin-tools-widget')).not.toBeNull();
    expect(view.querySelector('[data-testid="admin-tools-cache-card"]')).not.toBeNull();
    expect(view.querySelector('[data-testid="admin-tools-sessions-card"]')).not.toBeNull();
    expect(getQueueStats).not.toHaveBeenCalled();
    expect(getMatrixStats).not.toHaveBeenCalled();
  });

  it('refreshes both directly rendered manager tools', () => {
    render();

    (
      fixture.nativeElement.querySelector('[data-testid="dashboard-refresh"]') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(toolsService.getCacheStatus).toHaveBeenCalledTimes(2);
    expect(toolsService.getAuthSessionsStatus).toHaveBeenCalledTimes(2);
  });

  it('keeps moderator Matrix and Queue views as accessible tabs', () => {
    renderModerator();

    const tabs = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid^="dashboard-tab-"]'),
    ) as HTMLButtonElement[];
    const panels = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid^="dashboard-tabpanel-"]'),
    ) as HTMLElement[];

    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual([
      'Очередь вопросов',
      'Качество матрицы компетенций',
    ]);
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    expect(panels.map((panel) => panel.hidden)).toEqual([false, true]);

    tabs[1].click();
    fixture.detectChanges();

    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'true']);
    expect(panels.map((panel) => panel.hidden)).toEqual([true, false]);
    expect(tabs[1].getAttribute('aria-controls')).toBe(panels[1].id);
    expect(panels[1].getAttribute('aria-labelledby')).toBe(tabs[1].id);
  });

  it('renders moderator statistics and links without manager-only tools', () => {
    renderModerator();

    expect(getQueueStats).toHaveBeenCalledTimes(1);
    expect(getMatrixStats).toHaveBeenCalledWith('ru');
    const view = fixture.nativeElement.querySelector(
      '[data-testid="dashboard-moderator-view"]',
    ) as HTMLElement;
    expect(view.textContent).toContain('Всего в очереди');
    expect(view.textContent).toContain('Черновики с пропусками');
    expect(
      view.querySelector('a[href="/admin-panel/matrix-question-queue?availability=available"]'),
    ).not.toBeNull();
    expect(
      view.querySelector(
        'a[href="/admin-panel/matrix-questions?publishStatus=Draft&hasMissingFields=true"]',
      ),
    ).not.toBeNull();
    expect(view.querySelector('app-admin-tools-widget')).toBeNull();
    expect(toolsService.getCacheStatus).not.toHaveBeenCalled();
  });

  it('keeps the Matrix panel usable when the moderator Queue request fails', () => {
    moderatorQueueResponse = throwError(() => apiError('queue unavailable'));
    renderModerator();

    const queueBody = fixture.nativeElement.querySelector(
      '[data-testid="dashboard-section-body-moderator-question-queue"]',
    ) as HTMLElement;
    const matrixBody = fixture.nativeElement.querySelector(
      '[data-testid="dashboard-section-body-moderator-matrix-quality"]',
    ) as HTMLElement;
    expect(queueBody.querySelector('app-error-message')).not.toBeNull();
    expect(matrixBody.querySelector('app-error-message')).toBeNull();
    expect(matrixBody.textContent).toContain('Черновики с пропусками');

    moderatorQueueResponse = of({ total: 3, available: 1, claimed: 2 });
    (queueBody.querySelector('app-error-message button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(queueBody.querySelector('app-error-message')).toBeNull();
    expect(getQueueStats).toHaveBeenCalledTimes(2);
    expect(getMatrixStats).toHaveBeenCalledTimes(1);
  });

  it('persists moderator foldable-section state by username', () => {
    renderModerator();
    const toggle = fixture.nativeElement.querySelector(
      '[data-testid="dashboard-section-toggle-moderator-question-queue"]',
    ) as HTMLButtonElement;

    toggle.click();
    fixture.detectChanges();

    expect(window.localStorage.getItem('adminDashboardSections:v1:moderator')).toBe(
      '["moderator-question-queue"]',
    );
    fixture.destroy();
    renderModerator();
    expect(
      (
        fixture.nativeElement.querySelector(
          '[data-testid="dashboard-section-toggle-moderator-question-queue"]',
        ) as HTMLButtonElement
      ).getAttribute('aria-expanded'),
    ).toBe('false');
  });

  it('keeps moderator panel toggles usable without browser storage', () => {
    const serverDocument = new Proxy(document, {
      get(target, property): unknown {
        if (property === 'defaultView') return null;
        const value: unknown = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    TestBed.overrideProvider(DOCUMENT, { useValue: serverDocument });
    renderModerator();
    const toggle = fixture.nativeElement.querySelector(
      '[data-testid="dashboard-section-toggle-moderator-question-queue"]',
    ) as HTMLButtonElement;

    toggle.click();
    fixture.detectChanges();

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
});

function cacheStatus(): object {
  return {
    enabled: true,
    configuredTtlSeconds: 86400,
    scheduledWarmIntervalSeconds: 3600,
    domains: [],
    lastManualWarmOperation: null,
  };
}

function sessionsStatus(): object {
  return {
    expiredCount: 12,
    expiringSoonCount: 4,
    expiringSoonDays: 7,
    scheduledPruneIntervalSeconds: 3600,
  };
}

function apiError(message: string): ApiError {
  return {
    code: 'dashboard_error',
    type: 'server_error',
    message,
    location: null,
    attr: null,
  };
}
