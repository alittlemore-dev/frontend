import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ApiError } from '../../../core/models/api-error.model';
import { ErrorMessageComponent } from '../../../shared/ui/error-message/error-message.component';
import { LoadingSpinnerComponent } from '../../../shared/ui/loading-spinner/loading-spinner.component';
import { AdminToolsWidgetComponent } from '../components/admin-tools-widget/admin-tools-widget.component';
import { DashboardFoldableSectionComponent } from '../components/dashboard-foldable-section/dashboard-foldable-section.component';
import {
  ModeratorDashboardMatrixStats,
  ModeratorDashboardQueueStats,
} from '../models/moderator-dashboard.model';
import { ModeratorDashboardService } from '../services/moderator-dashboard.service';

type DashboardSectionKey = 'moderator-question-queue' | 'moderator-matrix-quality';
type DashboardTabKey = 'moderator-question-queue' | 'moderator-matrix-quality';

interface DashboardTabDefinition {
  key: DashboardTabKey;
  labelKey: string;
}

const MODERATOR_DASHBOARD_TABS: readonly DashboardTabDefinition[] = [
  { key: 'moderator-question-queue', labelKey: 'dashboard.moderator.queue.title' },
  { key: 'moderator-matrix-quality', labelKey: 'dashboard.moderator.matrix.title' },
];

const MODERATOR_DASHBOARD_SECTIONS: readonly DashboardSectionKey[] = [
  'moderator-question-queue',
  'moderator-matrix-quality',
];

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    RouterLink,
    TranslatePipe,
    ErrorMessageComponent,
    LoadingSpinnerComponent,
    DashboardFoldableSectionComponent,
    AdminToolsWidgetComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss',
})
export class DashboardPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly moderatorDashboardService = inject(ModeratorDashboardService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private moderatorQueueLoadGeneration = 0;
  private moderatorMatrixLoadGeneration = 0;

  @ViewChild(AdminToolsWidgetComponent)
  private adminToolsWidget: AdminToolsWidgetComponent | undefined;

  readonly canManageTeam = this.auth.canManageTeam;
  readonly moderatorQueueStats = signal<ModeratorDashboardQueueStats | null>(null);
  readonly moderatorMatrixStats = signal<ModeratorDashboardMatrixStats | null>(null);
  readonly moderatorQueueLoading = signal(false);
  readonly moderatorQueueError = signal<ApiError | null>(null);
  readonly moderatorMatrixLoading = signal(false);
  readonly moderatorMatrixError = signal<ApiError | null>(null);
  readonly activeTab = signal<DashboardTabKey>('moderator-question-queue');
  readonly tabs = MODERATOR_DASHBOARD_TABS;
  readonly collapsedSectionKeys = signal<ReadonlySet<string>>(new Set<string>());
  readonly moderatorQueueSummary = computed(() => {
    this.i18n.language();
    const queue = this.moderatorQueueStats();
    return `${this.i18n.translate('dashboard.moderator.queue.total')}: ${queue?.total ?? 0} · ${this.i18n.translate('dashboard.moderator.queue.available')}: ${queue?.available ?? 0} · ${this.i18n.translate('dashboard.moderator.queue.claimed')}: ${queue?.claimed ?? 0}`;
  });
  readonly moderatorMatrixSummary = computed(() => {
    this.i18n.language();
    const matrix = this.moderatorMatrixStats();
    return `${this.i18n.translate('dashboard.moderator.matrix.draft')}: ${matrix?.draft ?? 0} · ${this.i18n.translate('dashboard.moderator.matrix.missingDraft')}: ${matrix?.missingDraft ?? 0} · ${this.i18n.translate('dashboard.moderator.matrix.dangerousPublished')}: ${matrix?.dangerousPublished ?? 0}`;
  });

  constructor() {
    effect(() => {
      if (this.canManageTeam()) {
        this.collapsedSectionKeys.set(new Set<string>());
        return;
      }
      this.collapsedSectionKeys.set(
        this.readCollapsedSectionKeys(
          this.auth.currentUser()?.username,
          new Set(MODERATOR_DASHBOARD_SECTIONS),
        ),
      );
    });
  }

  ngOnInit(): void {
    if (!this.canManageTeam()) {
      this.loadModeratorQueue();
      this.loadModeratorMatrix();
    }
  }

  loadDashboard(): void {
    if (this.canManageTeam()) {
      this.adminToolsWidget?.loadCacheStatus();
      this.adminToolsWidget?.loadSessionsStatus();
      return;
    }
    this.loadModeratorQueue();
    this.loadModeratorMatrix();
  }

  loadModeratorQueue(): void {
    const generation = ++this.moderatorQueueLoadGeneration;
    this.moderatorQueueLoading.set(true);
    this.moderatorQueueError.set(null);
    this.moderatorDashboardService
      .getQueueStats()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (queue) => {
          if (generation !== this.moderatorQueueLoadGeneration) return;
          this.moderatorQueueStats.set(queue);
          this.moderatorQueueLoading.set(false);
        },
        error: (error: ApiError) => {
          if (generation !== this.moderatorQueueLoadGeneration) return;
          this.moderatorQueueError.set(error);
          this.moderatorQueueLoading.set(false);
        },
      });
  }

  loadModeratorMatrix(): void {
    const generation = ++this.moderatorMatrixLoadGeneration;
    this.moderatorMatrixLoading.set(true);
    this.moderatorMatrixError.set(null);
    this.moderatorDashboardService
      .getMatrixStats(this.i18n.language()!)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (matrix) => {
          if (generation !== this.moderatorMatrixLoadGeneration) return;
          this.moderatorMatrixStats.set(matrix);
          this.moderatorMatrixLoading.set(false);
        },
        error: (error: ApiError) => {
          if (generation !== this.moderatorMatrixLoadGeneration) return;
          this.moderatorMatrixError.set(error);
          this.moderatorMatrixLoading.set(false);
        },
      });
  }

  isSectionExpanded(sectionKey: DashboardSectionKey): boolean {
    return !this.collapsedSectionKeys().has(sectionKey);
  }

  setSectionExpanded(sectionKey: DashboardSectionKey, expanded: boolean): void {
    if (!MODERATOR_DASHBOARD_SECTIONS.includes(sectionKey)) return;
    this.collapsedSectionKeys.update((current) => {
      const next = new Set(current);
      if (expanded) {
        next.delete(sectionKey);
      } else {
        next.add(sectionKey);
      }
      return next;
    });
    this.writeCollapsedSectionKeys(this.auth.currentUser()?.username);
  }

  setActiveTab(tabKey: DashboardTabKey): void {
    if (!this.tabs.some((tab) => tab.key === tabKey)) return;
    this.activeTab.set(tabKey);
  }

  tabId(tabKey: DashboardTabKey): string {
    return `dashboard-tab-${tabKey}`;
  }

  tabPanelId(tabKey: DashboardTabKey): string {
    return `dashboard-tabpanel-${tabKey}`;
  }

  private readCollapsedSectionKeys(
    username: string | undefined,
    knownKeys: ReadonlySet<string>,
  ): ReadonlySet<string> {
    if (username === undefined) return new Set<string>();
    const storage = this.browserStorage();
    if (storage === null) return new Set<string>();
    try {
      const stored = storage.getItem(dashboardSectionStorageKey(username));
      if (stored === null) return new Set<string>();
      const parsed: unknown = JSON.parse(stored);
      if (!Array.isArray(parsed)) return new Set<string>();
      return new Set(
        parsed.filter(
          (sectionKey): sectionKey is string =>
            typeof sectionKey === 'string' && knownKeys.has(sectionKey),
        ),
      );
    } catch {
      return new Set<string>();
    }
  }

  private writeCollapsedSectionKeys(username: string | undefined): void {
    if (username === undefined) return;
    const storage = this.browserStorage();
    if (storage === null) return;
    try {
      storage.setItem(
        dashboardSectionStorageKey(username),
        JSON.stringify([...this.collapsedSectionKeys()].sort()),
      );
    } catch {
      return;
    }
  }

  private browserStorage(): Storage | null {
    try {
      return this.document.defaultView?.localStorage ?? null;
    } catch {
      return null;
    }
  }
}

function dashboardSectionStorageKey(username: string): string {
  return `adminDashboardSections:v1:${username}`;
}
