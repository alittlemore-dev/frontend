export type PublicSeoLanguage = 'ru' | 'en';
export type PublicArticleLanguage = PublicSeoLanguage;

export interface PublicArticleRoute {
  language: PublicArticleLanguage;
  slug: string;
}

export interface PublicSeoArticleRoute extends PublicArticleRoute {
  kind: 'article';
}

export interface PublicMatrixQuestionRoute {
  kind: 'matrixQuestion';
  language: PublicSeoLanguage;
  slug: string;
}

export type PublicSeoRoute = PublicSeoArticleRoute | PublicMatrixQuestionRoute;

const PUBLIC_ARTICLE_PATH_PATTERN = /^\/(ru|en)\/articles\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/;
const PUBLIC_MATRIX_QUESTION_PATH_PATTERN =
  /^\/(ru|en)\/competency-matrix\/questions\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/;

export function parsePublicSeoPath(pathname: string): PublicSeoRoute | null {
  const articleRoute = parsePublicArticlePath(pathname);
  if (articleRoute !== null) {
    return { kind: 'article', ...articleRoute };
  }

  const matrixMatch = PUBLIC_MATRIX_QUESTION_PATH_PATTERN.exec(pathname);
  if (!matrixMatch) return null;
  return {
    kind: 'matrixQuestion',
    language: matrixMatch[1] as PublicSeoLanguage,
    slug: matrixMatch[2],
  };
}

export function parsePublicArticlePath(pathname: string): PublicArticleRoute | null {
  const match = PUBLIC_ARTICLE_PATH_PATTERN.exec(pathname);
  if (!match) return null;
  return {
    language: match[1] as PublicArticleLanguage,
    slug: match[2],
  };
}

export function buildPublicSeoApiUrl(apiOrigin: string, route: PublicSeoRoute): URL {
  if (route.kind === 'article') {
    return buildPublicArticleApiUrl(apiOrigin, route);
  }

  const url = new URL(`/api/competency-matrix/items/public/${route.slug}`, apiOrigin);
  url.searchParams.set('language', route.language);
  return url;
}

export function buildPublicArticleApiUrl(apiOrigin: string, route: PublicArticleRoute): URL {
  const url = new URL(`/api/articles/detail/${route.slug}`, apiOrigin);
  url.searchParams.set('language', route.language);
  return url;
}

export function buildPublicNotFoundHtml(publicOrigin: string, route: PublicSeoRoute): string {
  const canonicalUrl = new URL(canonicalPath(route), publicOrigin).toString();
  const title = route.kind === 'article' ? 'Article not found' : 'Matrix question not found';
  return `<!doctype html>
<html lang="${route.language}">
  <head>
    <meta charset="utf-8">
    <title>${title}</title>
    <meta name="robots" content="noindex, follow">
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  </head>
  <body>
    <main>
      <h1>${title}</h1>
    </main>
  </body>
</html>`;
}

export function buildArticleNotFoundHtml(publicOrigin: string, route: PublicArticleRoute): string {
  return buildPublicNotFoundHtml(publicOrigin, { kind: 'article', ...route });
}

export function normalizeOrigin(value: string, name: string): string {
  const origin = new URL(value).origin;
  if (origin !== value.replace(/\/$/, '')) {
    throw new Error(`${name} must be an origin without a path.`);
  }
  return origin;
}

function canonicalPath(route: PublicSeoRoute): string {
  if (route.kind === 'article') {
    return `/${route.language}/articles/${route.slug}`;
  }
  return `/${route.language}/competency-matrix/questions/${route.slug}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
