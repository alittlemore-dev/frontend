import { NotificationService } from '@alittlemore.dev/design-system';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { ApiError } from '../../../../core/models/api-error.model';

import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { CacheStatus, CacheWarmOperation } from '../../models/tools.model';
import { ToolsService } from '../../services/tools.service';
import { ToolsWidgetComponent } from './tools-widget.component';

interface ToolsServiceMock {
  getCacheStatus: jest.Mock;
  clearCache: jest.Mock;
  startCacheWarm: jest.Mock;
  getCacheWarmOperation: jest.Mock;
}

describe('ToolsWidgetComponent', () => {
  let fixture: ComponentFixture<ToolsWidgetComponent>;
  let service: ToolsServiceMock;

  beforeEach(async () => {
    jest.useFakeTimers();
    service = {
      getCacheStatus: jest.fn(() => of(cacheStatus(3))),
      clearCache: jest.fn(() => of(cacheStatus(0))),
      startCacheWarm: jest.fn(() => of(warmOperation('queued'))),
      getCacheWarmOperation: jest.fn(() => of(warmOperation('succeeded'))),
    };

    await TestBed.configureTestingModule({
      imports: [ToolsWidgetComponent],
      providers: [
        provideI18nTesting(),
        { provide: ToolsService, useValue: service },
        {
          provide: NotificationService,
          useValue: { success: jest.fn(), error: jest.fn() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ToolsWidgetComponent);
  });

  afterEach(() => {
    if (!fixture.componentRef.hostView.destroyed) {
      fixture.destroy();
    }
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('keeps the cache card stable while its initial request is pending', () => {
    service.getCacheStatus.mockReturnValue(new Subject<CacheStatus>());

    fixture.detectChanges();

    expect(element('[data-testid="tools-cache-card"]')).not.toBeNull();
    expect(element('[data-testid="tools-cache-skeleton"]')).not.toBeNull();
    expect(element('[data-testid="tools-cache-clear"]')).toBeNull();
  });

  it('renders a failed initial request and replaces it with cache data after retry', () => {
    service.getCacheStatus
      .mockReturnValueOnce(throwError(() => apiError('Cache status is unavailable.')))
      .mockReturnValueOnce(of(cacheStatus(3)));

    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Cache status is unavailable.',
    );

    click('[data-testid="tools-cache-retry"]');

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Ключей: 3');
    expect(element('[data-testid="tools-cache-retry"]')).toBeNull();
  });

  it('changes displayed cache state only after the user confirms clearing', () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    fixture.detectChanges();

    click('[data-testid="tools-cache-clear"]');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Ключей: 3');

    confirm.mockReturnValue(true);
    click('[data-testid="tools-cache-clear"]');

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Ключей: 0');
  });

  it('shows a queued warm as busy and unlocks actions after terminal polling', () => {
    fixture.detectChanges();

    click('[data-testid="tools-cache-warm"]');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('В очереди');
    expect(button('[data-testid="tools-cache-clear"]').disabled).toBe(true);
    expect(button('[data-testid="tools-cache-warm"]').disabled).toBe(true);

    jest.advanceTimersByTime(1000);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Успешно');
    expect(button('[data-testid="tools-cache-clear"]').disabled).toBe(false);
    expect(button('[data-testid="tools-cache-warm"]').disabled).toBe(false);
  });

  it('cancels a queued warm poll when the widget is destroyed', () => {
    fixture.detectChanges();
    click('[data-testid="tools-cache-warm"]');

    fixture.destroy();
    jest.advanceTimersByTime(1000);

    expect(service.getCacheWarmOperation).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  function click(selector: string): void {
    button(selector).click();
    fixture.detectChanges();
  }

  function button(selector: string): HTMLButtonElement {
    const value = element(selector) as HTMLButtonElement | null;
    if (value === null) {
      throw new Error(`Missing button: ${selector}`);
    }
    return value;
  }

  function element(selector: string): Element | null {
    return (fixture.nativeElement as HTMLElement).querySelector(selector);
  }
});

function cacheStatus(keyCount: number): CacheStatus {
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
    ],
    lastManualWarmOperation: null,
  };
}

function warmOperation(status: 'queued' | 'succeeded'): CacheWarmOperation {
  return {
    operationId: 'operation-1',
    status,
    queuedAt: '2026-08-11T12:00:00Z',
    summary: status === 'succeeded' ? { attempted: 2, written: 2, skipped: 0 } : null,
  };
}

function apiError(message: string): ApiError {
  return {
    code: 'cache_unavailable',
    type: 'server_error',
    message,
    status: 503,
    location: null,
    attr: null,
    nested_errors: [],
  };
}
