import { NotificationService } from '@alittlemore.dev/design-system';
import { DOCUMENT } from '@angular/common';
import { ComponentFixture, DeferBlockState, TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { NEVER } from 'rxjs';
import { I18nService } from '../../../core/i18n/i18n.service';

import { provideI18nTesting } from '../../../testing/i18n-testing';
import { EventsService } from '../services/events.service';
import { ImportantInfoService } from '../services/important-info.service';
import { DashboardPageComponent } from './dashboard-page.component';
import { EventsCalendarComponent } from '../components/events-calendar/events-calendar.component';
import { VaultService } from '../services/vault.service';
import { AccountSettingsService } from '../../../core/auth/account-settings.service';

@Component({
  selector: 'app-events-calendar',
  standalone: true,
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StubEventsCalendarComponent {
  readonly knowledgeCreated = output<void>();
}

const DASHBOARD_COLLAPSED_SECTIONS_STORAGE_KEY = 'dashboardCollapsedSections';

describe('DashboardPageComponent', () => {
  let fixture: ComponentFixture<DashboardPageComponent>;
  const timeZone = signal('UTC');
  const occurrences = jest.fn(() => NEVER);

  beforeEach(async () => {
    localStorage.clear();
    timeZone.set('UTC');
    occurrences.mockClear();
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: VaultService,
          useValue: { recent: jest.fn(() => NEVER), statistics: jest.fn(() => NEVER) },
        },
        provideI18nTesting(),

        { provide: AccountSettingsService, useValue: { timeZone } },
        { provide: EventsService, useValue: { occurrences } },
        { provide: ImportantInfoService, useValue: { list: jest.fn(() => NEVER) } },
        {
          provide: NotificationService,
          useValue: { success: jest.fn(), error: jest.fn() },
        },
      ],
    })
      .overrideComponent(DashboardPageComponent, {
        remove: { imports: [EventsCalendarComponent] },
        add: { imports: [StubEventsCalendarComponent] },
      })
      .compileComponents();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  it('starts with dashboard tabs and omits obsolete page actions', () => {
    fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();

    const root = fixture.nativeElement.firstElementChild as HTMLElement;
    const tabs = root.querySelector('[data-testid="dashboard-tabs"]');

    expect(tabs?.getAttribute('role')).toBe('tablist');
    expect(root.querySelector('[role="tab"][aria-selected="true"]')).not.toBeNull();
  });

  it('loads the calendar only after selecting its tab', async () => {
    fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-events-calendar')).toBeNull();
    const calendarTab = fixture.nativeElement.querySelector(
      '[data-testid="dashboard-tab-month-calendar"]',
    ) as HTMLButtonElement;
    calendarTab.click();
    fixture.detectChanges();

    await (await fixture.getDeferBlocks())[0].render(DeferBlockState.Complete);
    const calendarPanel = fixture.nativeElement.querySelector(
      '[data-testid="dashboard-tabpanel-month-calendar"]',
    ) as HTMLElement;
    expect(calendarPanel.hidden).toBe(false);
    expect(calendarPanel.querySelector('app-events-calendar')).not.toBeNull();
    expect(
      calendarPanel.querySelector('[data-testid="ds-section-toggle-month-calendar"]'),
    ).toBeNull();
  });

  it('offers recovery when the calendar code cannot be loaded', async () => {
    fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();
    fixture.componentInstance.activeTab.set('month-calendar');
    fixture.detectChanges();
    await (await fixture.getDeferBlocks())[0].render(DeferBlockState.Error);
    const panel = fixture.nativeElement.querySelector(
      '[data-testid="dashboard-tabpanel-month-calendar"]',
    ) as HTMLElement;
    expect(panel.querySelector('[role="alert"]')).not.toBeNull();
    expect(panel.querySelector('ds-loading-spinner')).toBeNull();
    const reload = jest
      .spyOn(fixture.componentInstance, 'reloadCalendar')
      .mockImplementation(() => undefined);
    (panel.querySelector('button') as HTMLButtonElement).click();
    expect(reload).toHaveBeenCalled();
  });

  it('loads only known collapsed sections from browser storage', () => {
    localStorage.setItem(
      DASHBOARD_COLLAPSED_SECTIONS_STORAGE_KEY,
      JSON.stringify([
        'upcoming-dates',
        'vault-recent',
        'vault-statistics',
        'tools',
        'unknown-section',
      ]),
    );

    fixture = TestBed.createComponent(DashboardPageComponent);

    expect(fixture.componentInstance.isSectionExpanded('upcoming-dates')).toBe(false);
    expect(fixture.componentInstance.isSectionExpanded('vault-recent')).toBe(false);
    expect(fixture.componentInstance.isSectionExpanded('vault-statistics')).toBe(false);
    expect(fixture.componentInstance.collapsedSectionKeys().size).toBe(3);
  });

  it('keeps sections expanded when no preference has been stored', () => {
    fixture = TestBed.createComponent(DashboardPageComponent);

    expect(fixture.componentInstance.isSectionExpanded('upcoming-dates')).toBe(true);
  });

  it('ignores malformed collapsed-section preferences', () => {
    localStorage.setItem(DASHBOARD_COLLAPSED_SECTIONS_STORAGE_KEY, '{not-json');

    const component = TestBed.runInInjectionContext(() => new DashboardPageComponent());

    expect(component.isSectionExpanded('upcoming-dates')).toBe(true);
  });

  it('does not access browser storage for a server-like document', () => {
    const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('localStorage is not available on the server');
    });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: EventsService, useValue: { occurrences: jest.fn() } },
        { provide: AccountSettingsService, useValue: { timeZone } },
        { provide: I18nService, useValue: {} },
        { provide: DOCUMENT, useValue: { defaultView: null } },
      ],
    });

    const component = TestBed.runInInjectionContext(() => new DashboardPageComponent());

    expect(component.isSectionExpanded('upcoming-dates')).toBe(true);
    expect(getItem).not.toHaveBeenCalled();
  });

  it('persists a collapsed section when the user toggles it', () => {
    fixture = TestBed.createComponent(DashboardPageComponent);

    fixture.componentInstance.setSectionExpanded('upcoming-dates', false);

    expect(localStorage.getItem(DASHBOARD_COLLAPSED_SECTIONS_STORAGE_KEY)).toBe(
      JSON.stringify(['vault-statistics', 'upcoming-dates']),
    );
  });

  it('uses the account-local reference day and refreshes it when the zone changes', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-02T01:30:00Z'));
    try {
      fixture = TestBed.createComponent(DashboardPageComponent);
      fixture.detectChanges();
      expect(occurrences).toHaveBeenCalledWith('2026-10-02', '2026-12-01');
      timeZone.set('Pacific/Honolulu');
      TestBed.tick();
      expect(occurrences).toHaveBeenLastCalledWith('2026-10-01', '2026-12-01');
    } finally {
      jest.useRealTimers();
    }
  });
});
