import { DOCUMENT } from '@angular/common';
import { PLATFORM_ID, computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { HealthcheckOverview, mapHealthcheckOverview } from '../../models/healthcheck.model';
import { HealthcheckService } from '../../services/healthcheck.service';
import { healthcheckDto, backupSmokeDto } from '../../models/healthcheck.fixture';
import { DashboardHealthcheckComponent } from './dashboard-healthcheck.component';

describe('DashboardHealthcheckComponent', () => {
  let fixture: ComponentFixture<DashboardHealthcheckComponent>;
  let getHealthcheck: jest.Mock;
  const user = signal({ username: 'owner', role: 'owner' });

  beforeEach(async () => {
    jest.useFakeTimers();
    user.set({ username: 'owner', role: 'owner' });
    getHealthcheck = jest.fn(() => of(mapHealthcheckOverview(healthcheckDto())));
    await TestBed.configureTestingModule({
      imports: [DashboardHealthcheckComponent],
      providers: [
        provideI18nTesting(),
        { provide: HealthcheckService, useValue: { getHealthcheck } },
        {
          provide: AuthService,
          useValue: { currentUser: user, isOwner: computed(() => user().role === 'owner') },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    if (fixture && !fixture.componentRef.hostView.destroyed) fixture.destroy();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  function render(active = true): void {
    fixture = TestBed.createComponent(DashboardHealthcheckComponent);
    fixture.componentRef.setInput('active', active);
    fixture.detectChanges();
  }

  it('loads only for an active owner and renders one row per distinct set', () => {
    render(false);
    expect(getHealthcheck).not.toHaveBeenCalled();
    fixture.componentRef.setInput('active', true);
    fixture.detectChanges();
    expect(getHealthcheck).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelectorAll('[data-testid="healthcheck-set"]')).toHaveLength(
      1,
    );
    expect(
      fixture.nativeElement.querySelector('[data-testid="healthcheck-status"]'),
    ).not.toBeNull();
  });

  it('renders real backup smoke metadata with three retained sets per destination', () => {
    const overview = mapHealthcheckOverview(backupSmokeDto);
    getHealthcheck.mockReturnValueOnce(of(overview));
    render();
    const backup = overview.systems[0].backup!;
    expect(overview.systems[0].status).toBe('healthy');
    expect(backup.destinations).toHaveLength(2);
    expect(fixture.nativeElement.querySelectorAll('[data-testid="healthcheck-set"]')).toHaveLength(
      6,
    );
    for (const destination of backup.destinations) {
      expect(destination.retainedSets).toHaveLength(3);
      expect(new Set(destination.retainedSets.flatMap((set) => set.roles)).size).toBe(3);
    }
    expect(fixture.nativeElement.textContent).toContain(
      fixture.componentInstance.formatTime(backup.lastSuccessAt),
    );
    expect(backup.lastRestoreVerifiedAt).toBeNull();
  });

  it('replaces a previous healthy view with unavailable and supports retry', () => {
    render();
    getHealthcheck.mockReturnValueOnce(throwError(() => new Error('unavailable')));
    fixture.componentInstance.refresh();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="healthcheck-status"]')).toBeNull();
    const warning = fixture.nativeElement.querySelector(
      '[data-testid="healthcheck-unavailable"]',
    ) as HTMLElement;
    expect(warning).not.toBeNull();
    warning.querySelector('button')!.click();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[data-testid="healthcheck-unavailable"]'),
    ).toBeNull();
  });

  it('does not overlap requests and cancels when the role or active tab changes', () => {
    const response = new Subject<HealthcheckOverview>();
    getHealthcheck.mockReturnValue(response);
    render();
    jest.advanceTimersByTime(60000);
    expect(getHealthcheck).toHaveBeenCalledTimes(1);
    fixture.componentRef.setInput('active', false);
    fixture.detectChanges();
    expect(response.observed).toBe(false);
    fixture.componentRef.setInput('active', true);
    fixture.detectChanges();
    user.set({ username: 'owner', role: 'admin' });
    fixture.detectChanges();
    expect(response.observed).toBe(false);
    jest.advanceTimersByTime(60000);
    expect(getHealthcheck).toHaveBeenCalledTimes(2);
  });

  it('waits until the polling interval after an asynchronous success', () => {
    const response = new Subject<HealthcheckOverview>();
    getHealthcheck.mockReturnValueOnce(response);
    render();
    response.next(mapHealthcheckOverview(healthcheckDto()));
    response.complete();
    fixture.detectChanges();
    expect(getHealthcheck).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(29999);
    fixture.detectChanges();
    expect(getHealthcheck).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    expect(getHealthcheck).toHaveBeenCalledTimes(2);
  });

  it.each(['stale', 'failed'])(
    'replaces healthy status with %s from a responding system',
    (status) => {
      render();
      const dto = healthcheckDto();
      dto['systems'] = [
        { id: 'backups', kind: 'backups', status, observed_at: null, backup: null },
      ];
      getHealthcheck.mockReturnValueOnce(of(mapHealthcheckOverview(dto)));
      fixture.componentInstance.refresh();
      fixture.detectChanges();
      expect(
        fixture.nativeElement
          .querySelector('[data-testid="healthcheck-status"]')
          .classList.contains('text-success'),
      ).toBe(false);
      expect(fixture.componentInstance.overview()?.systems[0].status).toBe(status);
    },
  );

  it('cancels pending requests before loading for a different owner', () => {
    const response = new Subject<HealthcheckOverview>();
    getHealthcheck.mockReturnValueOnce(response);
    render();
    user.set({ username: 'another-owner', role: 'owner' });
    fixture.detectChanges();
    expect(response.observed).toBe(false);
    expect(getHealthcheck).toHaveBeenCalledTimes(2);
  });

  it('pauses in a hidden document and refreshes immediately when visible again', () => {
    let visibility: DocumentVisibilityState = 'visible';
    jest.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
    render();
    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    jest.advanceTimersByTime(60000);
    expect(getHealthcheck).toHaveBeenCalledTimes(1);
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(getHealthcheck).toHaveBeenCalledTimes(2);
    fixture.destroy();
    document.dispatchEvent(new Event('visibilitychange'));
    jest.advanceTimersByTime(60000);
    expect(getHealthcheck).toHaveBeenCalledTimes(2);
  });

  it('does not request or start timers with a server-like document', () => {
    const serverDocument = new Proxy(document, {
      get(target, property): unknown {
        if (property === 'defaultView') return null;
        const value: unknown = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    TestBed.overrideProvider(DOCUMENT, { useValue: serverDocument });
    TestBed.overrideProvider(PLATFORM_ID, { useValue: 'server' });
    render();
    fixture.componentInstance.refresh();
    jest.advanceTimersByTime(60000);
    expect(getHealthcheck).not.toHaveBeenCalled();
  });
});
