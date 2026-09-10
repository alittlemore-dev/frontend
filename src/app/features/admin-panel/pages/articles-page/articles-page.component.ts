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
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { ApiError } from '../../../../core/models/api-error.model';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ModalScrollDirective } from '../../../../core/layout/modal-scroll.directive';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorMessageComponent } from '../../../../shared/ui/error-message/error-message.component';
import {
  LocalizedDatePickerComponent,
  LocalizedDatePickerLabels,
} from '../../../../shared/ui/localized-date-picker/localized-date-picker.component';
import { LoadingSpinnerComponent } from '../../../../shared/ui/loading-spinner/loading-spinner.component';
import {
  AdminArticleList,
  AdminArticlePayload,
  AdminArticlePublishStatus,
  AdminArticleTag,
  AdminArticleTree,
} from '../../models/article-workspace.model';
import { ArticleWorkspaceService } from '../../services/article-workspace.service';
import { AdminUnsavedChangesService } from '../../services/admin-unsaved-changes.service';
import {
  AdminAction,
  AdminActionsDropdownComponent,
} from '../../components/admin-actions-dropdown/admin-actions-dropdown.component';
import { ArticleFormComponent } from './components/article-form/article-form.component';
import {
  canonicalQueryMatches,
  queryNumber,
  queryString,
  readIsoDateQuery,
  readOptionalStringQuery,
  readPositiveIntegerQuery,
  replaceAdminQueryParams,
} from '../../utils/admin-query-state';
import {
  SiteSelectComponent,
  SiteSelectOption,
} from '../../../../shared/ui/site-select/site-select.component';

const PAGE_SIZE = 20;
const ARTICLE_PUBLISH_STATUSES = ['Draft', 'Published'] as const;
const ARTICLE_QUERY_KEYS = [
  'q',
  'tag',
  'publishedFrom',
  'publishedTo',
  'publishStatus',
  'page',
] as const;

interface ArticleQueryState {
  searchQuery: string | null;
  tagSlug: string | null;
  publishedFrom: string | null;
  publishedTo: string | null;
  publishStatus: AdminArticlePublishStatus | null;
  page: number;
}

@Component({
  selector: 'app-admin-articles-page',
  standalone: true,
  imports: [
    RouterLink,
    TranslatePipe,
    LoadingSpinnerComponent,
    ErrorMessageComponent,
    EmptyStateComponent,
    LocalizedDatePickerComponent,
    AdminActionsDropdownComponent,
    ArticleFormComponent,
    ModalScrollDirective,
    SiteSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './articles-page.component.html',
})
export class AdminArticlesPageComponent implements OnInit {
  private readonly articleWorkspace = inject(ArticleWorkspaceService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly unsavedChanges = inject(AdminUnsavedChangesService);
  private appliedState: ArticleQueryState = emptyArticleQueryState();
  private currentQueryParams: ParamMap | null = null;
  private skipNextCanonicalLoad: Record<string, string | null> | null = null;

  readonly unsavedChangesScope = this.unsavedChanges.createScope(this.destroyRef);

  readonly page = signal(1);
  readonly searchQuery = signal('');
  readonly tagSlug = signal<string | null>(null);
  readonly publishedFrom = signal('');
  readonly publishedTo = signal('');
  readonly publishStatus = signal<AdminArticlePublishStatus | null>(null);
  readonly articles = signal<AdminArticleList | null>(null);
  readonly tags = signal<AdminArticleTag[]>([]);
  readonly tree = signal<AdminArticleTree>({ folders: [] });
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly formVisible = signal(false);
  readonly formError = signal<ApiError | null>(null);
  readonly filterApplyAttempted = signal(false);
  readonly publishedFromValid = signal(true);
  readonly publishedToValid = signal(true);
  readonly tagSelectOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    return [
      { value: '', label: this.i18n.translate('shared.notSet') },
      ...this.tags().map((tag) => ({ value: tag.slug, label: tag.name })),
    ];
  });
  readonly publishStatusSelectOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    return [
      { value: '', label: this.i18n.translate('shared.notSet') },
      ...ARTICLE_PUBLISH_STATUSES.map((status) => ({
        value: status,
        label: this.i18n.translate(`enum.publishStatus.${status}`),
      })),
    ];
  });
  readonly dateLocale = computed(() => this.i18n.dateLocale());
  readonly datePickerLabels = computed<LocalizedDatePickerLabels>(() => ({
    placeholder: this.datePickerTranslation('placeholder'),
    openCalendar: this.datePickerTranslation('open'),
    changeCalendar: this.datePickerTranslation('change'),
    dialog: this.datePickerTranslation('dialog'),
    previousMonth: this.datePickerTranslation('previousMonth'),
    nextMonth: this.datePickerTranslation('nextMonth'),
    openMonthYearPicker: this.datePickerTranslation('openMonthYearPicker'),
    previousYear: this.datePickerTranslation('previousYear'),
    nextYear: this.datePickerTranslation('nextYear'),
    clear: this.datePickerTranslation('clear'),
    close: this.datePickerTranslation('close'),
    formatHint: this.datePickerTranslation('formatHint'),
    invalidDate: this.datePickerTranslation('invalidDate'),
    requiredDate: this.datePickerTranslation('requiredDate'),
    keyboardHelp: this.datePickerTranslation('keyboardHelp'),
  }));

  ngOnInit(): void {
    this.loadTree();
    this.initializeTagsAndQueryState();
  }

  loadWorkspace(): void {
    this.loading.set(true);
    this.error.set(null);
    this.articleWorkspace
      .listArticles({
        page: this.appliedState.page,
        pageSize: PAGE_SIZE,
        language: this.currentLanguage(),
        publishStatus: this.appliedState.publishStatus,
        tagSlug: this.appliedState.tagSlug,
        publishedFrom: this.appliedState.publishedFrom,
        publishedTo: this.appliedState.publishedTo,
        searchQuery: this.appliedState.searchQuery,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (articles) => {
          const lastPage = Math.max(1, articles.totalPages);
          if (this.appliedState.page > lastPage) {
            this.replaceQueryStateAndLoad({ ...this.appliedState, page: lastPage });
            return;
          }
          this.articles.set(articles);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err);
          this.loading.set(false);
          this.notifications.error(this.i18n.translate('adminArticlesWorkspace.loadError'));
        },
      });
  }

  applyFilters(): void {
    this.filterApplyAttempted.set(true);
    if (!this.publishedFromValid() || !this.publishedToValid()) return;
    this.commitQueryState({
      searchQuery: this.normalizedSearchQuery(),
      tagSlug: this.tagSlug(),
      publishedFrom: queryString(this.publishedFrom()),
      publishedTo: queryString(this.publishedTo()),
      publishStatus: this.publishStatus(),
      page: 1,
    });
  }

  resetFilters(): void {
    this.filterApplyAttempted.set(false);
    this.publishedFromValid.set(true);
    this.publishedToValid.set(true);
    this.searchQuery.set('');
    this.tagSlug.set(null);
    this.publishedFrom.set('');
    this.publishedTo.set('');
    this.publishStatus.set(null);
    this.commitQueryState(emptyArticleQueryState());
  }

  previousPage(): void {
    if (this.page() <= 1) return;
    this.commitQueryState({ ...this.appliedState, page: this.page() - 1 });
  }

  nextPage(): void {
    if (this.page() >= (this.articles()?.totalPages ?? 1)) return;
    this.commitQueryState({ ...this.appliedState, page: this.page() + 1 });
  }

  openCreate(): void {
    this.formError.set(null);
    this.formVisible.set(true);
  }

  closeForm(): void {
    if (!this.unsavedChangesScope.confirmDiscard()) return;
    this.formVisible.set(false);
    this.formError.set(null);
  }

  saveArticle(payload: AdminArticlePayload): void {
    this.articleWorkspace
      .createArticle(payload, this.currentLanguage())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.unsavedChangesScope.commit();
          this.notifications.success(this.i18n.translate('articles.notify.saved'));
          this.closeForm();
          this.loadWorkspace();
          this.loadTags();
          this.loadTree();
        },
        error: (err: ApiError) => {
          this.formError.set(err);
          this.notifications.error(this.i18n.translate('articles.notify.saveError'));
        },
      });
  }

  publishArticle(slug: string): void {
    this.articleWorkspace
      .publishArticle(slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notifications.success(this.i18n.translate('articles.notify.published'));
          this.loadWorkspace();
          this.loadTree();
        },
        error: () => this.notifications.error(this.i18n.translate('articles.notify.publishError')),
      });
  }

  articleActions(article: AdminArticleList['articles'][number]): AdminAction[] {
    const publicationAction =
      article.publishStatus === 'Published'
        ? {
            id: 'unpublish',
            label: this.i18n.translate('shared.unpublish'),
            destructive: false,
            disabled: false,
          }
        : {
            id: 'publish',
            label: this.i18n.translate('shared.publish'),
            destructive: false,
            disabled: false,
          };
    return [
      {
        id: 'edit',
        label: this.i18n.translate('shared.edit'),
        destructive: false,
        disabled: false,
      },
      publicationAction,
      {
        id: 'delete',
        label: this.i18n.translate('shared.delete'),
        destructive: true,
        disabled: false,
      },
    ];
  }

  handleArticleAction(actionId: string, article: AdminArticleList['articles'][number]): void {
    switch (actionId) {
      case 'edit':
        void this.router.navigate(['/admin-panel/articles', article.slug], {
          queryParamsHandling: 'preserve',
        });
        return;
      case 'publish':
        this.publishArticle(article.slug);
        return;
      case 'unpublish':
        this.unpublishArticle(article.slug);
        return;
      case 'delete':
        this.deleteArticle(article.slug);
        return;
      default:
        throw new Error(`Unsupported article action: ${actionId}`);
    }
  }

  unpublishArticle(slug: string): void {
    this.articleWorkspace
      .unpublishArticle(slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notifications.success(this.i18n.translate('articles.notify.unpublished'));
          this.loadWorkspace();
          this.loadTree();
        },
        error: () =>
          this.notifications.error(this.i18n.translate('articles.notify.unpublishError')),
      });
  }

  deleteArticle(slug: string): void {
    if (
      this.document.defaultView?.confirm(
        this.i18n.translate('adminArticlesWorkspace.confirmDelete'),
      ) !== true
    ) {
      return;
    }
    this.articleWorkspace
      .deleteArticle(slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notifications.success(this.i18n.translate('articles.notify.deleted'));
          this.loadWorkspace();
          this.loadTree();
        },
        error: () => this.notifications.error(this.i18n.translate('articles.notify.deleteError')),
      });
  }

  setSearchQuery(value: string): void {
    this.searchQuery.set(value);
  }

  setTagSlug(value: string): void {
    this.tagSlug.set(value === '' ? null : value);
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

  setPublishStatus(value: string): void {
    this.publishStatus.set(
      ARTICLE_PUBLISH_STATUSES.includes(value as AdminArticlePublishStatus)
        ? (value as AdminArticlePublishStatus)
        : null,
    );
  }

  private datePickerTranslation(key: string): string {
    this.i18n.language();
    return this.i18n.translate(`shared.datePicker.${key}`);
  }

  loadTags(): void {
    this.articleWorkspace
      .getTags(this.currentLanguage())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tags) => this.tags.set(tags),
        error: () => this.tags.set([]),
      });
  }

  private initializeTagsAndQueryState(): void {
    this.articleWorkspace
      .getTags(this.currentLanguage())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tags) => {
          this.tags.set(tags);
          this.setupQueryState(true);
        },
        error: () => {
          this.tags.set([]);
          this.setupQueryState(false);
        },
      });
  }

  private setupQueryState(validateTag: boolean): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.currentQueryParams = params;
      const state = this.articleStateFromQuery(params, validateTag);
      const canonical = this.serializeQueryState(state);
      if (
        this.skipNextCanonicalLoad !== null &&
        canonicalQueryMatches(params, ARTICLE_QUERY_KEYS, this.skipNextCanonicalLoad)
      ) {
        this.skipNextCanonicalLoad = null;
        return;
      }
      this.applyQueryState(state);
      if (!canonicalQueryMatches(params, ARTICLE_QUERY_KEYS, canonical)) {
        this.replaceQueryStateAndLoad(state);
        return;
      }
      this.loadWorkspace();
    });
  }

  private articleStateFromQuery(params: ParamMap, validateTag: boolean): ArticleQueryState {
    const searchQuery = readOptionalStringQuery(params, 'q').value;
    const requestedTag = readOptionalStringQuery(params, 'tag').value;
    const tagSlug =
      requestedTag !== null && validateTag && !this.tags().some((tag) => tag.slug === requestedTag)
        ? null
        : requestedTag;
    return {
      searchQuery,
      tagSlug,
      publishedFrom: readIsoDateQuery(params, 'publishedFrom').value,
      publishedTo: readIsoDateQuery(params, 'publishedTo').value,
      publishStatus: this.readPublishStatus(params),
      page: readPositiveIntegerQuery(params, 'page', 1).value,
    };
  }

  private applyQueryState(state: ArticleQueryState): void {
    this.appliedState = state;
    this.page.set(state.page);
    this.searchQuery.set(state.searchQuery ?? '');
    this.tagSlug.set(state.tagSlug);
    this.publishedFrom.set(state.publishedFrom ?? '');
    this.publishedTo.set(state.publishedTo ?? '');
    this.publishStatus.set(state.publishStatus);
  }

  private commitQueryState(state: ArticleQueryState): void {
    const canonical = this.serializeQueryState(state);
    if (
      this.currentQueryParams !== null &&
      canonicalQueryMatches(this.currentQueryParams, ARTICLE_QUERY_KEYS, canonical)
    ) {
      this.loadWorkspace();
      return;
    }
    this.replaceQueryStateAndLoad(state);
  }

  private replaceQueryStateAndLoad(state: ArticleQueryState): void {
    const canonical = this.serializeQueryState(state);
    this.applyQueryState(state);
    this.skipNextCanonicalLoad = canonical;
    void replaceAdminQueryParams(this.router, this.route, canonical);
    this.loadWorkspace();
  }

  private serializeQueryState(state: ArticleQueryState): Record<string, string | null> {
    return {
      q: state.searchQuery,
      tag: state.tagSlug,
      publishedFrom: state.publishedFrom,
      publishedTo: state.publishedTo,
      publishStatus: state.publishStatus,
      page: queryNumber(state.page, 1),
    };
  }

  private loadTree(): void {
    this.articleWorkspace
      .getTree(this.currentLanguage())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tree) => this.tree.set(tree),
        error: () => this.tree.set({ folders: [] }),
      });
  }

  private normalizedSearchQuery(): string | null {
    const value = this.searchQuery().trim();
    return value === '' ? null : value;
  }

  private readPublishStatus(params: ParamMap): AdminArticlePublishStatus | null {
    const value = readOptionalStringQuery(params, 'publishStatus').value;
    return value !== null && ARTICLE_PUBLISH_STATUSES.includes(value as AdminArticlePublishStatus)
      ? (value as AdminArticlePublishStatus)
      : null;
  }

  private currentLanguage(): 'ru' | 'en' {
    const language = this.i18n.language();
    if (language === null) {
      throw new Error('I18n language is not initialized');
    }
    return language;
  }
}

function emptyArticleQueryState(): ArticleQueryState {
  return {
    searchQuery: null,
    tagSlug: null,
    publishedFrom: null,
    publishedTo: null,
    publishStatus: null,
    page: 1,
  };
}
