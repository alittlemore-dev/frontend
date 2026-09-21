import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TransferState, makeStateKey } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiClient } from '../http/api-client.service';
import { I18nBundle, I18nBundleDto, I18nLanguagesDto } from './i18n.model';
import { I18nService } from './i18n.service';

describe('I18nService', () => {
  let service: I18nService;
  let http: HttpTestingController;
  let transferState: TransferState;

  beforeEach(() => {
    localStorage.clear();
    history.replaceState({}, '', '/');
    TestBed.configureTestingModule({
      providers: [ApiClient, I18nService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(I18nService);
    http = TestBed.inject(HttpTestingController);
    transferState = TestBed.inject(TransferState);
  });

  afterEach(() => {
    http.verify();
    history.replaceState({}, '', '/');
  });

  it('loads languages before the shared bundle during startup', () => {
    service.initialize().subscribe();
    http.expectOne((request) => request.url.endsWith('/api/i18n/languages')).flush(languages());
    http
      .expectOne((request) => request.url.endsWith('/api/i18n/bundles/shared/ru'))
      .flush({
        bundle: I18nBundle.Shared,
        language: 'ru',
        messages: { greeting: 'Привет, {name}' },
      });

    expect(service.language()).toBe('ru');
    expect(service.translate('greeting', { name: 'Дима' })).toBe('Привет, Дима');
    expect(document.documentElement.lang).toBe('ru');
  });

  it('uses transferred startup state keyed by bundle and language', () => {
    const languagesKey = makeStateKey<I18nLanguagesDto | null>('i18n.languages');
    const bundleKey = makeStateKey<I18nBundleDto | null>('i18n.bundle.shared.ru');
    transferState.set(languagesKey, languages());
    transferState.set(bundleKey, {
      bundle: I18nBundle.Shared,
      language: 'ru',
      messages: { 'shell.nav.articles': 'Статьи' },
    });

    service.initialize().subscribe();

    http.expectNone((request) => request.url.includes('/api/i18n/'));
    expect(service.translate('shell.nav.articles')).toBe('Статьи');
    expect(transferState.hasKey(languagesKey)).toBe(false);
    expect(transferState.hasKey(bundleKey)).toBe(false);
  });

  it('uses the URL language prefix before the stored language', () => {
    history.replaceState({}, '', '/en/competency/articles/typed-articles');
    localStorage.setItem('chosenLanguage', 'ru');

    service.initialize().subscribe();
    http.expectOne((request) => request.url.endsWith('/api/i18n/languages')).flush(languages());
    http
      .expectOne((request) => request.url.endsWith('/api/i18n/bundles/shared/en'))
      .flush({ bundle: I18nBundle.Shared, language: 'en', messages: {} });

    expect(service.language()).toBe('en');
    expect(localStorage.getItem('chosenLanguage')).toBe('en');
  });

  it('uses a supported stored language when the URL is unprefixed', () => {
    localStorage.setItem('chosenLanguage', 'en');

    service.initialize().subscribe();
    http.expectOne((request) => request.url.endsWith('/api/i18n/languages')).flush(languages());
    http
      .expectOne((request) => request.url.endsWith('/api/i18n/bundles/shared/en'))
      .flush({ bundle: I18nBundle.Shared, language: 'en', messages: {} });

    expect(service.language()).toBe('en');
  });

  it('ignores an unsupported stored language and uses the backend default', () => {
    localStorage.setItem('chosenLanguage', 'de');

    service.initialize().subscribe();
    http.expectOne((request) => request.url.endsWith('/api/i18n/languages')).flush(languages());
    http
      .expectOne((request) => request.url.endsWith('/api/i18n/bundles/shared/ru'))
      .flush({ bundle: I18nBundle.Shared, language: 'ru', messages: {} });

    expect(service.language()).toBe('ru');
  });

  it('switches language and reuses a cached shared bundle', () => {
    initializeRussian({ title: 'Заголовок' });

    service.switchLanguage('en').subscribe();
    http
      .expectOne((request) => request.url.endsWith('/api/i18n/bundles/shared/en'))
      .flush({ bundle: I18nBundle.Shared, language: 'en', messages: { title: 'Title' } });
    expect(service.translate('title')).toBe('Title');

    service.switchLanguage('ru').subscribe();
    http.expectNone((request) => request.url.includes('/api/i18n/bundles/'));
    expect(service.translate('title')).toBe('Заголовок');
  });

  it('loads an alternate shared bundle without switching the UI language', () => {
    initializeRussian({ title: 'Заголовок' });

    service.ensureLanguageBundle('en').subscribe();
    http
      .expectOne((request) => request.url.endsWith('/api/i18n/bundles/shared/en'))
      .flush({ bundle: I18nBundle.Shared, language: 'en', messages: { title: 'Title' } });

    expect(service.translateForLanguage('en', 'title')).toBe('Title');
    expect(service.translate('title')).toBe('Заголовок');
    expect(service.language()).toBe('ru');
  });

  it('records a startup error when languages cannot be loaded', () => {
    service.initialize().subscribe();
    http
      .expectOne((request) => request.url.endsWith('/api/i18n/languages'))
      .flush({}, { status: 500, statusText: 'Server Error' });

    expect(service.startupError()).toBe(true);
    expect(service.translate('i18n.startupError.title')).toBe('Failed to load localization');
  });

  it('can apply a URL language without overwriting the saved preference', () => {
    service.languages.set(languages().languages);
    service.persistLanguage('en');
    service.switchLanguage('ru', false).subscribe();
    http
      .expectOne((request) => request.url.endsWith('/api/i18n/bundles/shared/ru'))
      .flush({ bundle: I18nBundle.Shared, language: 'ru', messages: {} });

    expect(service.language()).toBe('ru');
    expect(localStorage.getItem('chosenLanguage')).toBe('en');
  });

  function initializeRussian(messages: Record<string, string>): void {
    service.initialize().subscribe();
    http.expectOne((request) => request.url.endsWith('/api/i18n/languages')).flush(languages());
    http
      .expectOne((request) => request.url.endsWith('/api/i18n/bundles/shared/ru'))
      .flush({ bundle: I18nBundle.Shared, language: 'ru', messages });
  }
});

describe('I18nService with a server document', () => {
  it('does not access browser storage', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: DOCUMENT,
          useValue: document.implementation.createHTMLDocument('server'),
        },
      ],
    });
    const service = TestBed.inject(I18nService);
    service.languages.set([{ code: 'en', label: 'English' }]);
    const write = jest.spyOn(Storage.prototype, 'setItem');

    expect(() => service.persistLanguage('en')).not.toThrow();
    expect(write).not.toHaveBeenCalled();
    write.mockRestore();
  });
});

function languages(): I18nLanguagesDto {
  return {
    defaultLanguage: 'ru',
    languages: [
      { code: 'ru', label: 'Русский' },
      { code: 'en', label: 'English' },
    ],
  };
}
