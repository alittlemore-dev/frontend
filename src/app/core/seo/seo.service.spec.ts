import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { provideI18nTesting } from '../../testing/i18n-testing';
import { SeoService } from './seo.service';

describe('SeoService', () => {
  let service: SeoService;
  let titleService: Title;
  let metaService: Meta;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()],
    });
    service = TestBed.inject(SeoService);
    titleService = TestBed.inject(Title);
    metaService = TestBed.inject(Meta);
  });

  it('setMeta() sets document title using Title service', () => {
    service.setMeta({ title: 'Как устроен сайт', description: 'Описание страницы.' });

    expect(titleService.getTitle()).toBe('Как устроен сайт');
  });

  it('setMeta() sets og:title meta tag', () => {
    service.setMeta({ title: 'Матрица компетенций', description: 'Матрица компетенций.' });

    const tag = metaService.getTag('property="og:title"');
    expect(tag?.content).toBe('Матрица компетенций');
  });

  it('setMeta() sets twitter:title without a site-name suffix', () => {
    service.setMeta({ title: 'Матрица компетенций', description: 'Матрица компетенций.' });

    const tag = metaService.getTag('name="twitter:title"');
    expect(tag?.content).toBe('Матрица компетенций');
  });

  it('setMeta() keeps the localized site name in og:site_name', () => {
    service.setMeta({ title: 'Матрица компетенций', description: 'Матрица компетенций.' });

    const tag = metaService.getTag('property="og:site_name"');
    expect(tag?.content).toBe('Мой сайт');
  });

  it('setMeta() sets description meta tag', () => {
    const description = 'Инженерный разбор устройства сайта.';
    service.setMeta({ title: 'Как устроен сайт', description });

    const tag = metaService.getTag('name="description"');
    expect(tag?.content).toBe(description);
  });

  it('setMeta() creates canonical link from canonical path', () => {
    service.setMeta({
      title: 'Как устроен сайт',
      description: 'Описание страницы.',
      canonicalPath: '/ru/how-this-site-is-built',
    });

    const link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    expect(link?.href).toBe('http://localhost:4200/ru/how-this-site-is-built');
  });

  it('setMeta() removes stale canonical link when canonical is not provided', () => {
    service.setMeta({
      title: 'Как устроен сайт',
      description: 'Описание страницы.',
      canonicalPath: '/how-this-site-is-built',
    });

    service.setMeta({ title: '404', description: 'Страница не найдена.' });

    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
  });

  it('setMeta() writes language alternates', () => {
    service.setMeta({
      title: 'Typed articles',
      description: 'Description.',
      canonicalPath: '/ru/articles/typed-articles',
      alternates: [
        { language: 'ru', path: '/ru/articles/typed-articles' },
        { language: 'en', path: '/en/articles/typed-articles' },
      ],
    });

    const links = Array.from(
      document.head.querySelectorAll<HTMLLinkElement>('link[rel="alternate"][hreflang]'),
    );

    expect(links.map((link) => [link.hreflang, link.href])).toEqual([
      ['ru', 'http://localhost:4200/ru/articles/typed-articles'],
      ['en', 'http://localhost:4200/en/articles/typed-articles'],
    ]);
  });

  it('setMeta() writes JSON-LD structured data and removes stale data', () => {
    service.setMeta({
      title: 'Typed articles',
      description: 'Description.',
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: 'Typed articles',
      },
    });

    const script = document.head.querySelector<HTMLScriptElement>(
      'script[type="application/ld+json"]',
    );
    expect(script?.textContent).toContain('"@type":"BlogPosting"');

    service.setMeta({ title: '404', description: 'Not found.' });

    expect(document.head.querySelector('script[type="application/ld+json"]')).toBeNull();
  });

  it('setMeta() escapes JSON-LD so user content cannot close the script element', () => {
    service.setMeta({
      title: 'Typed articles',
      description: 'Description.',
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: '</script><script>alert(1)</script>',
      },
    });

    const script = document.head.querySelector<HTMLScriptElement>(
      'script[type="application/ld+json"]',
    );

    expect(script?.textContent).toContain(
      '"headline":"\\u003C/script\\u003E\\u003Cscript\\u003Ealert(1)\\u003C/script\\u003E"',
    );
    expect(document.head.innerHTML).not.toContain('</script><script>alert(1)</script>');
  });

  it('setMeta() can mark a page as noindex', () => {
    service.setMeta({ title: '404', description: 'Not found.', robots: 'noindex, follow' });

    expect(metaService.getTag('name="robots"')?.content).toBe('noindex, follow');
  });
});
