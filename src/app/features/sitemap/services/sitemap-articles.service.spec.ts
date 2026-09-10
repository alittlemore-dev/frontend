import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import { SitemapArticlesService } from './sitemap-articles.service';

describe('SitemapArticlesService', () => {
  let api: { get: jest.Mock };
  let service: SitemapArticlesService;

  beforeEach(() => {
    api = {
      get: jest.fn(),
    };

    TestBed.configureTestingModule({
      providers: [SitemapArticlesService, { provide: ApiClient, useValue: api }],
    });
    service = TestBed.inject(SitemapArticlesService);
  });

  it('fetches every page of published articles for the active sitemap language', () => {
    api.get
      .mockReturnValueOnce(
        of({
          totalPages: 2,
          articles: [article('typed-articles', 'Typed articles')],
        }),
      )
      .mockReturnValueOnce(
        of({
          totalPages: 2,
          articles: [article('angular-ssr', 'Angular SSR')],
        }),
      );

    let slugs: string[] = [];
    service.getPublishedArticles('en').subscribe((articles) => {
      slugs = articles.map((item) => item.slug);
    });

    expect(api.get).toHaveBeenNthCalledWith(1, '/api/articles', {
      page: '1',
      pageSize: '100',
      language: 'en',
    });
    expect(api.get).toHaveBeenNthCalledWith(2, '/api/articles', {
      page: '2',
      pageSize: '100',
      language: 'en',
    });
    expect(slugs).toEqual(['typed-articles', 'angular-ssr']);
  });
});

function article(slug: string, title: string): { slug: string; title: string } {
  return {
    title,
    slug,
  };
}
