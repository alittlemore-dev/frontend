import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import { LanguageCode } from '../../../core/i18n/i18n.model';

const SITEMAP_ARTICLES_PAGE_SIZE = 100;

export interface SitemapArticle {
  title: string;
  slug: string;
}

interface SitemapArticleListDto {
  totalPages: number;
  articles: SitemapArticle[];
}

@Injectable({ providedIn: 'root' })
export class SitemapArticlesService {
  private readonly api = inject(ApiClient);

  getPublishedArticles(language: LanguageCode): Observable<SitemapArticle[]> {
    return this.getPublishedArticlesPage(1, language).pipe(
      switchMap((firstPage) => {
        if (firstPage.totalPages <= 1) {
          return of(firstPage.articles);
        }
        const followUpPages = Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
          this.getPublishedArticlesPage(index + 2, language),
        );
        return forkJoin(followUpPages).pipe(
          map((pages) => [firstPage.articles, ...pages.map((page) => page.articles)].flat()),
        );
      }),
    );
  }

  private getPublishedArticlesPage(
    page: number,
    language: LanguageCode,
  ): Observable<SitemapArticleListDto> {
    return this.api.get<SitemapArticleListDto>('/api/articles', {
      page: String(page),
      pageSize: String(SITEMAP_ARTICLES_PAGE_SIZE),
      language,
    });
  }
}
