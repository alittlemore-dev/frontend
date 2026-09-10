import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import {
  chooseSiteSelectOption,
  siteSelectOptionValues,
} from '../../../../testing/site-select-testing';
import {
  AdminArticleDetail,
  AdminArticleList,
  AdminArticlePayload,
  AdminArticleTag,
  AdminArticleTree,
} from '../../models/article-workspace.model';
import { ArticleWorkspaceService } from '../../services/article-workspace.service';
import { AdminArticlesPageComponent } from './articles-page.component';

describe('AdminArticlesPageComponent', () => {
  let fixture: ComponentFixture<AdminArticlesPageComponent>;
  let service: {
    listArticles: jest.Mock;
    getTags: jest.Mock;
    getFolders: jest.Mock;
    createFolder: jest.Mock;
    updateFolderPriorities: jest.Mock;
    getTree: jest.Mock;
    getArticle: jest.Mock;
    createArticle: jest.Mock;
    updateArticle: jest.Mock;
    publishArticle: jest.Mock;
    unpublishArticle: jest.Mock;
    deleteArticle: jest.Mock;
  };
  let router: Router;
  let routeQueryParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(async () => {
    service = {
      listArticles: jest.fn().mockReturnValue(of(articleList())),
      getTags: jest.fn().mockReturnValue(of([] satisfies AdminArticleTag[])),
      getFolders: jest.fn().mockReturnValue(of([])),
      createFolder: jest.fn().mockReturnValue(of(null)),
      updateFolderPriorities: jest.fn().mockReturnValue(of(undefined)),
      getTree: jest.fn().mockReturnValue(of({ folders: [] } satisfies AdminArticleTree)),
      getArticle: jest.fn().mockReturnValue(of(articleDetail())),
      createArticle: jest.fn().mockReturnValue(of(articleDetail())),
      updateArticle: jest.fn().mockReturnValue(of(articleDetail())),
      publishArticle: jest.fn().mockReturnValue(of(undefined)),
      unpublishArticle: jest.fn().mockReturnValue(of(undefined)),
      deleteArticle: jest.fn().mockReturnValue(of(undefined)),
    };
    routeQueryParams = new BehaviorSubject(convertToParamMap({}));

    await TestBed.configureTestingModule({
      imports: [AdminArticlesPageComponent],
      providers: [
        provideRouter([]),
        provideI18nTesting(),
        { provide: ArticleWorkspaceService, useValue: service },
        { provide: NotificationService, useValue: { success: jest.fn(), error: jest.fn() } },
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: routeQueryParams.asObservable() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminArticlesPageComponent);
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  it('loads article workspace through admin endpoints and renders authoring controls', () => {
    fixture.detectChanges();

    expect(service.listArticles).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      language: 'ru',
      publishStatus: null,
      tagSlug: null,
      publishedFrom: null,
      publishedTo: null,
      searchQuery: null,
    });
    expect(fixture.nativeElement.textContent).toContain('Статьи');
    expect(fixture.nativeElement.textContent).toContain('Добавить статью');
    expect(
      fixture.nativeElement.querySelector('[data-testid="admin-articles-publish-status"]'),
    ).toBeTruthy();
  });

  it('restores all applied article filters from the URL before the first list request', () => {
    service.getTags.mockReturnValue(
      of([
        {
          id: 'tag-1',
          name: 'Angular',
          slug: 'angular',
          translations: { ru: { name: 'Angular' }, en: { name: 'Angular' } },
        } satisfies AdminArticleTag,
      ]),
    );
    service.listArticles.mockReturnValue(of({ ...articleList(), totalPages: 5 }));
    routeQueryParams.next(
      convertToParamMap({
        q: 'router',
        tag: 'angular',
        publishedFrom: '2026-01-01',
        publishedTo: '2026-02-01',
        publishStatus: 'Published',
        page: '3',
      }),
    );

    fixture.detectChanges();

    expect(service.listArticles).toHaveBeenCalledTimes(1);
    expect(service.listArticles).toHaveBeenCalledWith({
      page: 3,
      pageSize: 20,
      language: 'ru',
      publishStatus: 'Published',
      tagSlug: 'angular',
      publishedFrom: '2026-01-01',
      publishedTo: '2026-02-01',
      searchQuery: 'router',
    });
    const publishedFrom = fixture.nativeElement.querySelector(
      '#admin-articles-from',
    ) as HTMLInputElement;
    const publishedTo = fixture.nativeElement.querySelector(
      '#admin-articles-to',
    ) as HTMLInputElement;
    expect(publishedFrom.type).toBe('text');
    expect(publishedFrom.classList).toContain('form-control-sm');
    expect(publishedFrom.value).toBe('01.01.2026');
    expect(publishedTo.value).toBe('01.02.2026');
    expect(
      fixture.nativeElement.querySelectorAll('[data-testid="date-picker-toggle"]').length,
    ).toBe(2);
  });

  it('applies themed date picker values as ISO article filters', () => {
    fixture.detectChanges();
    const publishedFrom = fixture.nativeElement.querySelector(
      '#admin-articles-from',
    ) as HTMLInputElement;
    const publishedTo = fixture.nativeElement.querySelector(
      '#admin-articles-to',
    ) as HTMLInputElement;

    publishedFrom.value = '15/03/2026';
    publishedFrom.dispatchEvent(new Event('input'));
    publishedTo.value = '20/03/2026';
    publishedTo.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();

    expect(service.listArticles).toHaveBeenLastCalledWith(
      expect.objectContaining({
        publishedFrom: '2026-03-15',
        publishedTo: '2026-03-20',
      }),
    );
  });

  it('does not apply article filters while a date picker contains invalid manual input', () => {
    fixture.detectChanges();
    const publishedFrom = fixture.nativeElement.querySelector(
      '#admin-articles-from',
    ) as HTMLInputElement;
    publishedFrom.value = '31.02.2026';
    publishedFrom.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    service.listArticles.mockClear();

    fixture.componentInstance.applyFilters();
    fixture.detectChanges();

    expect(service.listArticles).not.toHaveBeenCalled();
    expect(publishedFrom.getAttribute('aria-invalid')).toBe('true');
  });

  it('requests articles with the selected publication status', () => {
    fixture.detectChanges();
    service.listArticles.mockClear();
    expect(
      siteSelectOptionValues(fixture, '[data-testid="admin-articles-publish-status"]'),
    ).toEqual(['', 'Draft', 'Published']);
    chooseSiteSelectOption(fixture, '[data-testid="admin-articles-publish-status"]', 'Draft');
    fixture.nativeElement.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();

    expect(service.listArticles).toHaveBeenLastCalledWith(
      expect.objectContaining({ publishStatus: 'Draft' }),
    );
  });

  it('clamps an out-of-range URL page and reloads the nearest valid page', () => {
    routeQueryParams.next(convertToParamMap({ page: '9' }));

    fixture.detectChanges();

    expect(service.listArticles.mock.calls.map(([filters]) => filters.page)).toEqual([9, 1]);
    expect(router.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: expect.objectContaining({ page: null }),
        queryParamsHandling: 'merge',
        replaceUrl: true,
      }),
    );
  });

  it('publishes an article from the admin workspace', () => {
    fixture.detectChanges();

    fixture.componentInstance.publishArticle('typed-articles');

    expect(service.publishArticle).toHaveBeenCalledWith('typed-articles');
    expect(service.listArticles).toHaveBeenCalledTimes(2);
  });

  it('creates an article from the admin workspace', () => {
    const payload = articlePayload();
    fixture.detectChanges();

    fixture.componentInstance.openCreate();
    fixture.componentInstance.saveArticle(payload);

    expect(service.createArticle).toHaveBeenCalledWith(payload, 'ru');
    expect(service.updateArticle).not.toHaveBeenCalled();
    expect(service.listArticles).toHaveBeenCalledTimes(2);
  });

  it('routes the row edit action to the article detail page from the actions dropdown', () => {
    fixture.detectChanges();

    const toggle = fixture.nativeElement.querySelector(
      '[data-testid="article-actions-typed-articles-toggle"]',
    ) as HTMLButtonElement | null;
    expect(toggle).not.toBeNull();
    toggle?.click();
    fixture.detectChanges();
    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="article-actions-typed-articles-edit"]')
      ?.click();

    expect(router.navigate).toHaveBeenCalledWith(['/admin-panel/articles', 'typed-articles'], {
      queryParamsHandling: 'preserve',
    });
    expect(service.getArticle).not.toHaveBeenCalled();
  });

  it('links published and draft article titles to their admin edit pages', () => {
    fixture.detectChanges();

    const links = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLAnchorElement>('tbody td:first-child a'),
    ).map((link) => link.getAttribute('href') ?? '');

    expect(links).toContain('/admin-panel/articles/typed-articles');
    expect(links).toContain('/admin-panel/articles/draft-article');
    expect(links).not.toContain('/ru/articles/typed-articles');
  });

  it('unpublishes and deletes articles from the admin workspace', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    fixture.detectChanges();

    fixture.componentInstance.unpublishArticle('typed-articles');
    fixture.componentInstance.deleteArticle('typed-articles');

    expect(service.unpublishArticle).toHaveBeenCalledWith('typed-articles');
    expect(service.deleteArticle).toHaveBeenCalledWith('typed-articles');
    expect(service.listArticles).toHaveBeenCalledTimes(3);
  });
});

function articleList(): AdminArticleList {
  return {
    totalCount: 2,
    totalPages: 1,
    articles: [
      {
        id: '00000000000000000000000000000001',
        title: 'Typed articles',
        slug: 'typed-articles',
        folder: 'Engineering',
        folderId: 'folder-1',
        folderKey: 'engineering',
        authorUsername: 'admin',
        publishedAt: '2026-01-02T03:04:05+00:00',
        publishStatus: 'Published',
        updatedAt: '2026-01-03T03:04:05+00:00',
        excerpt: 'Excerpt',
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
        viewCount: 7,
        tags: [],
      },
      {
        id: '00000000000000000000000000000002',
        title: 'Draft article',
        slug: 'draft-article',
        folder: 'Engineering',
        folderId: 'folder-1',
        folderKey: 'engineering',
        authorUsername: 'admin',
        publishedAt: null,
        publishStatus: 'Draft',
        updatedAt: '2026-01-04T03:04:05+00:00',
        excerpt: 'Draft excerpt',
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
        viewCount: 0,
        tags: [],
      },
    ],
  };
}

function articleDetail(): AdminArticleDetail {
  return {
    ...articleList().articles[0],
    content: '# Content',
    createdAt: '2026-01-01T03:04:05+00:00',
    reactionCounts: { heart: 1, fire: 0, thinking: 0, neutral: 0, poop: 0 },
    translations: {
      ru: { title: 'Typed articles', content: '# Content' },
      en: { title: 'Typed articles', content: '# Content' },
    },
  };
}

function articlePayload(): AdminArticlePayload {
  return {
    slug: 'typed-articles',
    folderId: 'folder-1',
    publishStatus: 'Draft',
    tagIds: [],
    metadata: {
      seoTitleRu: null,
      seoTitleEn: null,
      seoDescriptionRu: null,
      seoDescriptionEn: null,
      coverImageFileId: null,
      coverImageAltRu: null,
      coverImageAltEn: null,
    },
    translations: {
      ru: { title: 'Typed articles', content: '# Content' },
      en: { title: 'Typed articles', content: '# Content' },
    },
  };
}
