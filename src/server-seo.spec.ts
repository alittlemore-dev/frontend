import { buildPublicNotFoundHtml, buildPublicSeoApiUrl, parsePublicSeoPath } from './server-seo';

describe('server SEO helpers', () => {
  it('parses language-prefixed public SEO URLs', () => {
    expect(parsePublicSeoPath('/ru/articles/typed-articles')).toEqual({
      kind: 'article',
      language: 'ru',
      slug: 'typed-articles',
    });
    expect(parsePublicSeoPath('/en/articles/angular-ssr')).toEqual({
      kind: 'article',
      language: 'en',
      slug: 'angular-ssr',
    });
    expect(parsePublicSeoPath('/ru/competency-matrix/questions/how-to-write-function')).toEqual({
      kind: 'matrixQuestion',
      language: 'ru',
      slug: 'how-to-write-function',
    });
  });

  it('ignores non-public SEO URLs', () => {
    expect(parsePublicSeoPath('/articles/typed-articles')).toBeNull();
    expect(parsePublicSeoPath('/ru/articles')).toBeNull();
    expect(parsePublicSeoPath('/ru/competency-matrix')).toBeNull();
    expect(parsePublicSeoPath('/ru/admin/articles/typed-articles')).toBeNull();
    expect(parsePublicSeoPath('/de/articles/typed-articles')).toBeNull();
    expect(parsePublicSeoPath('/en/competency-matrix/questions/InvalidSlug')).toBeNull();
  });

  it('builds public article API URL with explicit language only', () => {
    const url = buildPublicSeoApiUrl('https://api.example.com', {
      kind: 'article',
      language: 'ru',
      slug: 'typed-articles',
    });

    expect(url.toString()).toBe(
      'https://api.example.com/api/articles/detail/typed-articles?language=ru',
    );
  });

  it('builds public matrix question API URL with explicit language', () => {
    const url = buildPublicSeoApiUrl('https://api.example.com', {
      kind: 'matrixQuestion',
      language: 'en',
      slug: 'how-to-write-function',
    });

    expect(url.toString()).toBe(
      'https://api.example.com/api/competency-matrix/items/public/how-to-write-function?language=en',
    );
  });

  it('builds noindex HTML for missing public SEO URLs', () => {
    const articleHtml = buildPublicNotFoundHtml('https://example.com', {
      kind: 'article',
      language: 'en',
      slug: 'missing-article',
    });
    const matrixHtml = buildPublicNotFoundHtml('https://example.com', {
      kind: 'matrixQuestion',
      language: 'ru',
      slug: 'missing-question',
    });

    expect(articleHtml).toContain('<title>Article not found</title>');
    expect(articleHtml).toContain('<meta name="robots" content="noindex, follow">');
    expect(articleHtml).toContain(
      '<link rel="canonical" href="https://example.com/en/articles/missing-article">',
    );
    expect(matrixHtml).toContain('<title>Matrix question not found</title>');
    expect(matrixHtml).toContain('<meta name="robots" content="noindex, follow">');
    expect(matrixHtml).toContain(
      '<link rel="canonical" href="https://example.com/ru/competency-matrix/questions/missing-question">',
    );
  });
});
