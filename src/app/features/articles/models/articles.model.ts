import { LanguageCode } from '../../../core/i18n/i18n.model';

export type ArticlePublishStatus = 'Draft' | 'Published';
export type ArticleReactionKind = 'heart' | 'fire' | 'thinking' | 'neutral' | 'poop';

export interface ArticleReactionCountsDto {
  heart: number;
  fire: number;
  thinking: number;
  neutral: number;
  poop: number;
}

export interface ArticleTranslationDto {
  title: string;
  content: string;
}

export interface ArticleTranslationsDto {
  ru: ArticleTranslationDto;
  en: ArticleTranslationDto;
}

export interface ArticleTagTranslationDto {
  name: string;
}

export interface ArticleTagTranslationsDto {
  ru: ArticleTagTranslationDto;
  en: ArticleTagTranslationDto;
}

export interface ArticleTagDto {
  id: string;
  name: string;
  slug: string;
  translations: ArticleTagTranslationsDto;
}

export interface ArticleMetadataDto {
  seoTitleRu: string | null;
  seoTitleEn: string | null;
  seoDescriptionRu: string | null;
  seoDescriptionEn: string | null;
  coverImageFileId: string | null;
  coverImageUrl: string | null;
  coverImageAltRu: string | null;
  coverImageAltEn: string | null;
}

export interface ArticleSummaryDto {
  id: string;
  title: string;
  slug: string;
  folder: string;
  folderId: string;
  folderKey: string;
  authorUsername: string;
  publishedAt: string | null;
  publishStatus: ArticlePublishStatus;
  updatedAt: string;
  excerpt: string;
  metadata: ArticleMetadataDto;
  tags: ArticleTagDto[];
}

export interface ArticleDetailDto extends ArticleSummaryDto {
  content: string;
  createdAt: string;
  translations: ArticleTranslationsDto;
}

export interface ArticleListDto {
  totalCount: number;
  totalPages: number;
  articles: ArticleSummaryDto[];
}

export interface ArticlePublicStatsDto {
  articleId: string;
  viewCount: number;
  reactionCounts: ArticleReactionCountsDto;
}

export interface ArticlePublicStatsCollectionDto {
  stats: ArticlePublicStatsDto[];
}

export interface ArticleTreeItemDto {
  title: string;
  slug: string;
  publishStatus: ArticlePublishStatus;
  publishedAt: string | null;
  updatedAt: string;
}

export interface ArticleTreeFolderDto {
  folderId: string;
  folderKey: string;
  folder: string;
  articles: ArticleTreeItemDto[];
}

export interface ArticleTreeDto {
  folders: ArticleTreeFolderDto[];
}

export interface TagsDto {
  tags: ArticleTagDto[];
}

export interface ArticleTag {
  id: string;
  name: string;
  slug: string;
  translations: ArticleTagTranslations;
}

export interface ArticleReactionCounts {
  heart: number;
  fire: number;
  thinking: number;
  neutral: number;
  poop: number;
}

export interface ArticleMetadata {
  seoTitleRu: string | null;
  seoTitleEn: string | null;
  seoDescriptionRu: string | null;
  seoDescriptionEn: string | null;
  coverImageFileId: string | null;
  coverImageUrl: string | null;
  coverImageAltRu: string | null;
  coverImageAltEn: string | null;
}

export interface ArticleSummary {
  id: string;
  title: string;
  slug: string;
  folder: string;
  folderId: string;
  folderKey: string;
  authorUsername: string;
  publishedAt: string | null;
  publishStatus: ArticlePublishStatus;
  updatedAt: string;
  excerpt: string;
  metadata: ArticleMetadata;
  viewCount: number;
  tags: ArticleTag[];
}

export interface ArticleDetail extends ArticleSummary {
  content: string;
  createdAt: string;
  reactionCounts: ArticleReactionCounts;
  translations: ArticleTranslations;
}

export interface ArticleList {
  totalCount: number;
  totalPages: number;
  articles: ArticleSummary[];
}

export interface ArticlePublicStats {
  articleId: string;
  viewCount: number;
  reactionCounts: ArticleReactionCounts;
}

export interface ArticleTreeItem {
  title: string;
  slug: string;
  publishStatus: ArticlePublishStatus;
  publishedAt: string | null;
  updatedAt: string;
}

export interface ArticleTreeFolder {
  folderId: string;
  folderKey: string;
  folder: string;
  articles: ArticleTreeItem[];
}

export interface ArticleTree {
  folders: ArticleTreeFolder[];
}

export interface ArticleTranslation {
  title: string;
  content: string;
}

export interface ArticleTranslations {
  ru: ArticleTranslation;
  en: ArticleTranslation;
}

export interface ArticleTagTranslation {
  name: string;
}

export interface ArticleTagTranslations {
  ru: ArticleTagTranslation;
  en: ArticleTagTranslation;
}

export interface ArticlePayload {
  slug: string;
  publishStatus: ArticlePublishStatus;
  tagIds: string[];
  metadata: ArticlePayloadMetadata;
  translations: ArticleTranslations;
}

export interface ArticlePayloadMetadata {
  seoTitleRu: string | null;
  seoTitleEn: string | null;
  seoDescriptionRu: string | null;
  seoDescriptionEn: string | null;
  coverImageFileId: string | null;
  coverImageAltRu: string | null;
  coverImageAltEn: string | null;
}

export interface TagPayload {
  slug: string;
  translations: ArticleTagTranslations;
}

export interface ArticleReactionPayload {
  reactionKind: ArticleReactionKind | null;
  clientToken: string;
}

export interface ArticleListParams {
  page: number;
  pageSize: number;
  language: LanguageCode;
  onlyPublished: boolean;
  tagSlug: string | null;
  publishedFrom: string | null;
  publishedTo: string | null;
  searchQuery: string | null;
}

export function mapTagDto(dto: ArticleTagDto): ArticleTag {
  return {
    id: dto.id,
    name: dto.name,
    slug: dto.slug,
    translations: dto.translations,
  };
}

export function mapArticleSummaryDto(
  dto: ArticleSummaryDto,
  statsByArticleId: ReadonlyMap<string, ArticlePublicStats>,
): ArticleSummary {
  const stats = getRequiredPublicStats(dto.id, statsByArticleId);
  return {
    id: dto.id,
    title: dto.title,
    slug: dto.slug,
    folder: dto.folder,
    folderId: dto.folderId,
    folderKey: dto.folderKey,
    authorUsername: dto.authorUsername,
    publishedAt: dto.publishedAt,
    publishStatus: dto.publishStatus,
    updatedAt: dto.updatedAt,
    excerpt: dto.excerpt,
    metadata: { ...dto.metadata },
    viewCount: stats.viewCount,
    tags: dto.tags.map(mapTagDto),
  };
}

export function mapArticleDetailDto(
  dto: ArticleDetailDto,
  statsByArticleId: ReadonlyMap<string, ArticlePublicStats>,
): ArticleDetail {
  const stats = getRequiredPublicStats(dto.id, statsByArticleId);
  return {
    ...mapArticleSummaryDto(dto, statsByArticleId),
    content: dto.content,
    createdAt: dto.createdAt,
    reactionCounts: stats.reactionCounts,
    translations: dto.translations,
  };
}

export function mapArticleListDto(
  dto: ArticleListDto,
  statsByArticleId: ReadonlyMap<string, ArticlePublicStats>,
): ArticleList {
  return {
    totalCount: dto.totalCount,
    totalPages: dto.totalPages,
    articles: dto.articles.map((article) => mapArticleSummaryDto(article, statsByArticleId)),
  };
}

export function mapArticleTreeDto(dto: ArticleTreeDto): ArticleTree {
  return {
    folders: dto.folders.map((folder) => ({
      folderId: folder.folderId,
      folderKey: folder.folderKey,
      folder: folder.folder,
      articles: folder.articles.map((article) => ({ ...article })),
    })),
  };
}

export function mapReactionCountsDto(dto: ArticleReactionCountsDto): ArticleReactionCounts {
  return {
    heart: dto.heart,
    fire: dto.fire,
    thinking: dto.thinking,
    neutral: dto.neutral,
    poop: dto.poop,
  };
}

export function mapPublicStatsCollectionDto(
  dto: ArticlePublicStatsCollectionDto,
): ReadonlyMap<string, ArticlePublicStats> {
  return new Map(
    dto.stats.map((stats) => [
      stats.articleId,
      {
        articleId: stats.articleId,
        viewCount: stats.viewCount,
        reactionCounts: mapReactionCountsDto(stats.reactionCounts),
      },
    ]),
  );
}

function getRequiredPublicStats(
  articleId: string,
  statsByArticleId: ReadonlyMap<string, ArticlePublicStats>,
): ArticlePublicStats {
  const stats = statsByArticleId.get(articleId);
  if (stats === undefined) {
    throw new Error(`Missing public stats for article ${articleId}`);
  }
  return stats;
}
