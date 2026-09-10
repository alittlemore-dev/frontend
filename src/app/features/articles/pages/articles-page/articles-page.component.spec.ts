import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  ActivatedRoute,
  ParamMap,
  Router,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { AnonymousReactionService } from '../../../../core/privacy/anonymous-reaction.service';
import { SeoService } from '../../../../core/seo/seo.service';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { ArticleDetail, ArticleList, ArticleTree } from '../../models/articles.model';
import { ArticlesService } from '../../services/articles.service';
import { ArticlesPageComponent } from './articles-page.component';

describe('ArticlesPageComponent', () => {
  let fixture: ComponentFixture<ArticlesPageComponent>;
  let paramMap: BehaviorSubject<ParamMap>;
  let queryParamMap: BehaviorSubject<ParamMap>;
  let articlesService: {
    getPublicTags: jest.Mock;
    getAdminTags: jest.Mock;
    getPublicTree: jest.Mock;
    getAdminTree: jest.Mock;
    getPublicArticle: jest.Mock;
    getAdminArticle: jest.Mock;
    getPublicArticles: jest.Mock;
    getAdminArticles: jest.Mock;
    trackPublicView: jest.Mock;
    trackPublicEngagedView: jest.Mock;
    setPublicReaction: jest.Mock;
    getAdminStats: jest.Mock;
  };
  let anonymousReactionService: {
    getOrCreateClientToken: jest.Mock;
    getReaction: jest.Mock;
    setReaction: jest.Mock;
  };
  let seoService: {
    setTranslatedMeta: jest.Mock;
    setMeta: jest.Mock;
  };
  let router: { navigate: jest.Mock };
  let canManageContent: boolean;

  beforeEach(async () => {
    canManageContent = false;
    paramMap = new BehaviorSubject(convertToParamMap({ slug: 'typed-articles' }));
    queryParamMap = new BehaviorSubject(convertToParamMap({}));
    articlesService = {
      getPublicTags: jest.fn().mockReturnValue(of([])),
      getAdminTags: jest.fn().mockReturnValue(of([])),
      getPublicTree: jest.fn().mockReturnValue(of({ folders: [] } satisfies ArticleTree)),
      getAdminTree: jest.fn().mockReturnValue(of({ folders: [] } satisfies ArticleTree)),
      getPublicArticle: jest.fn().mockReturnValue(of(articleDetail())),
      getAdminArticle: jest.fn().mockReturnValue(of(articleDetail())),
      getPublicArticles: jest
        .fn()
        .mockReturnValue(of({ articles: [], totalCount: 0, totalPages: 0 } satisfies ArticleList)),
      getAdminArticles: jest
        .fn()
        .mockReturnValue(of({ articles: [], totalCount: 0, totalPages: 0 } satisfies ArticleList)),
      trackPublicView: jest.fn().mockReturnValue(of(undefined)),
      trackPublicEngagedView: jest.fn().mockReturnValue(of(undefined)),
      setPublicReaction: jest.fn().mockReturnValue(of(undefined)),
      getAdminStats: jest.fn().mockReturnValue(of(undefined)),
    };
    anonymousReactionService = {
      getOrCreateClientToken: jest.fn().mockReturnValue('client-token'),
      getReaction: jest.fn().mockReturnValue(null),
      setReaction: jest.fn(),
    };
    seoService = {
      setTranslatedMeta: jest.fn(),
      setMeta: jest.fn(),
    };
    router = { navigate: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [ArticlesPageComponent],
      providers: [
        provideRouter([]),
        { provide: ArticlesService, useValue: articlesService },
        { provide: AuthService, useValue: { canManageContent: () => canManageContent } },
        { provide: SeoService, useValue: seoService },
        provideI18nTesting(),
        {
          provide: NotificationService,
          useValue: { success: jest.fn(), error: jest.fn() },
        },
        { provide: AnonymousReactionService, useValue: anonymousReactionService },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: paramMap.asObservable(),
            queryParamMap: queryParamMap.asObservable(),
          },
        },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ArticlesPageComponent);
  });

  afterEach(() => {
    setDocumentVisibility('visible');
    jest.restoreAllMocks();
    fixture.destroy();
  });

  it('sends engaged view once after detail stays open for 30 seconds', fakeAsync(() => {
    fixture.detectChanges();
    articlesService.trackPublicEngagedView.mockClear();

    fixture.componentInstance.loadDetail('typed-articles');

    tick(30_000);

    expect(articlesService.trackPublicEngagedView).toHaveBeenCalledWith('typed-articles', 'ru');

    tick(30_000);

    expect(articlesService.trackPublicEngagedView).toHaveBeenCalledTimes(1);
  }));

  it('sets article-specific SEO meta after loading detail', () => {
    fixture.detectChanges();

    expect(seoService.setMeta).toHaveBeenCalledWith({
      title: 'SEO Typed articles RU',
      description:
        'SEO description RU with enough text to be useful for search snippets and social cards.',
      canonicalPath: '/ru/articles/typed-articles',
      ogImage: 'https://example.com/cover.jpg',
      ogType: 'article',
      alternates: [
        { language: 'ru', path: '/ru/articles/typed-articles' },
        { language: 'en', path: '/en/articles/typed-articles' },
      ],
      structuredData: expect.objectContaining({
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: 'SEO Typed articles RU',
      }),
    });
  });

  it('tracks public view for public published detail and ignores tracking failure', () => {
    articlesService.trackPublicView.mockReturnValue(throwError(() => new Error('tracking failed')));

    fixture.detectChanges();

    expect(articlesService.trackPublicView).toHaveBeenCalledWith('typed-articles', 'ru');
    expect(seoService.setMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'SEO Typed articles RU',
        canonicalPath: '/ru/articles/typed-articles',
      }),
    );
  });

  it('falls back to article title and excerpt when SEO metadata is null', () => {
    articlesService.getPublicArticle.mockReturnValue(
      of(
        articleDetail({
          metadata: {
            seoTitleRu: null,
            seoTitleEn: null,
            seoDescriptionRu: null,
            seoDescriptionEn: null,
            coverImageFileId: null,
            coverImageUrl: null,
            coverImageAltRu: null,
            coverImageAltEn: null,
          },
        }),
      ),
    );

    fixture.detectChanges();

    expect(seoService.setMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Typed articles',
        description: 'Excerpt',
        canonicalPath: '/ru/articles/typed-articles',
      }),
    );
  });

  it('loads public article detail for content managers on public routes', () => {
    canManageContent = true;

    fixture.detectChanges();

    expect(articlesService.getPublicArticle).toHaveBeenCalledWith('typed-articles', 'ru');
    expect(articlesService.getAdminArticle).not.toHaveBeenCalled();
    expect(articlesService.trackPublicView).toHaveBeenCalledWith('typed-articles', 'ru');
  });

  it('does not track public view for draft detail reads', () => {
    articlesService.getPublicArticle.mockReturnValue(of(articleDetail({ publishStatus: 'Draft' })));

    fixture.detectChanges();

    expect(articlesService.trackPublicView).not.toHaveBeenCalled();
  });

  it('keeps generic translated SEO meta on the articles list route', () => {
    paramMap.next(convertToParamMap({}));
    fixture.detectChanges();

    expect(seoService.setTranslatedMeta).toHaveBeenCalledWith({
      titleKey: 'articles.seo.title',
      descriptionKey: 'articles.seo.description',
      canonicalPath: '/ru/articles',
      alternates: [
        { language: 'ru', path: '/ru/articles' },
        { language: 'en', path: '/en/articles' },
      ],
    });
  });

  it('pauses engaged view timer while document is hidden', fakeAsync(() => {
    fixture.detectChanges();
    articlesService.trackPublicEngagedView.mockClear();

    fixture.componentInstance.loadDetail('typed-articles');

    tick(10_000);
    setDocumentVisibility('hidden');
    tick(30_000);

    expect(articlesService.trackPublicEngagedView).not.toHaveBeenCalled();

    setDocumentVisibility('visible');
    tick(19_999);

    expect(articlesService.trackPublicEngagedView).not.toHaveBeenCalled();

    tick(1);

    expect(articlesService.trackPublicEngagedView).toHaveBeenCalledWith('typed-articles', 'ru');
  }));

  it('creates reaction token lazily and persists selected reaction after success', () => {
    fixture.detectChanges();

    fixture.componentInstance.selectReaction('poop');

    expect(anonymousReactionService.getOrCreateClientToken).toHaveBeenCalled();
    expect(articlesService.setPublicReaction).toHaveBeenCalledWith(
      'typed-articles',
      {
        reactionKind: 'poop',
        clientToken: 'client-token',
      },
      'ru',
    );
    expect(anonymousReactionService.setReaction).toHaveBeenCalledWith('typed-articles', 'poop');
    fixture.destroy();
  });

  it('does not submit a reaction when no anonymous client token is available', () => {
    anonymousReactionService.getOrCreateClientToken.mockReturnValue(null);
    fixture.detectChanges();

    fixture.componentInstance.selectReaction('poop');

    expect(articlesService.setPublicReaction).not.toHaveBeenCalled();
    expect(anonymousReactionService.setReaction).not.toHaveBeenCalled();
    expect(fixture.componentInstance.reactionLoading()).toBe(false);
  });

  it('loads list filters from query params and requests articles with them', () => {
    paramMap.next(convertToParamMap({}));
    queryParamMap.next(
      convertToParamMap({
        page: '2',
        tag: 'python',
        searchQuery: 'postgres search',
        publishedFrom: '2026-01-01',
        publishedTo: '2026-01-31',
      }),
    );

    fixture.detectChanges();

    expect(articlesService.getPublicArticles).toHaveBeenCalledWith({
      page: 2,
      pageSize: 10,
      language: 'ru',
      tagSlug: 'python',
      publishedFrom: '2026-01-01',
      publishedTo: '2026-01-31',
      searchQuery: 'postgres search',
    });
  });

  it('uses public list API for content managers on public routes', () => {
    canManageContent = true;
    paramMap.next(convertToParamMap({}));
    queryParamMap.next(convertToParamMap({ tag: 'python' }));

    fixture.detectChanges();

    expect(articlesService.getPublicArticles).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      language: 'ru',
      tagSlug: 'python',
      publishedFrom: null,
      publishedTo: null,
      searchQuery: null,
    });
    expect(articlesService.getAdminArticles).not.toHaveBeenCalled();
    expect(articlesService.getPublicTags).toHaveBeenCalledWith('ru');
    expect(articlesService.getAdminTags).not.toHaveBeenCalled();
    expect(articlesService.getPublicTree).toHaveBeenCalledWith('ru');
    expect(articlesService.getAdminTree).not.toHaveBeenCalled();
  });

  it('renders the side panel toggle to the left of the title as an icon-only control with localized state labels', () => {
    paramMap.next(convertToParamMap({}));
    fixture.detectChanges();

    const title = fixture.nativeElement.querySelector('h1') as HTMLElement;
    const toggle = fixture.nativeElement.querySelector(
      '[data-testid="articles-side-panel-toggle"]',
    ) as HTMLButtonElement;

    expect(toggle.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(toggle.textContent?.trim()).toBe('');
    expect(toggle.getAttribute('aria-label')).toBe('Открыть папки');
    expect(toggle.title).toBe('Открыть папки');

    toggle.click();
    fixture.detectChanges();

    expect(toggle.getAttribute('aria-label')).toBe('Скрыть папки');
    expect(toggle.title).toBe('Скрыть папки');
    expect(toggle.querySelector('[data-testid="articles-side-panel-close-icon"]')).toBeTruthy();
  });

  it('hides folders and list filters on article detail routes', () => {
    fixture.componentInstance.sidePanelOpen.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="articles-side-panel-toggle"]')).toBe(
      null,
    );
    expect(fixture.nativeElement.querySelector('[data-testid="articles-side-panel"]')).toBe(null);
    expect(fixture.nativeElement.querySelector('[data-testid="articles-filter-form"]')).toBe(null);
    expect(fixture.nativeElement.querySelector('[data-testid="articles-tag-filters"]')).toBe(null);
  });

  it('renders localized date pickers with accessible format guidance and keeps ISO query params', () => {
    paramMap.next(convertToParamMap({}));
    fixture.detectChanges();

    const from = fixture.nativeElement.querySelector('#articlesPublishedFrom') as HTMLInputElement;
    const to = fixture.nativeElement.querySelector('#articlesPublishedTo') as HTMLInputElement;

    expect(from.type).toBe('text');
    expect(to.type).toBe('text');
    expect(from.placeholder).toBe('дд.мм.гггг');
    expect(to.placeholder).toBe('дд.мм.гггг');
    expect(fixture.nativeElement.querySelector('[data-testid="date-picker-toggle"]')).toBeTruthy();
    expect(from.title).toBe('Формат даты: ДД.ММ.ГГГГ');
    expect(to.title).toBe('Формат даты: ДД.ММ.ГГГГ');
    expect(document.getElementById(from.getAttribute('aria-describedby')!)).not.toBeNull();
    expect(document.getElementById(to.getAttribute('aria-describedby')!)).not.toBeNull();

    fixture.nativeElement.querySelector('[data-testid="date-picker-toggle"]').click();
    fixture.detectChanges();

    const monthYearToggle = fixture.nativeElement.querySelector(
      '[data-testid="date-picker-month-year-toggle"]',
    ) as HTMLButtonElement | null;
    expect(monthYearToggle?.getAttribute('aria-label')).toBe('Выбрать месяц и год');

    fixture.componentInstance.setPublishedFrom('2026-01-01');
    fixture.componentInstance.setPublishedTo('2026-01-31');
    fixture.componentInstance.applyFilters();

    expect(router.navigate).toHaveBeenCalledWith(['/', 'ru', 'articles'], {
      queryParams: {
        page: 1,
        publishedFrom: '2026-01-01',
        publishedTo: '2026-01-31',
      },
    });

    TestBed.inject(I18nService).switchLanguage('en').subscribe();
    fixture.detectChanges();

    expect(from.value).toBe('01/01/2026');
    expect(to.value).toBe('01/31/2026');
    expect(from.placeholder).toBe('mm/dd/yyyy');
    expect(to.placeholder).toBe('mm/dd/yyyy');
  });

  it('does not apply public article filters while a date picker contains invalid manual input', () => {
    paramMap.next(convertToParamMap({}));
    fixture.detectChanges();
    const publishedFrom = fixture.nativeElement.querySelector(
      '#articlesPublishedFrom',
    ) as HTMLInputElement;
    publishedFrom.value = '31.02.2026';
    publishedFrom.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    router.navigate.mockClear();

    fixture.componentInstance.applyFilters();
    fixture.detectChanges();

    expect(router.navigate).not.toHaveBeenCalled();
    expect(publishedFrom.getAttribute('aria-invalid')).toBe('true');
  });

  it('keeps article authoring controls out of public article routes for content managers', () => {
    canManageContent = true;
    paramMap.next(convertToParamMap({}));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;

    expect(text).not.toContain('Добавить статью');
    expect(text).not.toContain('Статистика');
    expect(fixture.nativeElement.querySelector('app-article-form')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="articles-stats-panel-shell"]')).toBe(
      null,
    );
    expect(fixture.nativeElement.querySelector('#articlesOnlyPublishedToggle')).toBeNull();
    expect(articlesService.getAdminStats).not.toHaveBeenCalled();
  });

  it('reloads localized content when language changes', () => {
    paramMap.next(convertToParamMap({}));
    fixture.detectChanges();
    articlesService.getPublicArticles.mockClear();
    articlesService.getPublicTags.mockClear();
    articlesService.getPublicTree.mockClear();

    TestBed.inject(I18nService).switchLanguage('en').subscribe();
    fixture.detectChanges();

    expect(articlesService.getPublicTags).toHaveBeenCalledWith('en');
    expect(articlesService.getPublicTree).toHaveBeenCalledWith('en');
    expect(articlesService.getPublicArticles).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      language: 'en',
      tagSlug: null,
      publishedFrom: null,
      publishedTo: null,
      searchQuery: null,
    });
  });

  it('does not render the published-only switch for content managers on public routes', () => {
    canManageContent = true;
    paramMap.next(convertToParamMap({}));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#articlesOnlyPublishedToggle')).toBeNull();
  });

  it('applies list filters through query params without fetching on input changes', () => {
    paramMap.next(convertToParamMap({}));
    fixture.detectChanges();
    articlesService.getPublicArticles.mockClear();

    fixture.componentInstance.setSearchQuery('  postgres  ');
    fixture.componentInstance.setPublishedFrom('2026-01-01');
    fixture.componentInstance.setPublishedTo('2026-01-31');
    fixture.componentInstance.applyFilters();

    expect(articlesService.getPublicArticles).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/', 'ru', 'articles'], {
      queryParams: {
        page: 1,
        searchQuery: 'postgres',
        publishedFrom: '2026-01-01',
        publishedTo: '2026-01-31',
      },
    });
  });

  it('preserves list filters while paginating', () => {
    paramMap.next(convertToParamMap({}));
    queryParamMap.next(
      convertToParamMap({
        tag: 'python',
        searchQuery: 'postgres',
        publishedFrom: '2026-01-01',
        publishedTo: '2026-01-31',
      }),
    );
    fixture.detectChanges();

    fixture.componentInstance.changePage(3);

    expect(router.navigate).toHaveBeenCalledWith(['/', 'ru', 'articles'], {
      queryParams: {
        page: 3,
        tag: 'python',
        searchQuery: 'postgres',
        publishedFrom: '2026-01-01',
        publishedTo: '2026-01-31',
      },
    });
  });

  it('clears tag, search, and date filters together', () => {
    paramMap.next(convertToParamMap({}));
    queryParamMap.next(
      convertToParamMap({
        tag: 'python',
        searchQuery: 'postgres',
        publishedFrom: '2026-01-01',
        publishedTo: '2026-01-31',
      }),
    );
    fixture.detectChanges();

    fixture.componentInstance.clearListFilters();

    expect(router.navigate).toHaveBeenCalledWith(['/', 'ru', 'articles'], {
      queryParams: { page: 1 },
    });
  });
});

function articleDetail(overrides: Partial<ArticleDetail> = {}): ArticleDetail {
  return {
    id: '00000000000000000000000000000001',
    title: 'Typed articles',
    slug: 'typed-articles',
    folder: 'Engineering',
    folderId: 'folder-1',
    folderKey: 'engineering',
    authorUsername: 'admin',
    publishedAt: '2026-01-02T03:04:05+00:00',
    publishStatus: 'Published',
    createdAt: '2026-01-01T03:04:05+00:00',
    updatedAt: '2026-01-03T03:04:05+00:00',
    excerpt: 'Excerpt',
    content: '# Content',
    metadata: {
      seoTitleRu: 'SEO Typed articles RU',
      seoTitleEn: 'SEO Typed articles EN',
      seoDescriptionRu:
        'SEO description RU with enough text to be useful for search snippets and social cards.',
      seoDescriptionEn:
        'SEO description EN with enough text to be useful for search snippets and social cards.',
      coverImageFileId: 'cover-file-id',
      coverImageUrl: 'https://example.com/cover.jpg',
      coverImageAltRu: 'Cover image RU',
      coverImageAltEn: 'Cover image EN',
    },
    viewCount: 1,
    reactionCounts: { heart: 0, fire: 0, thinking: 0, neutral: 0, poop: 0 },
    tags: [],
    translations: {
      ru: { title: 'Typed articles', content: '# Content' },
      en: { title: 'Typed articles', content: '# Content' },
    },
    ...overrides,
  };
}

function setDocumentVisibility(visibilityState: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: visibilityState,
  });
}
