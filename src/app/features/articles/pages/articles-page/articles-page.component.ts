import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest } from 'rxjs';
import { LanguageCode } from '../../../../core/i18n/i18n.model';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ApiError } from '../../../../core/models/api-error.model';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { AnonymousReactionService } from '../../../../core/privacy/anonymous-reaction.service';
import { SeoAlternate, SeoService } from '../../../../core/seo/seo.service';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorMessageComponent } from '../../../../shared/ui/error-message/error-message.component';
import {
  LocalizedDatePickerComponent,
  LocalizedDatePickerLabels,
} from '../../../../shared/ui/localized-date-picker/localized-date-picker.component';
import { LoadingSpinnerComponent } from '../../../../shared/ui/loading-spinner/loading-spinner.component';
import {
  ArticleDetail,
  ArticleList,
  ArticleReactionKind,
  ArticleTag,
  ArticleTree,
} from '../../models/articles.model';
import { ArticlesService } from '../../services/articles.service';
import { ArticleDetailComponent } from './components/article-detail/article-detail.component';
import { ArticleListComponent } from './components/article-list/article-list.component';
import { ArticlesSidePanelComponent } from './components/articles-side-panel/articles-side-panel.component';

const PAGE_SIZE = 10;
const SIDE_PANEL_STORAGE_KEY = 'articlesSidePanelOpen';
const ENGAGED_VIEW_DELAY_MS = 30_000;
const ENGAGED_VIEW_TICK_MS = 1_000;

interface EngagedViewState {
  slug: string;
  visibleMs: number;
}

@Component({
  selector: 'app-articles-page',
  standalone: true,
  imports: [
    EmptyStateComponent,
    ErrorMessageComponent,
    LoadingSpinnerComponent,
    TranslatePipe,
    ArticleDetailComponent,
    LocalizedDatePickerComponent,
    ArticleListComponent,
    ArticlesSidePanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './articles-page.component.html',
  styleUrl: './articles-page.component.scss',
})
export class ArticlesPageComponent implements OnInit {
  private readonly articlesService = inject(ArticlesService);
  private readonly i18n = inject(I18nService);
  private readonly seoService = inject(SeoService);
  private readonly notifications = inject(NotificationService);
  private readonly anonymousReactionService = inject(AnonymousReactionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private engagedViewTimerId: ReturnType<typeof setInterval> | null = null;
  private engagedViewState: EngagedViewState | null = null;
  private readonly trackedEngagedViewSlugs = new Set<string>();
  private languageReloadInitialized = false;

  readonly sidePanelOpen = signal(this.readSidePanelPreference());
  readonly currentSlug = signal<string | null>(null);
  readonly activeTagSlug = signal<string | null>(null);
  readonly searchQuery = signal('');
  readonly publishedFrom = signal('');
  readonly publishedTo = signal('');
  readonly filterApplyAttempted = signal(false);
  readonly publishedFromValid = signal(true);
  readonly publishedToValid = signal(true);
  readonly page = signal(1);

  readonly articles = signal<ArticleList | null>(null);
  readonly tree = signal<ArticleTree>({ folders: [] });
  readonly tags = signal<ArticleTag[]>([]);
  readonly selectedArticle = signal<ArticleDetail | null>(null);
  readonly selectedReaction = signal<ArticleReactionKind | null>(null);
  readonly reactionLoading = signal(false);

  readonly listLoading = signal(false);
  readonly listError = signal<ApiError | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal<ApiError | null>(null);

  readonly sortedTags = computed(() => [...this.tags()].sort(compareTags));
  readonly activeTag = computed(() => {
    const slug = this.activeTagSlug();
    return slug ? (this.sortedTags().find((tag) => tag.slug === slug) ?? null) : null;
  });
  readonly isDetailRoute = computed(() => this.currentSlug() !== null);
  readonly isEmpty = computed(
    () => !this.listLoading() && !this.listError() && (this.articles()?.articles.length ?? 0) === 0,
  );
  readonly hasListFilters = computed(
    () =>
      this.activeTagSlug() !== null ||
      this.searchQuery().trim() !== '' ||
      this.publishedFrom() !== '' ||
      this.publishedTo() !== '',
  );
  readonly sidePanelToggleLabel = computed(() => {
    this.language();
    return this.i18n.translate(
      this.sidePanelOpen() ? 'articles.sidePanel.close' : 'articles.sidePanel.open',
    );
  });
  readonly dateLocale = computed(() => this.i18n.dateLocale());
  readonly datePickerLabels = computed<LocalizedDatePickerLabels>(() => {
    this.language();
    return {
      placeholder: this.i18n.translate('shared.datePicker.placeholder'),
      openCalendar: this.i18n.translate('shared.datePicker.open'),
      changeCalendar: this.i18n.translate('shared.datePicker.change'),
      dialog: this.i18n.translate('shared.datePicker.dialog'),
      previousMonth: this.i18n.translate('shared.datePicker.previousMonth'),
      nextMonth: this.i18n.translate('shared.datePicker.nextMonth'),
      openMonthYearPicker: this.i18n.translate('shared.datePicker.openMonthYearPicker'),
      previousYear: this.i18n.translate('shared.datePicker.previousYear'),
      nextYear: this.i18n.translate('shared.datePicker.nextYear'),
      clear: this.i18n.translate('shared.datePicker.clear'),
      close: this.i18n.translate('shared.datePicker.close'),
      formatHint: this.i18n.translate('shared.datePicker.formatHint'),
      invalidDate: this.i18n.translate('shared.datePicker.invalidDate'),
      requiredDate: this.i18n.translate('shared.datePicker.requiredDate'),
      keyboardHelp: this.i18n.translate('shared.datePicker.keyboardHelp'),
    };
  });
  readonly language = computed(() => {
    const language = this.i18n.language();
    if (language === null) {
      throw new Error('I18n language is not initialized');
    }
    return language;
  });

  private readonly languageReloadEffect = effect(() => {
    const language = this.i18n.language();
    if (language === null) return;
    if (!this.languageReloadInitialized) {
      this.languageReloadInitialized = true;
      return;
    }
    untracked(() => this.reloadLocalizedContent());
  });

  ngOnInit(): void {
    this.setArticlesListSeo();
    this.loadTags();
    this.loadTree();
    this.destroyRef.onDestroy(() => this.clearEngagedViewTimer());
    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([params, query]) => {
        const slug = params.get('slug');
        this.currentSlug.set(slug);
        this.activeTagSlug.set(query.get('tag'));
        this.searchQuery.set(query.get('searchQuery') ?? '');
        this.publishedFrom.set(query.get('publishedFrom') ?? '');
        this.publishedTo.set(query.get('publishedTo') ?? '');
        this.page.set(readPage(query.get('page')));
        if (slug) {
          this.loadDetail(slug);
        } else {
          this.setArticlesListSeo();
          this.clearEngagedViewTimer();
          this.selectedArticle.set(null);
          this.selectedReaction.set(null);
          this.loadArticles();
        }
      });
  }

  toggleSidePanel(): void {
    this.sidePanelOpen.update((value) => {
      const next = !value;
      this.storage()?.setItem(SIDE_PANEL_STORAGE_KEY, String(next));
      return next;
    });
  }

  closeSidePanel(): void {
    this.sidePanelOpen.set(false);
    this.storage()?.setItem(SIDE_PANEL_STORAGE_KEY, 'false');
  }

  openArticle(slug: string): void {
    this.router.navigate(this.localizedArticleCommands(slug), {
      queryParams: this.buildListQueryParams({ page: this.page() }),
    });
  }

  backToList(): void {
    this.router.navigate(this.localizedListCommands(), {
      queryParams: this.buildListQueryParams({ page: this.page() }),
    });
  }

  selectTag(slug: string): void {
    this.router.navigate(this.localizedListCommands(), {
      queryParams: this.buildListQueryParams({ page: 1, tagSlug: slug }),
    });
  }

  clearTag(): void {
    this.router.navigate(this.localizedListCommands(), {
      queryParams: this.buildListQueryParams({ page: 1, tagSlug: null }),
    });
  }

  changePage(page: number): void {
    this.router.navigate(this.localizedListCommands(), {
      queryParams: this.buildListQueryParams({ page }),
    });
  }

  setSearchQuery(value: string): void {
    this.searchQuery.set(value);
  }

  setPublishedFrom(value: string): void {
    this.publishedFrom.set(value);
  }

  setPublishedTo(value: string): void {
    this.publishedTo.set(value);
  }

  setPublishedFromValidity(valid: boolean): void {
    this.publishedFromValid.set(valid);
  }

  setPublishedToValidity(valid: boolean): void {
    this.publishedToValid.set(valid);
  }

  onSearchInput(event: Event): void {
    this.setSearchQuery(readInputValue(event));
  }

  applyFilters(): void {
    this.filterApplyAttempted.set(true);
    if (!this.publishedFromValid() || !this.publishedToValid()) return;
    this.router.navigate(this.localizedListCommands(), {
      queryParams: this.buildListQueryParams({ page: 1 }),
    });
  }

  clearListFilters(): void {
    this.filterApplyAttempted.set(false);
    this.publishedFromValid.set(true);
    this.publishedToValid.set(true);
    this.searchQuery.set('');
    this.setPublishedFrom('');
    this.setPublishedTo('');
    this.router.navigate(this.localizedListCommands(), { queryParams: { page: 1 } });
  }

  selectReaction(kind: ArticleReactionKind): void {
    if (!this.isBrowser) return;
    const article = this.selectedArticle();
    if (!article || article.publishStatus !== 'Published') return;
    const previousReaction = this.selectedReaction();
    const nextReaction = previousReaction === kind ? null : kind;
    const clientToken = this.anonymousReactionService.getOrCreateClientToken();
    if (clientToken === null) return;
    this.reactionLoading.set(true);
    this.articlesService
      .setPublicReaction(
        article.slug,
        {
          reactionKind: nextReaction,
          clientToken,
        },
        this.currentLanguage(),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.selectedReaction.set(nextReaction);
          this.anonymousReactionService.setReaction(article.slug, nextReaction);
          this.selectedArticle.set(
            applyReactionChange({
              article,
              previousReaction,
              nextReaction,
            }),
          );
          this.reactionLoading.set(false);
        },
        error: () => {
          this.reactionLoading.set(false);
          this.notifications.error(this.i18n.translate('articles.notify.reactionError'));
        },
      });
  }

  loadArticles(): void {
    this.listLoading.set(true);
    this.listError.set(null);
    const params = {
      page: this.page(),
      pageSize: PAGE_SIZE,
      language: this.currentLanguage(),
      tagSlug: this.activeTagSlug(),
      publishedFrom: this.publishedFrom() || null,
      publishedTo: this.publishedTo() || null,
      searchQuery: this.normalizedSearchQuery(),
    };
    this.articlesService
      .getPublicArticles(params)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (articles) => {
          this.articles.set(articles);
          this.listLoading.set(false);
        },
        error: (err: ApiError) => {
          this.listError.set(err);
          this.listLoading.set(false);
        },
      });
  }

  loadDetail(slug: string): void {
    this.clearEngagedViewTimer();
    this.detailLoading.set(true);
    this.detailError.set(null);
    this.articlesService
      .getPublicArticle(slug, this.currentLanguage())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (article) => {
          this.selectedArticle.set(article);
          this.setArticleDetailSeo(article);
          this.selectedReaction.set(this.readSelectedReaction(article.slug));
          this.trackPublicView(article);
          this.scheduleEngagedView(article);
          this.detailLoading.set(false);
        },
        error: (err: ApiError) => {
          this.detailError.set(err);
          this.detailLoading.set(false);
        },
      });
  }

  loadTags(): void {
    this.articlesService
      .getPublicTags(this.currentLanguage())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tags) => this.tags.set(tags),
        error: () => this.tags.set([]),
      });
  }

  loadTree(): void {
    this.articlesService
      .getPublicTree(this.currentLanguage())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tree) => this.tree.set(tree),
        error: () => this.tree.set({ folders: [] }),
      });
  }

  private scheduleEngagedView(article: ArticleDetail): void {
    if (!this.isBrowser) return;
    if (article.publishStatus !== 'Published') return;
    if (this.trackedEngagedViewSlugs.has(article.slug)) return;
    this.engagedViewState = {
      slug: article.slug,
      visibleMs: 0,
    };
    this.engagedViewTimerId = setInterval(
      () => this.trackEngagedViewProgress(),
      ENGAGED_VIEW_TICK_MS,
    );
  }

  private trackEngagedViewProgress(): void {
    const state = this.engagedViewState;
    if (state === null || this.document.visibilityState !== 'visible') return;
    state.visibleMs += ENGAGED_VIEW_TICK_MS;
    if (state.visibleMs < ENGAGED_VIEW_DELAY_MS) return;
    this.trackScheduledEngagedView();
  }

  private trackScheduledEngagedView(): void {
    const state = this.engagedViewState;
    if (state === null) return;
    if (this.engagedViewTimerId !== null) {
      clearInterval(this.engagedViewTimerId);
    }
    this.engagedViewTimerId = null;
    this.engagedViewState = null;
    this.articlesService
      .trackPublicEngagedView(state.slug, this.currentLanguage())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.trackedEngagedViewSlugs.add(state.slug),
        error: () => undefined,
      });
  }

  private trackPublicView(article: ArticleDetail): void {
    if (!this.isBrowser) return;
    if (article.publishStatus !== 'Published') return;
    this.articlesService
      .trackPublicView(article.slug, this.currentLanguage())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => undefined });
  }

  private clearEngagedViewTimer(): void {
    if (this.engagedViewTimerId !== null) {
      clearInterval(this.engagedViewTimerId);
    }
    this.engagedViewTimerId = null;
    this.engagedViewState = null;
  }

  private buildListQueryParams(params: {
    page: number;
    tagSlug?: string | null;
  }): Record<string, string | number> {
    const queryParams: Record<string, string | number> = { page: params.page };
    const tagSlug = params.tagSlug === undefined ? this.activeTagSlug() : params.tagSlug;
    const searchQuery = this.normalizedSearchQuery();
    if (tagSlug) {
      queryParams['tag'] = tagSlug;
    }
    if (searchQuery) {
      queryParams['searchQuery'] = searchQuery;
    }
    if (this.publishedFrom()) {
      queryParams['publishedFrom'] = this.publishedFrom();
    }
    if (this.publishedTo()) {
      queryParams['publishedTo'] = this.publishedTo();
    }
    return queryParams;
  }

  private normalizedSearchQuery(): string | null {
    const value = this.searchQuery().trim();
    return value === '' ? null : value;
  }

  private reloadLocalizedContent(): void {
    this.loadTags();
    this.loadTree();
    const slug = this.currentSlug();
    if (slug) {
      this.loadDetail(slug);
    } else {
      this.loadArticles();
    }
  }

  private currentLanguage(): LanguageCode {
    return this.language();
  }

  private setArticlesListSeo(): void {
    const path = '/articles';
    this.seoService.setTranslatedMeta({
      titleKey: 'articles.seo.title',
      descriptionKey: 'articles.seo.description',
      canonicalPath: this.localizedPublicPath(path),
      alternates: this.localizedAlternates(path),
    });
  }

  private setArticleDetailSeo(article: ArticleDetail): void {
    const language = this.currentLanguage();
    const path = `/articles/${article.slug}`;
    const metadata = article.metadata;
    const seoTitle = localizedMetadataValue(
      language,
      metadata.seoTitleRu,
      metadata.seoTitleEn,
      article.title,
    );
    const seoDescription = localizedMetadataValue(
      language,
      metadata.seoDescriptionRu,
      metadata.seoDescriptionEn,
      article.excerpt,
    );
    const coverImageUrl = normalizeOptionalString(metadata.coverImageUrl);
    this.seoService.setMeta({
      title: seoTitle,
      description: seoDescription,
      canonicalPath: this.localizedPublicPath(path),
      ogImage: coverImageUrl ?? undefined,
      ogType: 'article',
      alternates: this.localizedAlternates(path),
      structuredData: buildArticleStructuredData({
        article,
        language,
        headline: seoTitle,
        description: seoDescription,
        image: coverImageUrl,
      }),
    });
  }

  private readSelectedReaction(slug: string): ArticleReactionKind | null {
    if (!this.isBrowser) return null;
    return toArticleReactionKind(this.anonymousReactionService.getReaction(slug));
  }

  private localizedPublicPath(path: string): string {
    return `/${this.currentLanguage()}${path}`;
  }

  private localizedAlternates(path: string): SeoAlternate[] {
    return [
      { language: 'ru', path: `/ru${path}` },
      { language: 'en', path: `/en${path}` },
    ];
  }

  private localizedListCommands(): string[] {
    return ['/', this.currentLanguage(), 'articles'];
  }

  private localizedArticleCommands(slug: string): string[] {
    return ['/', this.currentLanguage(), 'articles', slug];
  }

  private readSidePanelPreference(): boolean {
    return this.storage()?.getItem(SIDE_PANEL_STORAGE_KEY) === 'true';
  }

  private storage(): Storage | null {
    return this.document.defaultView?.localStorage ?? null;
  }
}

function readPage(value: string | null): number {
  const page = Number(value ?? '1');
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function readInputValue(event: Event): string {
  return (event.target as HTMLInputElement).value;
}

function compareTags(a: ArticleTag, b: ArticleTag): number {
  return a.name.localeCompare(b.name, 'ru');
}

function toArticleReactionKind(value: string | null): ArticleReactionKind | null {
  if (
    value === 'heart' ||
    value === 'fire' ||
    value === 'thinking' ||
    value === 'neutral' ||
    value === 'poop'
  ) {
    return value;
  }
  return null;
}

function localizedMetadataValue(
  language: LanguageCode,
  ru: string | null,
  en: string | null,
  fallback: string,
): string {
  return normalizeOptionalString(language === 'ru' ? ru : en) ?? fallback;
}

function normalizeOptionalString(value: string | null): string | null {
  const normalized = value?.trim() ?? '';
  return normalized === '' ? null : normalized;
}

function buildArticleStructuredData(params: {
  article: ArticleDetail;
  language: LanguageCode;
  headline: string;
  description: string;
  image: string | null;
}): Record<string, unknown> {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: params.headline,
    description: params.description,
    author: {
      '@type': 'Person',
      name: params.article.authorUsername,
    },
    datePublished: params.article.publishedAt ?? params.article.createdAt,
    dateModified: params.article.updatedAt,
    inLanguage: params.language,
  };
  if (params.image) {
    data['image'] = [params.image];
  }
  return data;
}

function applyReactionChange(params: {
  article: ArticleDetail;
  previousReaction: ArticleReactionKind | null;
  nextReaction: ArticleReactionKind | null;
}): ArticleDetail {
  const reactionCounts = { ...params.article.reactionCounts };
  if (params.previousReaction !== null) {
    reactionCounts[params.previousReaction] = Math.max(
      0,
      reactionCounts[params.previousReaction] - 1,
    );
  }
  if (params.nextReaction !== null) {
    reactionCounts[params.nextReaction] += 1;
  }
  return { ...params.article, reactionCounts };
}
