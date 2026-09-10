import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiClient } from '../../../core/http/api-client.service';
import { ArticlesService } from './articles.service';

const ARTICLE_ID = '00000000000000000000000000000001';
const TAG_ID = '00000000000000000000000000000002';

describe('ArticlesService', () => {
  let service: ArticlesService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ArticlesService, ApiClient, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ArticlesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads public articles with pagination and public-safe filters', () => {
    let firstTitle: string | undefined;
    let firstViewCount: number | undefined;
    let firstSeoTitle: string | null | undefined;

    service
      .getPublicArticles({
        page: 2,
        pageSize: 10,
        language: 'en',
        tagSlug: 'python',
        publishedFrom: '2026-01-01',
        publishedTo: '2026-01-31',
        searchQuery: 'typed articles',
      })
      .subscribe((list) => {
        firstTitle = list.articles[0].title;
        firstViewCount = list.articles[0].viewCount;
        firstSeoTitle = list.articles[0].metadata.seoTitleEn;
      });

    const req = httpMock.expectOne((r) => r.url.endsWith('/api/articles'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('language')).toBe('en');
    expect(req.request.params.get('pageSize')).toBe('10');
    expect(req.request.params.has('onlyPublished')).toBe(false);
    expect(req.request.params.get('tagSlug')).toBe('python');
    expect(req.request.params.get('publishedFrom')).toBe('2026-01-01');
    expect(req.request.params.get('publishedTo')).toBe('2026-01-31');
    expect(req.request.params.get('searchQuery')).toBe('typed articles');
    req.flush({
      totalCount: 1,
      totalPages: 1,
      articles: [
        {
          id: ARTICLE_ID,
          title: 'Typed articles',
          content: 'Ignored in list',
          slug: 'typed-articles',
          folder: 'Engineering',
          folderId: 'folder-1',
          folderKey: 'engineering',
          authorUsername: 'admin',
          publishedAt: '2026-01-02T03:04:05+00:00',
          publishStatus: 'Published',
          updatedAt: '2026-01-03T03:04:05+00:00',
          excerpt: 'Excerpt',
          metadata: metadataDto(),
          tags: [
            {
              id: TAG_ID,
              name: 'Python',
              slug: 'python',
              translations: { ru: { name: 'Python' }, en: { name: 'Python' } },
            },
          ],
        },
      ],
    });
    flushPublicStats(httpMock, [{ articleId: ARTICLE_ID, viewCount: 42 }]);

    expect(firstTitle).toBe('Typed articles');
    expect(firstViewCount).toBe(42);
    expect(firstSeoTitle).toBe('SEO Typed articles');
  });

  it('loads public detail without visibility query params', () => {
    let content: string | undefined;
    let fireCount: number | undefined;
    let seoDescription: string | null | undefined;

    service.getPublicArticle('typed-articles', 'ru').subscribe((article) => {
      content = article.content;
      fireCount = article.reactionCounts.fire;
      seoDescription = article.metadata.seoDescriptionRu;
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/api/articles/detail/typed-articles'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('language')).toBe('ru');
    expect(req.request.params.has('onlyPublished')).toBe(false);
    req.flush({
      id: ARTICLE_ID,
      title: 'Typed articles',
      content: '# Markdown',
      slug: 'typed-articles',
      folder: 'Engineering',
      folderId: 'folder-1',
      folderKey: 'engineering',
      authorUsername: 'admin',
      publishedAt: '2026-01-02T03:04:05+00:00',
      publishStatus: 'Published',
      createdAt: '2026-01-01T03:04:05+00:00',
      updatedAt: '2026-01-03T03:04:05+00:00',
      excerpt: 'Markdown',
      metadata: metadataDto(),
      tags: [],
      translations: {
        ru: { title: 'Типизированные статьи', content: '# Markdown' },
        en: { title: 'Typed articles', content: '# Markdown' },
      },
    });
    flushPublicStats(httpMock, [
      {
        articleId: ARTICLE_ID,
        viewCount: 5,
        reactionCounts: { heart: 1, fire: 2, thinking: 3, neutral: 4, poop: 5 },
      },
    ]);

    expect(content).toBe('# Markdown');
    expect(fireCount).toBe(2);
    expect(seoDescription).toBe('SEO описание');
  });

  it('tracks engagement and reactions', () => {
    service.trackPublicView('typed-articles', 'ru').subscribe();
    const viewReq = httpMock.expectOne((r) =>
      r.url.endsWith('/api/articles/detail/typed-articles/analytics/view'),
    );
    expect(viewReq.request.method).toBe('POST');
    expect(viewReq.request.params.get('language')).toBe('ru');
    viewReq.flush(null);

    service.trackPublicEngagedView('typed-articles', 'ru').subscribe();
    const engagedReq = httpMock.expectOne((r) =>
      r.url.endsWith('/api/articles/detail/typed-articles/analytics/engaged-view'),
    );
    expect(engagedReq.request.method).toBe('POST');
    expect(engagedReq.request.params.get('language')).toBe('ru');
    engagedReq.flush(null);

    service
      .setPublicReaction(
        'typed-articles',
        { reactionKind: 'poop', clientToken: 'client-token' },
        'en',
      )
      .subscribe();
    const reactionReq = httpMock.expectOne((r) =>
      r.url.endsWith('/api/articles/detail/typed-articles/reaction'),
    );
    expect(reactionReq.request.method).toBe('POST');
    expect(reactionReq.request.params.get('language')).toBe('en');
    expect(reactionReq.request.body).toEqual({
      reactionKind: 'poop',
      clientToken: 'client-token',
    });
    reactionReq.flush(null);
  });

  it('loads tree without tag filters', () => {
    let firstFolder: string | undefined;

    service.getPublicTree('ru').subscribe((tree) => {
      firstFolder = tree.folders[0].folder;
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/api/articles/tree'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('language')).toBe('ru');
    req.flush({
      folders: [
        {
          folderId: 'folder-1',
          folderKey: 'engineering',
          folder: 'Engineering',
          articles: [
            {
              title: 'Typed articles',
              slug: 'typed-articles',
              publishStatus: 'Published',
              publishedAt: '2026-01-02T03:04:05+00:00',
              updatedAt: '2026-01-03T03:04:05+00:00',
            },
          ],
        },
      ],
    });

    expect(firstFolder).toBe('Engineering');
  });

  it('loads public tags without deleted-content controls', () => {
    service.getPublicTags('en').subscribe();

    const listReq = httpMock.expectOne((r) => r.url.endsWith('/api/articles/tags'));
    expect(listReq.request.params.get('language')).toBe('en');
    listReq.flush({ tags: [] });
  });
});

function metadataDto(): {
  seoTitleRu: string | null;
  seoTitleEn: string | null;
  seoDescriptionRu: string | null;
  seoDescriptionEn: string | null;
  coverImageFileId: string | null;
  coverImageUrl: string | null;
  coverImageAltRu: string | null;
  coverImageAltEn: string | null;
} {
  return {
    seoTitleRu: 'SEO статья',
    seoTitleEn: 'SEO Typed articles',
    seoDescriptionRu: 'SEO описание',
    seoDescriptionEn: 'SEO description',
    coverImageFileId: 'cover-file-id',
    coverImageUrl: 'https://example.com/cover.jpg',
    coverImageAltRu: 'Обложка',
    coverImageAltEn: 'Cover',
  };
}

function flushPublicStats(
  httpMock: HttpTestingController,
  stats: {
    articleId: string;
    viewCount: number;
    reactionCounts?: {
      heart: number;
      fire: number;
      thinking: number;
      neutral: number;
      poop: number;
    };
  }[],
): void {
  const req = httpMock.expectOne((r) => r.url.endsWith('/api/articles/public-stats'));
  expect(req.request.method).toBe('GET');
  expect(req.request.params.getAll('articleIds')).toEqual(stats.map((item) => item.articleId));
  req.flush({
    stats: stats.map((item) => ({
      articleId: item.articleId,
      viewCount: item.viewCount,
      reactionCounts: item.reactionCounts ?? {
        heart: 0,
        fire: 0,
        thinking: 0,
        neutral: 0,
        poop: 0,
      },
    })),
  });
}
