import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiClient } from '../../../core/http/api-client.service';
import { AdminArticlePayload, AdminArticleTagPayload } from '../models/article-workspace.model';
import { ArticleWorkspaceService } from './article-workspace.service';

const ARTICLE_ID = '00000000000000000000000000000001';
const TAG_ID = '00000000000000000000000000000002';

describe('ArticleWorkspaceService', () => {
  let service: ArticleWorkspaceService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ArticleWorkspaceService,
        ApiClient,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(ArticleWorkspaceService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads admin articles with an exact publication status and public stats', () => {
    let firstTitle = '';

    service
      .listArticles({
        page: 2,
        pageSize: 20,
        language: 'en',
        publishStatus: 'Draft',
        tagSlug: 'python',
        publishedFrom: '2026-01-01',
        publishedTo: '2026-01-31',
        searchQuery: 'postgres',
      })
      .subscribe((list) => {
        firstTitle = list.articles[0].title;
      });

    const listReq = httpMock.expectOne((r) => r.url.endsWith('/api/admin/articles'));
    expect(listReq.request.method).toBe('GET');
    expect(listReq.request.params.get('page')).toBe('2');
    expect(listReq.request.params.get('pageSize')).toBe('20');
    expect(listReq.request.params.get('language')).toBe('en');
    expect(listReq.request.params.get('publishStatus')).toBe('Draft');
    expect(listReq.request.params.has('onlyPublished')).toBe(false);
    expect(listReq.request.params.get('tagSlug')).toBe('python');
    expect(listReq.request.params.get('publishedFrom')).toBe('2026-01-01');
    expect(listReq.request.params.get('publishedTo')).toBe('2026-01-31');
    expect(listReq.request.params.get('searchQuery')).toBe('postgres');
    listReq.flush({
      totalCount: 1,
      totalPages: 1,
      articles: [articleSummaryDto()],
    });

    const statsReq = httpMock.expectOne((r) => r.url.endsWith('/api/articles/public-stats'));
    expect(statsReq.request.method).toBe('GET');
    expect(statsReq.request.params.getAll('articleIds')).toEqual([ARTICLE_ID]);
    statsReq.flush({
      stats: [
        {
          articleId: ARTICLE_ID,
          viewCount: 7,
          reactionCounts: { heart: 1, fire: 0, thinking: 0, neutral: 0, poop: 0 },
        },
      ],
    });

    expect(firstTitle).toBe('Typed articles');
  });

  it('creates, updates, publishes, unpublishes, and deletes through admin endpoints', () => {
    service.createArticle(articlePayload(), 'ru').subscribe();
    const createReq = httpMock.expectOne((r) => r.url.endsWith('/api/admin/articles'));
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.params.get('language')).toBe('ru');
    expect(createReq.request.body).toEqual(articlePayload());
    createReq.flush(articleDetailDto());
    httpMock
      .expectOne((r) => r.url.endsWith('/api/articles/public-stats'))
      .flush({
        stats: [publicStatsDto()],
      });

    service.updateArticle('old-slug', articlePayload(), 'en').subscribe();
    const updateReq = httpMock.expectOne((r) =>
      r.url.endsWith('/api/admin/articles/detail/old-slug'),
    );
    expect(updateReq.request.method).toBe('PUT');
    expect(updateReq.request.params.get('language')).toBe('en');
    expect(updateReq.request.body).toEqual(articlePayload());
    updateReq.flush(articleDetailDto());
    httpMock
      .expectOne((r) => r.url.endsWith('/api/articles/public-stats'))
      .flush({
        stats: [publicStatsDto()],
      });

    service.publishArticle('typed-articles').subscribe();
    const publishReq = httpMock.expectOne((r) =>
      r.url.endsWith('/api/admin/articles/detail/typed-articles/set-published'),
    );
    expect(publishReq.request.method).toBe('POST');
    publishReq.flush(null);

    service.unpublishArticle('typed-articles').subscribe();
    const unpublishReq = httpMock.expectOne((r) =>
      r.url.endsWith('/api/admin/articles/detail/typed-articles/set-draft'),
    );
    expect(unpublishReq.request.method).toBe('POST');
    unpublishReq.flush(null);

    service.deleteArticle('typed-articles').subscribe();
    const deleteReq = httpMock.expectOne((r) =>
      r.url.endsWith('/api/admin/articles/detail/typed-articles'),
    );
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush(null);
  });

  it('manages article folders through admin endpoints', () => {
    let folderName = '';

    service.getFolders('en').subscribe((folders) => {
      folderName = folders[0].name;
    });

    const listReq = httpMock.expectOne((r) => r.url.endsWith('/api/admin/articles/folders'));
    expect(listReq.request.method).toBe('GET');
    expect(listReq.request.params.get('language')).toBe('en');
    listReq.flush({ folders: [articleFolderDto()] });
    expect(folderName).toBe('Engineering');

    service
      .createFolder(
        {
          key: 'architecture',
          translations: {
            ru: { name: 'Архитектура' },
            en: { name: 'Architecture' },
          },
        },
        'ru',
      )
      .subscribe();

    const createReq = httpMock.expectOne((r) => r.url.endsWith('/api/admin/articles/folders'));
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.params.get('language')).toBe('ru');
    expect(createReq.request.body).toEqual({
      key: 'architecture',
      translations: {
        ru: { name: 'Архитектура' },
        en: { name: 'Architecture' },
      },
    });
    createReq.flush(articleFolderDto());

    service.updateFolderPriorities(['folder-2', 'folder-1']).subscribe();

    const prioritiesReq = httpMock.expectOne((r) =>
      r.url.endsWith('/api/admin/articles/folders/priorities'),
    );
    expect(prioritiesReq.request.method).toBe('PUT');
    expect(prioritiesReq.request.body).toEqual({ orderedIds: ['folder-2', 'folder-1'] });
    prioritiesReq.flush(null);
  });

  it('loads admin detail and tree through admin endpoints', () => {
    service.getArticle('typed-articles', 'en').subscribe();

    const detailReq = httpMock.expectOne((r) =>
      r.url.endsWith('/api/admin/articles/detail/typed-articles'),
    );
    expect(detailReq.request.method).toBe('GET');
    expect(detailReq.request.params.get('language')).toBe('en');
    expect(detailReq.request.params.get('onlyPublished')).toBe('false');
    detailReq.flush(articleDetailDto());
    httpMock
      .expectOne((r) => r.url.endsWith('/api/articles/public-stats'))
      .flush({
        stats: [publicStatsDto()],
      });

    service.getTree('ru').subscribe();

    const treeReq = httpMock.expectOne((r) => r.url.endsWith('/api/admin/articles/tree'));
    expect(treeReq.request.method).toBe('GET');
    expect(treeReq.request.params.get('language')).toBe('ru');
    treeReq.flush({ folders: [] });
  });

  it('loads article statistics through the admin endpoint', () => {
    let reactionTotal = 0;

    service
      .getAdminStats({ dateFrom: '2026-01-01', dateTo: '2026-01-31', language: 'en' })
      .subscribe((stats) => {
        reactionTotal = stats.totals.reactionCount;
      });

    const req = httpMock.expectOne((r) => r.url.endsWith('/api/admin/articles/stats'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('dateFrom')).toBe('2026-01-01');
    expect(req.request.params.get('dateTo')).toBe('2026-01-31');
    expect(req.request.params.get('language')).toBe('en');
    req.flush({
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      totals: { viewCount: 7, engagedViewCount: 3, reactionCount: 2 },
      articles: [
        {
          articleId: ARTICLE_ID,
          title: 'Typed articles',
          slug: 'typed-articles',
          viewCount: 7,
          engagedViewCount: 3,
          reactionCounts: { heart: 1, fire: 0, thinking: 1, neutral: 0, poop: 0 },
        },
      ],
      daily: [],
    });

    expect(reactionTotal).toBe(2);
  });

  it('manages tags through admin endpoints', () => {
    service.getTags('en').subscribe();

    const listReq = httpMock.expectOne((r) => r.url.endsWith('/api/admin/articles/tags'));
    expect(listReq.request.method).toBe('GET');
    expect(listReq.request.params.get('language')).toBe('en');
    listReq.flush({ tags: [] });

    service.searchTags('back', 5, 'ru').subscribe();

    const searchReq = httpMock.expectOne((r) => r.url.endsWith('/api/admin/articles/tags/search'));
    expect(searchReq.request.method).toBe('GET');
    expect(searchReq.request.params.get('searchName')).toBe('back');
    expect(searchReq.request.params.get('limit')).toBe('5');
    expect(searchReq.request.params.get('language')).toBe('ru');
    searchReq.flush({ tags: [] });

    service.createTag(tagPayload(), 'ru').subscribe();

    const createReq = httpMock.expectOne((r) => r.url.endsWith('/api/admin/articles/tags'));
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.params.get('language')).toBe('ru');
    expect(createReq.request.body).toEqual(tagPayload());
    createReq.flush(tagDto());

    service.updateTag(TAG_ID, tagPayload(), 'en').subscribe();

    const updateReq = httpMock.expectOne((r) =>
      r.url.endsWith(`/api/admin/articles/tags/${TAG_ID}`),
    );
    expect(updateReq.request.method).toBe('PUT');
    expect(updateReq.request.params.get('language')).toBe('en');
    expect(updateReq.request.body).toEqual(tagPayload());
    updateReq.flush(tagDto());

    service.deleteTag(TAG_ID).subscribe();

    const deleteReq = httpMock.expectOne((r) =>
      r.url.endsWith(`/api/admin/articles/tags/${TAG_ID}`),
    );
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush(null);
  });
});

function articleSummaryDto(): unknown {
  return {
    id: ARTICLE_ID,
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
    tags: [],
  };
}

function articleDetailDto(): unknown {
  return {
    ...articleSummaryDto(),
    content: '# Content',
    createdAt: '2026-01-01T03:04:05+00:00',
    translations: {
      ru: { title: 'Typed articles', content: '# Content' },
      en: { title: 'Typed articles', content: '# Content' },
    },
  };
}

function publicStatsDto(): unknown {
  return {
    articleId: ARTICLE_ID,
    viewCount: 7,
    reactionCounts: { heart: 1, fire: 0, thinking: 0, neutral: 0, poop: 0 },
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

function articleFolderDto(): unknown {
  return {
    id: 'folder-1',
    key: 'engineering',
    name: 'Engineering',
    priority: 1,
    translations: {
      ru: { name: 'Инженерия' },
      en: { name: 'Engineering' },
    },
  };
}

function tagPayload(): AdminArticleTagPayload {
  return {
    slug: 'backend',
    translations: {
      ru: { name: 'Бэкенд' },
      en: { name: 'Backend' },
    },
  };
}

function tagDto(): unknown {
  return {
    id: TAG_ID,
    name: 'Backend',
    slug: 'backend',
    translations: {
      ru: { name: 'Бэкенд' },
      en: { name: 'Backend' },
    },
  };
}
