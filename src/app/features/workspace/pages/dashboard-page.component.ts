import {
  EmptyStateComponent,
  ErrorMessageComponent,
  LoadingSpinnerComponent,
} from '@alittlemore.dev/design-system';
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
import { RouterLink } from '@angular/router';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ApiError } from '../../../core/models/api-error.model';

import { FoldableSectionComponent } from '@alittlemore.dev/design-system';
import { ToolsWidgetComponent } from '../components/tools-widget/tools-widget.component';
import { MonthCalendarWidgetComponent } from '../components/month-calendar-widget/month-calendar-widget.component';
import { formatAnnualDate } from '../knowledge/shared/annual-date';
import { Calendar, CalendarEntry } from '../models/calendar.model';
import { CalendarService } from '../services/calendar.service';

type DashboardSectionKey = 'upcoming-dates';

type DashboardTabKey = 'home' | 'month-calendar' | 'tools';

interface DashboardTabDefinition {
  key: DashboardTabKey;
  labelKey: string;
}

const DASHBOARD_COLLAPSED_SECTIONS_STORAGE_KEY = 'dashboardCollapsedSections';

const DASHBOARD_TABS: readonly DashboardTabDefinition[] = [
  { key: 'home', labelKey: 'workspaceDashboard.home.title' },
  { key: 'month-calendar', labelKey: 'workspaceDashboard.calendar.title' },
  { key: 'tools', labelKey: 'workspaceDashboard.tools.title' },
];

const DASHBOARD_SECTIONS: readonly DashboardSectionKey[] = ['upcoming-dates'];

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    RouterLink,
    TranslatePipe,
    EmptyStateComponent,
    ErrorMessageComponent,
    LoadingSpinnerComponent,
    FoldableSectionComponent,
    MonthCalendarWidgetComponent,
    ToolsWidgetComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss',
})
export class DashboardPageComponent implements OnInit {
  private readonly calendarService = inject(CalendarService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private upcomingLoadGeneration = 0;

  readonly upcomingCalendar = signal<Calendar | null>(null);
  readonly upcomingLoading = signal(false);
  readonly upcomingError = signal<ApiError | null>(null);
  readonly activeTab = signal<DashboardTabKey>('home');
  readonly tabs = signal<readonly DashboardTabDefinition[]>(DASHBOARD_TABS);
  readonly collapsedSectionKeys = signal<ReadonlySet<DashboardSectionKey>>(
    this.loadCollapsedSectionKeys(),
  );
  readonly knownSectionKeys = signal<readonly DashboardSectionKey[]>(DASHBOARD_SECTIONS);
  readonly datesSummary = computed(() => {
    this.i18n.language();
    const summary = this.upcomingCalendar()?.summary;
    return `${this.i18n.translate('workspaceDashboard.dates.type.memorableDate')}: ${summary?.memorableDateCount ?? 0} · ${this.i18n.translate('workspaceDashboard.dates.type.birthday')}: ${summary?.birthdayCount ?? 0}`;
  });
  ngOnInit(): void {
    this.loadUpcomingDates();
  }

  loadUpcomingDates(): void {
    const generation = ++this.upcomingLoadGeneration;
    this.upcomingLoading.set(true);
    this.upcomingError.set(null);
    this.calendarService
      .getCalendar(browserLocalDate(new Date()), 'currentAndNextMonths')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (calendar) => {
          if (generation !== this.upcomingLoadGeneration) return;
          this.upcomingCalendar.set(calendar);
          this.upcomingLoading.set(false);
        },
        error: (error: ApiError) => {
          if (generation !== this.upcomingLoadGeneration) return;
          this.upcomingError.set(error);
          this.upcomingLoading.set(false);
        },
      });
  }

  isSectionExpanded(sectionKey: DashboardSectionKey): boolean {
    return !this.collapsedSectionKeys().has(sectionKey);
  }

  setSectionExpanded(sectionKey: DashboardSectionKey, expanded: boolean): void {
    if (!this.knownSectionKeys().includes(sectionKey)) return;
    const next = new Set(this.collapsedSectionKeys());
    if (expanded) {
      next.delete(sectionKey);
    } else {
      next.add(sectionKey);
    }
    this.collapsedSectionKeys.set(next);
    this.persistCollapsedSectionKeys(next);
  }

  setActiveTab(tabKey: DashboardTabKey): void {
    if (!this.tabs().some((tab) => tab.key === tabKey)) return;
    this.activeTab.set(tabKey);
  }

  tabId(tabKey: DashboardTabKey): string {
    return `dashboard-tab-${tabKey}`;
  }

  tabPanelId(tabKey: DashboardTabKey): string {
    return `dashboard-tabpanel-${tabKey}`;
  }

  annualDateLabel(entry: CalendarEntry): string {
    return formatAnnualDate(
      { day: entry.annualDate.day, month: entry.annualDate.month, year: null },
      this.i18n.dateLocale(),
    );
  }

  entryRoute(entry: CalendarEntry): readonly string[] {
    if (entry.kind === 'memorableDate') {
      return ['/personal-workspace/knowledge/dates', entry.id];
    }
    return ['/personal-workspace/knowledge/people', entry.id];
  }

  additionalInfoItems(entry: CalendarEntry): readonly string[] {
    const items: string[] = [];
    if (entry.period === 'nextMonth') {
      items.push(this.i18n.translate('workspaceDashboard.dates.nextMonth'));
    }
    if (entry.annualDate.year !== null) {
      const years = entry.occurrenceYear - entry.annualDate.year;
      if (years >= 0) {
        const category = new Intl.PluralRules(this.i18n.dateLocale()).select(years);
        const suffix = pluralSuffix(category);
        const prefix = entry.kind === 'birthday' ? 'age' : 'anniversary';
        items.push(
          this.i18n.translate(`workspaceDashboard.dates.${prefix}.${suffix}`, { count: years }),
        );
      }
    }
    return items;
  }

  private loadCollapsedSectionKeys(): ReadonlySet<DashboardSectionKey> {
    try {
      const storedValue = this.storage()?.getItem(DASHBOARD_COLLAPSED_SECTIONS_STORAGE_KEY);
      if (storedValue === null || storedValue === undefined) return new Set<DashboardSectionKey>();
      const parsedValue: unknown = JSON.parse(storedValue);
      if (!Array.isArray(parsedValue)) return new Set<DashboardSectionKey>();
      return new Set(parsedValue.filter(isDashboardSectionKey));
    } catch {
      return new Set<DashboardSectionKey>();
    }
  }

  private storage(): Storage | null {
    return this.document.defaultView?.localStorage ?? null;
  }

  private persistCollapsedSectionKeys(sectionKeys: ReadonlySet<DashboardSectionKey>): void {
    try {
      this.storage()?.setItem(
        DASHBOARD_COLLAPSED_SECTIONS_STORAGE_KEY,
        JSON.stringify([...sectionKeys]),
      );
    } catch {
      return;
    }
  }
}

function isDashboardSectionKey(value: unknown): value is DashboardSectionKey {
  return typeof value === 'string' && DASHBOARD_SECTIONS.some((sectionKey) => sectionKey === value);
}

function browserLocalDate(value: Date): string {
  const year = String(value.getFullYear()).padStart(4, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function pluralSuffix(category: Intl.LDMLPluralRule): 'one' | 'few' | 'many' | 'other' {
  if (category === 'one' || category === 'few' || category === 'many') return category;
  return 'other';
}
