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
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { I18nService } from '../../../core/i18n/i18n.service';
import { AccountSettingsService } from '../../../core/auth/account-settings.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ApiError } from '../../../core/models/api-error.model';

import { FoldableSectionComponent } from '@alittlemore.dev/design-system';
import { ImportantInfoComponent } from '../components/important-info/important-info.component';
import { EventsCalendarComponent } from '../components/events-calendar/events-calendar.component';
import { CalendarOccurrence, CalendarOccurrences } from '../models/events.model';
import { EventsService } from '../services/events.service';
import { Temporal } from 'temporal-polyfill';
import {
  VaultDashboardComponent,
  VaultSectionKey,
} from '../components/vault-dashboard/vault-dashboard.component';

type DashboardSectionKey = 'upcoming-dates' | 'important-info' | VaultSectionKey;

type DashboardTabKey = 'home' | 'month-calendar';

interface DashboardTabDefinition {
  key: DashboardTabKey;
  labelKey: string;
}

const DASHBOARD_COLLAPSED_SECTIONS_STORAGE_KEY = 'dashboardCollapsedSections';

const DASHBOARD_TABS: readonly DashboardTabDefinition[] = [
  { key: 'home', labelKey: 'workspaceDashboard.home.title' },
  { key: 'month-calendar', labelKey: 'workspaceDashboard.calendar.title' },
];

const DASHBOARD_SECTIONS: readonly DashboardSectionKey[] = [
  'important-info',
  'upcoming-dates',
  'vault-recent',
  'vault-statistics',
];

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
    ImportantInfoComponent,
    EventsCalendarComponent,
    VaultDashboardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss',
})
export class DashboardPageComponent implements OnInit {
  private readonly eventsService = inject(EventsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly preferences = inject(AccountSettingsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private upcomingLoadGeneration = 0;
  private previousTimeZone = this.preferences.timeZone();

  reloadCalendar(): void {
    this.document.defaultView?.location.reload();
  }

  readonly upcomingCalendar = signal<CalendarOccurrences | null>(null);
  readonly upcomingLoading = signal(false);
  readonly upcomingError = signal<ApiError | null>(null);
  readonly activeTab = signal<DashboardTabKey>('home');
  readonly vaultRefreshVersion = signal(0);
  readonly tabs = signal<readonly DashboardTabDefinition[]>(DASHBOARD_TABS);
  readonly collapsedSectionKeys = signal<ReadonlySet<DashboardSectionKey>>(
    this.loadCollapsedSectionKeys(),
  );
  readonly knownSectionKeys = signal<readonly DashboardSectionKey[]>(DASHBOARD_SECTIONS);
  readonly upcomingEntries = computed(() => {
    const zone = this.preferences.timeZone();
    const now = Temporal.Instant.from(new Date().toISOString());
    return [...(this.upcomingCalendar()?.entries ?? [])]
      .filter(
        (entry) =>
          Temporal.Instant.compare(
            entry.allDay
              ? Temporal.PlainDate.from(entry.end).toZonedDateTime(zone).toInstant()
              : Temporal.Instant.from(entry.end),
            now,
          ) > 0,
      )
      .sort((left, right) => {
        const start = (entry: CalendarOccurrence): string =>
          entry.allDay
            ? Temporal.PlainDate.from(entry.start).toZonedDateTime(zone).toInstant().toString()
            : entry.start;
        return Temporal.Instant.compare(
          Temporal.Instant.from(start(left)),
          Temporal.Instant.from(start(right)),
        );
      })
      .slice(0, 6);
  });
  constructor() {
    effect(() => {
      const zone = this.preferences.timeZone();
      if (zone === this.previousTimeZone) return;
      this.previousTimeZone = zone;
      untracked(() => this.loadUpcomingDates());
    });
  }
  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.activeTab.set(params.get('tab') === 'month-calendar' ? 'month-calendar' : 'home');
    });
    this.loadUpcomingDates();
  }

  loadUpcomingDates(): void {
    const generation = ++this.upcomingLoadGeneration;
    this.upcomingLoading.set(true);
    this.upcomingError.set(null);
    const today = Temporal.Instant.from(new Date().toISOString())
      .toZonedDateTimeISO(this.preferences.timeZone())
      .toPlainDate();
    this.eventsService
      .occurrences(today.toString(), today.with({ day: 1 }).add({ months: 2 }).toString())
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

  onKnowledgeCreated(): void {
    this.vaultRefreshVersion.update((version) => version + 1);
    this.loadUpcomingDates();
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
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tabKey === 'home' ? null : tabKey },
      queryParamsHandling: 'merge',
    });
  }

  tabId(tabKey: DashboardTabKey): string {
    return `dashboard-tab-${tabKey}`;
  }

  tabPanelId(tabKey: DashboardTabKey): string {
    return `dashboard-tabpanel-${tabKey}`;
  }

  entryRoute(entry: CalendarOccurrence): readonly string[] {
    if (entry.kind === 'event') return ['/personal-workspace'];
    return [
      entry.kind === 'memorableDate'
        ? '/personal-workspace/knowledge/dates'
        : '/personal-workspace/knowledge/people',
      entry.sourceId,
    ];
  }

  eventQuery(entry: CalendarOccurrence): Record<string, string> | null {
    if (entry.kind !== 'event') return null;
    return { tab: 'month-calendar', date: this.entryDay(entry) };
  }

  entryDay(entry: CalendarOccurrence): string {
    return entry.allDay
      ? entry.start
      : Temporal.Instant.from(entry.start)
          .toZonedDateTimeISO(this.preferences.timeZone())
          .toPlainDate()
          .toString();
  }

  entryDateLabel(entry: CalendarOccurrence): string {
    return new Intl.DateTimeFormat(this.i18n.dateLocale(), {
      dateStyle: 'medium',
      ...(entry.allDay ? {} : { timeStyle: 'short' as const }),
      timeZone: entry.allDay ? 'UTC' : this.preferences.timeZone(),
    }).format(new Date(entry.allDay ? entry.start + 'T00:00:00Z' : entry.start));
  }

  private loadCollapsedSectionKeys(): ReadonlySet<DashboardSectionKey> {
    try {
      const storedValue = this.storage()?.getItem(DASHBOARD_COLLAPSED_SECTIONS_STORAGE_KEY);
      if (storedValue === null || storedValue === undefined)
        return new Set<DashboardSectionKey>(['vault-statistics']);
      const parsedValue: unknown = JSON.parse(storedValue);
      if (!Array.isArray(parsedValue)) return new Set<DashboardSectionKey>(['vault-statistics']);
      return new Set(parsedValue.filter(isDashboardSectionKey));
    } catch {
      return new Set<DashboardSectionKey>(['vault-statistics']);
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
