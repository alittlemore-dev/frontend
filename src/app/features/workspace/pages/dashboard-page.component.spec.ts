import { NotificationService } from '@alittlemore.dev/design-system';
import { DOCUMENT } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER } from 'rxjs';
import { I18nService } from '../../../core/i18n/i18n.service';

import { provideI18nTesting } from '../../../testing/i18n-testing';
import { CalendarService } from '../services/calendar.service';
import { ToolsService } from '../services/tools.service';
import { DashboardPageComponent } from './dashboard-page.component';

const DASHBOARD_COLLAPSED_SECTIONS_STORAGE_KEY = 'dashboardCollapsedSections';

describe('DashboardPageComponent', () => {
  let fixture: ComponentFixture<DashboardPageComponent>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideI18nTesting(),
        { provide: CalendarService, useValue: { getCalendar: jest.fn(() => NEVER) } },
        {
          provide: ToolsService,
          useValue: {
            getCacheStatus: jest.fn(() => NEVER),
            clearCache: jest.fn(() => NEVER),
            startCacheWarm: jest.fn(() => NEVER),
            getCacheWarmOperation: jest.fn(() => NEVER),
          },
        },
        {
          provide: NotificationService,
          useValue: { success: jest.fn(), error: jest.fn() },
        },
      ],
    }).compileComponents();
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

    expect(root.firstElementChild).toBe(tabs);
    expect(root.querySelector('h2')).toBeNull();
    expect(root.querySelector('[data-testid="dashboard-refresh"]')).toBeNull();
  });

  it('shows the month calendar without a collapse control', () => {
    fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();

    const calendarTab = fixture.nativeElement.querySelector(
      '[data-testid="dashboard-tab-month-calendar"]',
    ) as HTMLButtonElement;
    calendarTab.click();
    fixture.detectChanges();

    const calendarPanel = fixture.nativeElement.querySelector(
      '[data-testid="dashboard-tabpanel-month-calendar"]',
    ) as HTMLElement;
    expect(calendarPanel.hidden).toBe(false);
    expect(calendarPanel.querySelector('app-month-calendar-widget')).not.toBeNull();
    expect(
      calendarPanel.querySelector('[data-testid="ds-section-toggle-month-calendar"]'),
    ).toBeNull();
  });

  it('shows tools without a collapse control', () => {
    fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();

    const toolsTab = fixture.nativeElement.querySelector(
      '[data-testid="dashboard-tab-tools"]',
    ) as HTMLButtonElement;
    toolsTab.click();
    fixture.detectChanges();

    const toolsPanel = fixture.nativeElement.querySelector(
      '[data-testid="dashboard-tabpanel-tools"]',
    ) as HTMLElement;
    expect(toolsPanel.hidden).toBe(false);
    expect(toolsPanel.querySelector('app-tools-widget')).not.toBeNull();
    expect(toolsPanel.querySelector('[data-testid="ds-section-toggle-tools"]')).toBeNull();
  });

  it('loads only known collapsed sections from browser storage', () => {
    localStorage.setItem(
      DASHBOARD_COLLAPSED_SECTIONS_STORAGE_KEY,
      JSON.stringify(['upcoming-dates', 'tools', 'unknown-section']),
    );

    fixture = TestBed.createComponent(DashboardPageComponent);

    expect(fixture.componentInstance.isSectionExpanded('upcoming-dates')).toBe(false);
    expect(fixture.componentInstance.collapsedSectionKeys().size).toBe(1);
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
        { provide: CalendarService, useValue: { getCalendar: jest.fn() } },
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
      JSON.stringify(['upcoming-dates']),
    );
  });
});
