import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TransferState, makeStateKey } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiClient } from '../http/api-client.service';
import { I18nBundle, I18nBundleDto } from './i18n.model';
import { I18nService } from './i18n.service';

describe('I18nService bundle loading', () => {
  let service: I18nService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [ApiClient, I18nService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(I18nService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads only the shared bundle during startup', () => {
    service.initialize().subscribe();
    http
      .expectOne((request) => request.url.endsWith('/api/i18n/languages'))
      .flush({
        defaultLanguage: 'ru',
        languages: [
          { code: 'ru', label: 'Русский' },
          { code: 'en', label: 'English' },
        ],
      });
    http
      .expectOne((request) => request.url.endsWith('/api/i18n/bundles/shared/ru'))
      .flush({
        bundle: 'shared',
        language: 'ru',
        messages: { 'shared.save': 'Сохранить' },
      });

    http.expectNone((request) => request.url.includes('how-this-site-is-built'));
    expect(service.translate('shared.save')).toBe('Сохранить');
  });

  it('replaces the active feature bundle without leaking previous feature messages', () => {
    initializeRussian();

    service.activateBundle(I18nBundle.Articles).subscribe();
    http
      .expectOne((request) => request.url.endsWith('/api/i18n/bundles/articles/ru'))
      .flush({
        bundle: 'articles',
        language: 'ru',
        messages: { 'articles.title': 'Статьи' },
      });
    expect(service.translate('articles.title')).toBe('Статьи');

    service.activateBundle(I18nBundle.HowThisSiteIsBuilt).subscribe();
    http
      .expectOne((request) => request.url.endsWith('/api/i18n/bundles/how-this-site-is-built/ru'))
      .flush({
        bundle: 'how-this-site-is-built',
        language: 'ru',
        messages: { 'siteBuild.hero.title': 'Как устроен этот сайт' },
      });

    expect(service.translate('articles.title')).toBe('articles.title');
    expect(service.translate('siteBuild.hero.title')).toBe('Как устроен этот сайт');
  });

  it('switches shared and active feature bundles atomically', () => {
    initializeRussian();
    service.activateBundle(I18nBundle.Articles).subscribe();
    http
      .expectOne((request) => request.url.endsWith('/api/i18n/bundles/articles/ru'))
      .flush({
        bundle: 'articles',
        language: 'ru',
        messages: { 'articles.title': 'Статьи' },
      });

    service.switchLanguage('en').subscribe();
    http
      .expectOne((request) => request.url.endsWith('/api/i18n/bundles/shared/en'))
      .flush({
        bundle: 'shared',
        language: 'en',
        messages: { 'shared.save': 'Save' },
      });
    expect(service.language()).toBe('ru');
    expect(service.translate('articles.title')).toBe('Статьи');
    http
      .expectOne((request) => request.url.endsWith('/api/i18n/bundles/articles/en'))
      .flush({
        bundle: 'articles',
        language: 'en',
        messages: { 'articles.title': 'Articles' },
      });

    expect(service.language()).toBe('en');
    expect(service.translate('shared.save')).toBe('Save');
    expect(service.translate('articles.title')).toBe('Articles');
  });

  it('keeps the previous language when one required bundle fails', () => {
    initializeRussian();
    service.activateBundle(I18nBundle.Articles).subscribe();
    http
      .expectOne((request) => request.url.endsWith('/api/i18n/bundles/articles/ru'))
      .flush({
        bundle: 'articles',
        language: 'ru',
        messages: { 'articles.title': 'Статьи' },
      });

    const error = jest.fn();
    service.switchLanguage('en').subscribe({ error });
    http
      .expectOne((request) => request.url.endsWith('/api/i18n/bundles/shared/en'))
      .flush({
        bundle: 'shared',
        language: 'en',
        messages: { 'shared.save': 'Save' },
      });
    http
      .expectOne((request) => request.url.endsWith('/api/i18n/bundles/articles/en'))
      .flush({}, { status: 503, statusText: 'Unavailable' });

    expect(error).toHaveBeenCalled();
    expect(service.language()).toBe('ru');
    expect(service.translate('articles.title')).toBe('Статьи');
  });

  it('loads shared and active feature bundles for alternate-language preview', () => {
    initializeRussian();
    service.activateBundle(I18nBundle.Articles).subscribe();
    http
      .expectOne((request) => request.url.endsWith('/api/i18n/bundles/articles/ru'))
      .flush({
        bundle: 'articles',
        language: 'ru',
        messages: { 'articles.title': 'Статьи' },
      });

    service.ensureLanguageBundle('en').subscribe();
    http
      .expectOne((request) => request.url.endsWith('/api/i18n/bundles/shared/en'))
      .flush({
        bundle: 'shared',
        language: 'en',
        messages: { 'shared.save': 'Save' },
      });
    http
      .expectOne((request) => request.url.endsWith('/api/i18n/bundles/articles/en'))
      .flush({
        bundle: 'articles',
        language: 'en',
        messages: { 'articles.title': 'Articles' },
      });

    expect(service.translateForLanguage('en', 'articles.title')).toBe('Articles');
    expect(service.language()).toBe('ru');
    expect(service.translate('articles.title')).toBe('Статьи');
  });

  it('retries the current active bundle after a route localization failure', () => {
    initializeRussian();
    service.activateBundle(I18nBundle.Articles).subscribe();
    http
      .expectOne((request) => request.url.endsWith('/api/i18n/bundles/articles/ru'))
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect(service.startupError()).toBe(true);
    TestBed.inject(TransferState).remove(makeStateKey('i18n.languages'));

    service.retryStartup().subscribe();
    http.expectNone((request) => request.url.endsWith('/api/i18n/languages'));
    http
      .expectOne((request) => request.url.endsWith('/api/i18n/bundles/articles/ru'))
      .flush({
        bundle: 'articles',
        language: 'ru',
        messages: { 'articles.title': 'Статьи' },
      });

    expect(service.startupError()).toBe(false);
    expect(service.translate('articles.title')).toBe('Статьи');
  });

  it('keeps initial navigation alive and retries its active bundle after startup failure', () => {
    service.initialize().subscribe();
    http
      .expectOne((request) => request.url.endsWith('/api/i18n/languages'))
      .flush({}, { status: 503, statusText: 'Unavailable' });

    const resolverError = jest.fn();
    const resolverComplete = jest.fn();
    service.activateBundle(I18nBundle.Articles).subscribe({
      error: resolverError,
      complete: resolverComplete,
    });

    expect(resolverError).not.toHaveBeenCalled();
    expect(resolverComplete).toHaveBeenCalled();
    expect(service.startupError()).toBe(true);

    service.retryStartup().subscribe();
    http
      .expectOne((request) => request.url.endsWith('/api/i18n/languages'))
      .flush({
        defaultLanguage: 'ru',
        languages: [
          { code: 'ru', label: 'Русский' },
          { code: 'en', label: 'English' },
        ],
      });
    http
      .expectOne((request) => request.url.endsWith('/api/i18n/bundles/shared/ru'))
      .flush({
        bundle: 'shared',
        language: 'ru',
        messages: { 'shared.save': 'Сохранить' },
      });
    http
      .expectOne((request) => request.url.endsWith('/api/i18n/bundles/articles/ru'))
      .flush({
        bundle: 'articles',
        language: 'ru',
        messages: { 'articles.title': 'Статьи' },
      });

    expect(service.startupError()).toBe(false);
    expect(service.translate('articles.title')).toBe('Статьи');
  });

  it('keeps the startup error visible when a transferred startup bundle fails', () => {
    const transferState = TestBed.inject(TransferState);
    transferState.set(makeStateKey('i18n.languages'), {
      defaultLanguage: 'ru',
      languages: [
        { code: 'ru', label: 'Русский' },
        { code: 'en', label: 'English' },
      ],
    });
    service.startupError.set(true);

    const error = jest.fn();
    service.initialize().subscribe({ error });
    http
      .expectOne((request) => request.url.endsWith('/api/i18n/bundles/shared/ru'))
      .flush({}, { status: 503, statusText: 'Unavailable' });

    expect(error).not.toHaveBeenCalled();
    expect(service.startupError()).toBe(true);
  });

  it.each([
    ['bundle', { bundle: 'updates', language: 'ru' }],
    ['language', { bundle: 'shared', language: 'en' }],
  ] as const)('rejects a response with a mismatched %s', (_field, identity) => {
    const error = jest.fn();
    service.initialize().subscribe({ error });
    http
      .expectOne((request) => request.url.endsWith('/api/i18n/languages'))
      .flush({
        defaultLanguage: 'ru',
        languages: [
          { code: 'ru', label: 'Русский' },
          { code: 'en', label: 'English' },
        ],
      });
    http
      .expectOne((request) => request.url.endsWith('/api/i18n/bundles/shared/ru'))
      .flush({ ...identity, messages: { 'shared.save': 'Сохранить' } });

    expect(error).not.toHaveBeenCalled();
    expect(service.startupError()).toBe(true);
    expect(service.language()).toBeNull();
    expect(service.translate('shared.save')).toBe('shared.save');
  });

  it('uses transferred state keyed by bundle and language', () => {
    const transferState = TestBed.inject(TransferState);
    const document = TestBed.inject(DOCUMENT);
    transferState.set(makeStateKey<I18nBundleDto | null>('i18n.bundle.shared.ru'), {
      bundle: I18nBundle.Shared,
      language: 'ru',
      messages: { 'shared.save': 'Сохранить' },
    });
    document.defaultView?.history.replaceState({}, '', '/ru/how-this-site-is-built');

    service.languages.set([
      { code: 'ru', label: 'Русский' },
      { code: 'en', label: 'English' },
    ]);
    service.switchLanguage('ru').subscribe();

    http.expectNone((request) => request.url.includes('/api/i18n/bundles/'));
    expect(service.translate('shared.save')).toBe('Сохранить');
  });

  function initializeRussian(): void {
    service.initialize().subscribe();
    http
      .expectOne((request) => request.url.endsWith('/api/i18n/languages'))
      .flush({
        defaultLanguage: 'ru',
        languages: [
          { code: 'ru', label: 'Русский' },
          { code: 'en', label: 'English' },
        ],
      });
    http
      .expectOne((request) => request.url.endsWith('/api/i18n/bundles/shared/ru'))
      .flush({
        bundle: 'shared',
        language: 'ru',
        messages: { 'shared.save': 'Сохранить' },
      });
  }
});
