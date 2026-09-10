import { Injectable, inject } from '@angular/core';
import { Observable, map, of, switchMap } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import { LanguageCode } from '../../../core/i18n/i18n.model';
import {
  ArticleDetail,
  ArticleDetailDto,
  ArticleList,
  ArticleListDto,
  ArticleListParams,
  ArticlePublicStats,
  ArticlePublicStatsCollectionDto,
  ArticleReactionPayload,
  ArticleTag,
  ArticleTree,
  ArticleTreeDto,
  TagsDto,
  mapArticleDetailDto,
  mapArticleListDto,
  mapArticleTreeDto,
  mapPublicStatsCollectionDto,
  mapTagDto,
} from '../models/articles.model';

type PublicArticleListParams = Omit<ArticleListParams, 'onlyPublished'>;

@Injectable({ providedIn: 'root' })
export class ArticlesService {
  private readonly api = inject(ApiClient);

  getPublicArticles(params: PublicArticleListParams): Observable<ArticleList> {
    const queryParams: Record<string, string | readonly string[]> = {
      page: String(params.page),
      pageSize: String(params.pageSize),
      language: params.language,
    };
    this.applyOptionalListParams(queryParams, params);
    return this.getArticlesFromPath('/api/articles', queryParams);
  }

  private applyOptionalListParams(
    queryParams: Record<string, string | readonly string[]>,
    params: PublicArticleListParams,
  ): void {
    if (params.tagSlug) {
      queryParams['tagSlug'] = params.tagSlug;
    }
    if (params.publishedFrom) {
      queryParams['publishedFrom'] = params.publishedFrom;
    }
    if (params.publishedTo) {
      queryParams['publishedTo'] = params.publishedTo;
    }
    if (params.searchQuery) {
      queryParams['searchQuery'] = params.searchQuery;
    }
  }

  private getArticlesFromPath(
    path: string,
    queryParams: Record<string, string | readonly string[]>,
  ): Observable<ArticleList> {
    return this.api.get<ArticleListDto>(path, queryParams).pipe(
      switchMap((dto) => {
        const articleIds = dto.articles.map((article) => article.id);
        if (articleIds.length === 0) {
          return of(mapArticleListDto(dto, new Map<string, ArticlePublicStats>()));
        }
        return this.getPublicStats(articleIds).pipe(
          map((statsByArticleId) => mapArticleListDto(dto, statsByArticleId)),
        );
      }),
    );
  }

  getPublicArticle(slug: string, language: LanguageCode): Observable<ArticleDetail> {
    return this.api
      .get<ArticleDetailDto>(`/api/articles/detail/${slug}`, { language })
      .pipe(switchMap((dto) => this.mapDetailWithPublicStats(dto)));
  }

  trackPublicView(slug: string, language: LanguageCode): Observable<void> {
    return this.api.post<void>(`/api/articles/detail/${slug}/analytics/view`, {}, { language });
  }

  trackPublicEngagedView(slug: string, language: LanguageCode): Observable<void> {
    return this.api.post<void>(
      `/api/articles/detail/${slug}/analytics/engaged-view`,
      {},
      { language },
    );
  }

  setPublicReaction(
    slug: string,
    payload: ArticleReactionPayload,
    language: LanguageCode,
  ): Observable<void> {
    return this.api.post<void>(`/api/articles/detail/${slug}/reaction`, payload, { language });
  }

  getPublicTree(language: LanguageCode): Observable<ArticleTree> {
    return this.api
      .get<ArticleTreeDto>('/api/articles/tree', { language })
      .pipe(map(mapArticleTreeDto));
  }

  getPublicTags(language: LanguageCode): Observable<ArticleTag[]> {
    return this.api
      .get<TagsDto>('/api/articles/tags', { language })
      .pipe(map((dto) => dto.tags.map(mapTagDto)));
  }

  private mapDetailWithPublicStats(dto: ArticleDetailDto): Observable<ArticleDetail> {
    return this.getPublicStats([dto.id]).pipe(
      map((statsByArticleId) => mapArticleDetailDto(dto, statsByArticleId)),
    );
  }

  private getPublicStats(
    articleIds: readonly string[],
  ): Observable<ReadonlyMap<string, ArticlePublicStats>> {
    return this.api
      .get<ArticlePublicStatsCollectionDto>('/api/articles/public-stats', { articleIds })
      .pipe(map(mapPublicStatsCollectionDto));
  }
}
