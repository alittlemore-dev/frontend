import {
  parseMarkdownWikiLinks,
  createMarkdownWikiLinkTargetLookup,
  type MarkdownWikiLinkRenderConfig,
  type MarkdownWikiLinkTargetLookup,
} from '@alittlemore.dev/design-system/markdown';
import { LanguageCode } from '../i18n/i18n.model';

export const WIKI_LINK_TARGET_TYPES = ['articles', 'matrix'] as const;

export type WikiLinkTargetType = (typeof WIKI_LINK_TARGET_TYPES)[number];

export interface WikiLink {
  type: WikiLinkTargetType;
  slug: string;
  label: string;
  raw: string;
}

export interface WikiLinkTargetGroup {
  type: WikiLinkTargetType;
  items: WikiLinkTarget[];
}

export interface WikiLinkTarget {
  slug: string;
  title: string;
  publishStatus: 'Draft' | 'Published';
}

export type WikiLinkTargetLookup = MarkdownWikiLinkTargetLookup;

export interface WikiLinkTargetRegistry {
  groups: readonly WikiLinkTargetGroup[];
  lookup: WikiLinkTargetLookup;
}

const WIKI_LINK_PATTERN =
  /\[\[(articles|matrix):([a-z0-9]+(?:-[a-z0-9]+)*)(?:\\?\|([^\]\n]+))?\]\]/g;
export function parseWikiLinks(markdown: string): WikiLink[] {
  return parseMarkdownWikiLinks(markdown)
    .filter(
      (link) => isWikiLinkTargetType(link.namespace) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(link.key),
    )
    .map((link) => ({
      type: link.namespace as WikiLinkTargetType,
      slug: link.key,
      label: link.label,
      raw: link.raw,
    }));
}

export function createWikiLinkTargetLookup(
  targets: readonly WikiLinkTargetGroup[],
): WikiLinkTargetLookup {
  return createMarkdownWikiLinkTargetLookup(
    targets.map((group) => ({
      namespace: group.type,
      targets: group.items.map((item) => ({
        key: item.slug,
        label: item.title,
        description: null,
        badge: item.publishStatus,
      })),
    })),
  );
}

export function createWikiLinkTargetRegistry(
  groups: readonly WikiLinkTargetGroup[],
): WikiLinkTargetRegistry {
  return {
    groups,
    lookup: createWikiLinkTargetLookup(groups),
  };
}

export function findMissingWikiLinkTargets(params: {
  markdown: string;
  availableTargets: WikiLinkTargetLookup;
}): string[] {
  const missing = new Set<string>();
  for (const link of parseWikiLinks(params.markdown)) {
    if (!params.availableTargets.get(link.type)?.has(link.slug)) {
      missing.add(`${link.type}:${link.slug}`);
    }
  }
  return Array.from(missing);
}

export function applicationWikiLinks(language: LanguageCode): MarkdownWikiLinkRenderConfig {
  return {
    namespaces: WIKI_LINK_TARGET_TYPES.map((key) => ({ key, label: key })),
    resolve: ({ namespace, key }) =>
      isWikiLinkTargetType(namespace) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key)
        ? { href: wikiLinkPath(namespace, key, language), openIn: 'same-tab' }
        : null,
  };
}

function isWikiLinkTargetType(value: string): value is WikiLinkTargetType {
  return value === 'articles' || value === 'matrix';
}

export function replaceWikiLinksWithPlainText(markdown: string): string {
  return markdown.replace(
    WIKI_LINK_PATTERN,
    (_raw, _type: WikiLinkTargetType, slug: string, label?: string) => label?.trim() || slug,
  );
}

export function wikiLinkPath(
  type: WikiLinkTargetType,
  slug: string,
  language: LanguageCode,
): string {
  if (type === 'articles') {
    return `/${language}/competency/articles/${slug}`;
  }
  return `/${language}/competency/matrix/questions/${slug}`;
}
