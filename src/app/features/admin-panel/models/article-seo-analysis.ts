import { LanguageCode } from '../../../core/i18n/i18n.model';
import { replaceWikiLinksWithPlainText } from '../../../core/wiki-links/wiki-links';
import { ArticleTag } from './article-workspace.model';

export type ArticleSeoStatus = 'good' | 'warning' | 'missing';

export type ArticleSeoCheckId =
  | 'title-present'
  | 'title-length'
  | 'seo-title'
  | 'seo-description'
  | 'cover-image'
  | 'cover-image-alt'
  | 'content-present'
  | 'description-quality'
  | 'slug-present'
  | 'slug-format'
  | 'single-h1'
  | 'content-length'
  | 'tags'
  | 'wiki-links';

export interface ArticleSeoRules {
  titleMinLength: number;
  titleMaxLength: number;
  descriptionMinLength: number;
  descriptionMaxLength: number;
  coverAltMinLength: number;
  coverAltMaxLength: number;
  contentMinWords: number;
  slugPattern: RegExp;
  canonicalPathPrefix: string;
}

export interface ArticleSeoInput {
  slug: string;
  title: string;
  content: string;
  seoTitle: string | null;
  seoDescription: string | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  missingWikiLinkTargets: readonly string[];
  folder: string;
  tags: ArticleTag[];
  language: LanguageCode;
}

export interface ArticleSeoCheck {
  id: ArticleSeoCheckId;
  status: ArticleSeoStatus;
  titleKey: string;
  messageKey: string;
  messageParams?: Record<string, string | number>;
}

export interface ArticleSeoAnalysis {
  overallStatus: ArticleSeoStatus;
  canonicalPath: string;
  descriptionPreview: string;
  goodCount: number;
  warningCount: number;
  missingCount: number;
  checks: ArticleSeoCheck[];
}

export const ARTICLE_SEO_ANALYSIS_RULES: ArticleSeoRules = {
  titleMinLength: 20,
  titleMaxLength: 70,
  descriptionMinLength: 70,
  descriptionMaxLength: 160,
  coverAltMinLength: 5,
  coverAltMaxLength: 125,
  contentMinWords: 20,
  slugPattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  canonicalPathPrefix: '/articles',
};

export function analyzeArticleSeo(params: {
  input: ArticleSeoInput;
  rules: ArticleSeoRules;
}): ArticleSeoAnalysis {
  const title = params.input.title.trim();
  const seoTitle = params.input.seoTitle?.trim() ?? '';
  const seoDescription = params.input.seoDescription?.trim() ?? '';
  const coverImageUrl = params.input.coverImageUrl?.trim() ?? '';
  const coverImageAlt = params.input.coverImageAlt?.trim() ?? '';
  const content = params.input.content.trim();
  const slug = params.input.slug.trim();
  const plainContent = markdownToPlainText(content);
  const wordCount = countWords(plainContent);
  const descriptionPreview = truncateDescription({
    value: plainContent,
    maxLength: params.rules.descriptionMaxLength,
  });
  const checks: ArticleSeoCheck[] = [
    buildCheck({
      id: 'title-present',
      status: title ? 'good' : 'missing',
      messageParams: {},
    }),
    buildCheck({
      id: 'title-length',
      status: titleLengthStatus({
        title,
        minLength: params.rules.titleMinLength,
        maxLength: params.rules.titleMaxLength,
      }),
      messageParams: {
        min: params.rules.titleMinLength,
        max: params.rules.titleMaxLength,
        count: title.length,
      },
    }),
    buildCheck({
      id: 'seo-title',
      status: textRangeStatus({
        value: seoTitle,
        minLength: params.rules.titleMinLength,
        maxLength: params.rules.titleMaxLength,
      }),
      messageParams: {
        min: params.rules.titleMinLength,
        max: params.rules.titleMaxLength,
        count: seoTitle.length,
      },
    }),
    buildCheck({
      id: 'seo-description',
      status: textRangeStatus({
        value: seoDescription,
        minLength: params.rules.descriptionMinLength,
        maxLength: params.rules.descriptionMaxLength,
      }),
      messageParams: {
        min: params.rules.descriptionMinLength,
        max: params.rules.descriptionMaxLength,
        count: seoDescription.length,
      },
    }),
    buildCheck({
      id: 'cover-image',
      status: coverImageUrl ? 'good' : 'missing',
      messageParams: {},
    }),
    buildCheck({
      id: 'cover-image-alt',
      status: textRangeStatus({
        value: coverImageAlt,
        minLength: params.rules.coverAltMinLength,
        maxLength: params.rules.coverAltMaxLength,
      }),
      messageParams: {
        min: params.rules.coverAltMinLength,
        max: params.rules.coverAltMaxLength,
        count: coverImageAlt.length,
      },
    }),
    buildCheck({
      id: 'content-present',
      status: content ? 'good' : 'missing',
      messageParams: {},
    }),
    buildCheck({
      id: 'description-quality',
      status: descriptionStatus({
        description: descriptionPreview,
        content,
        minLength: params.rules.descriptionMinLength,
      }),
      messageParams: {
        min: params.rules.descriptionMinLength,
        count: descriptionPreview.length,
      },
    }),
    buildCheck({
      id: 'slug-present',
      status: slug ? 'good' : 'missing',
      messageParams: {},
    }),
    buildCheck({
      id: 'slug-format',
      status: slugFormatStatus({ slug, pattern: params.rules.slugPattern }),
      messageParams: {},
    }),
    buildCheck({
      id: 'single-h1',
      status: hasMarkdownH1(content) ? 'warning' : 'good',
      messageParams: {},
    }),
    buildCheck({
      id: 'content-length',
      status: contentLengthStatus({
        content,
        wordCount,
        minWords: params.rules.contentMinWords,
      }),
      messageParams: {
        min: params.rules.contentMinWords,
        count: wordCount,
      },
    }),
    buildCheck({
      id: 'tags',
      status: params.input.tags.length > 0 ? 'good' : 'warning',
      messageParams: {},
    }),
    buildCheck({
      id: 'wiki-links',
      status: params.input.missingWikiLinkTargets.length === 0 ? 'good' : 'warning',
      messageParams: {
        targets: params.input.missingWikiLinkTargets.join(', '),
      },
    }),
  ];
  return {
    overallStatus: overallStatus(checks),
    canonicalPath: `${params.rules.canonicalPathPrefix}/${slug}`,
    descriptionPreview,
    goodCount: checks.filter((check) => check.status === 'good').length,
    warningCount: checks.filter((check) => check.status === 'warning').length,
    missingCount: checks.filter((check) => check.status === 'missing').length,
    checks,
  };
}

function buildCheck(params: {
  id: ArticleSeoCheckId;
  status: ArticleSeoStatus;
  messageParams: Record<string, string | number>;
}): ArticleSeoCheck {
  const baseKey = articleSeoCheckKey(params.id);
  return {
    id: params.id,
    status: params.status,
    titleKey: `articles.seoAnalysis.check.${baseKey}`,
    messageKey: `articles.seoAnalysis.message.${baseKey}.${params.status}`,
    messageParams: params.messageParams,
  };
}

function articleSeoCheckKey(id: ArticleSeoCheckId): string {
  const [first, ...parts] = id.split('-');
  return `${first}${parts.map((part) => part[0].toUpperCase() + part.slice(1)).join('')}`;
}

function titleLengthStatus(params: {
  title: string;
  minLength: number;
  maxLength: number;
}): ArticleSeoStatus {
  if (!params.title) return 'missing';
  if (params.title.length < params.minLength || params.title.length > params.maxLength) {
    return 'warning';
  }
  return 'good';
}

function textRangeStatus(params: {
  value: string;
  minLength: number;
  maxLength: number;
}): ArticleSeoStatus {
  if (!params.value) return 'missing';
  if (params.value.length < params.minLength || params.value.length > params.maxLength) {
    return 'warning';
  }
  return 'good';
}

function descriptionStatus(params: {
  description: string;
  content: string;
  minLength: number;
}): ArticleSeoStatus {
  if (!params.content) return 'missing';
  return params.description.length >= params.minLength ? 'good' : 'warning';
}

function slugFormatStatus(params: { slug: string; pattern: RegExp }): ArticleSeoStatus {
  if (!params.slug) return 'missing';
  return params.pattern.test(params.slug) ? 'good' : 'warning';
}

function contentLengthStatus(params: {
  content: string;
  wordCount: number;
  minWords: number;
}): ArticleSeoStatus {
  if (!params.content) return 'missing';
  return params.wordCount >= params.minWords ? 'good' : 'warning';
}

function overallStatus(checks: ArticleSeoCheck[]): ArticleSeoStatus {
  if (checks.some((check) => check.status === 'missing')) return 'missing';
  if (checks.some((check) => check.status === 'warning')) return 'warning';
  return 'good';
}

function markdownToPlainText(markdown: string): string {
  return replaceWikiLinksWithPlainText(markdown)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateDescription(params: { value: string; maxLength: number }): string {
  if (params.value.length <= params.maxLength) return params.value;
  return params.value
    .slice(0, params.maxLength)
    .replace(/\s+\S*$/, '')
    .trim();
}

function countWords(value: string): number {
  return value.split(/\s+/).filter((word) => word.trim().length > 0).length;
}

function hasMarkdownH1(markdown: string): boolean {
  return /^#(?!#)\s+\S/m.test(markdown);
}
