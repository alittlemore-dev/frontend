import {
  EmptyStateComponent,
  ErrorMessageComponent,
  FoldableSectionComponent,
  LoadingSpinnerComponent,
} from '@alittlemore.dev/design-system';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AccountSettingsService } from '../../../../core/auth/account-settings.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ApiError } from '../../../../core/models/api-error.model';
import { VaultEntry, VaultStatistics } from '../../models/vault.model';
import { VaultService } from '../../services/vault.service';

export type VaultSectionKey = 'vault-recent' | 'vault-statistics';

@Component({
  selector: 'app-vault-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    TranslatePipe,
    EmptyStateComponent,
    ErrorMessageComponent,
    FoldableSectionComponent,
    LoadingSpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vault-dashboard.component.html',
  styleUrl: './vault-dashboard.component.scss',
})
export class VaultDashboardComponent {
  private readonly service = inject(VaultService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly i18n = inject(I18nService);
  private readonly preferences = inject(AccountSettingsService);
  private recentVersion = -1;
  private statisticsVersion = -1;
  private recentGeneration = 0;
  private statisticsGeneration = 0;

  readonly recentExpanded = input.required<boolean>();
  readonly statisticsExpanded = input.required<boolean>();
  readonly refreshVersion = input.required<number>();
  readonly expandedChange = output<{ key: VaultSectionKey; expanded: boolean }>();
  readonly items = signal<readonly VaultEntry[]>([]);
  readonly statistics = signal<VaultStatistics | null>(null);
  readonly knowledgeKinds = computed(
    () => this.statistics()?.byKind.filter((item) => item.source !== 'resume') ?? [],
  );
  readonly recentLoading = signal(false);
  readonly statisticsLoading = signal(false);
  readonly recentError = signal<ApiError | null>(null);
  readonly statisticsError = signal<ApiError | null>(null);

  constructor() {
    effect(() => {
      const version = this.refreshVersion();
      if (this.recentExpanded() && version !== this.recentVersion)
        untracked(() => this.loadRecent());
    });
    effect(() => {
      const version = this.refreshVersion();
      if (this.statisticsExpanded() && version !== this.statisticsVersion)
        untracked(() => this.loadStatistics());
    });
  }

  loadRecent(): void {
    this.recentVersion = this.refreshVersion();
    const generation = ++this.recentGeneration;
    this.recentLoading.set(true);
    this.recentError.set(null);
    this.service
      .recent()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (value) => {
          if (generation !== this.recentGeneration) return;
          this.items.set(value.items.slice(0, 8));
          this.recentLoading.set(false);
        },
        error: (error: ApiError) => {
          if (generation !== this.recentGeneration) return;
          this.recentError.set(error);
          this.recentLoading.set(false);
        },
      });
  }

  loadStatistics(): void {
    this.statisticsVersion = this.refreshVersion();
    const generation = ++this.statisticsGeneration;
    this.statisticsLoading.set(true);
    this.statisticsError.set(null);
    this.service
      .statistics()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (value) => {
          if (generation !== this.statisticsGeneration) return;
          this.statistics.set(value);
          this.statisticsLoading.set(false);
        },
        error: (error: ApiError) => {
          if (generation !== this.statisticsGeneration) return;
          this.statisticsError.set(error);
          this.statisticsLoading.set(false);
        },
      });
  }

  entryRoute(entry: VaultEntry): readonly string[] {
    if (entry.source === 'resume') return ['/personal-workspace/resumes', entry.id];
    const category = entry.kind === 'person' ? 'people' : `${entry.kind}s`;
    return [`/personal-workspace/knowledge/${category}`, entry.id];
  }

  kindLabel(kind: string): string {
    const key = `workspaceDashboard.vault.kind.${kind}`;
    const translated = this.i18n.translate(key);
    return translated === key ? kind : translated;
  }

  updatedLabel(entry: VaultEntry): string {
    return new Intl.DateTimeFormat(this.i18n.dateLocale(), {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: this.preferences.timeZone(),
    }).format(new Date(entry.updatedAt));
  }
}
