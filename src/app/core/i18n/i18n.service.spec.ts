import { DOCUMENT, TransferState, makeStateKey } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiClient } from '../http/api-client.service';
import { I18nBundleDto, I18nLanguagesDto } from './i18n.model';
import { I18nService } from './i18n.service';

describe('I18nService', () => {
  let service: I18nService;
  let httpMock: HttpTestingController;
  let document: Document;
  let transferState: TransferState;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [ApiClient, I18nService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(I18nService);
    httpMock = TestBed.inject(HttpTestingController);
    document = TestBed.inject(DOCUMENT);
    transferState = TestBed.inject(TransferState);
  });

  afterEach(() => httpMock.verify());

  it('loads languages before the default bundle during startup', () => {
    service.initialize().subscribe();

    const languagesReq = httpMock.expectOne((req) => req.url.endsWith('/api/i18n/languages'));
    expect(languagesReq.request.method).toBe('GET');
    languagesReq.flush({
      defaultLanguage: 'ru',
      languages: [
        { code: 'ru', label: 'Русский' },
        { code: 'en', label: 'English' },
      ],
    });

    const bundleReq = httpMock.expectOne((req) => req.url.endsWith('/api/i18n/bundles/ru'));
    bundleReq.flush({
      language: 'ru',
      messages: {
        'shell.nav.articles': 'Статьи',
        greeting: 'Привет, {name}',
      },
    });

    expect(service.language()).toBe('ru');
    expect(service.languages()).toEqual([
      { code: 'ru', label: 'Русский' },
      { code: 'en', label: 'English' },
    ]);
    expect(service.translate('shell.nav.articles')).toBe('Статьи');
    expect(service.translate('greeting', { name: 'Дима' })).toBe('Привет, Дима');
    expect(document.documentElement.lang).toBe('ru');
  });

  it('uses transferred startup i18n state without HTTP requests', () => {
    const languagesKey = makeStateKey<I18nLanguagesDto | null>('i18n.languages');
    const bundleKey = makeStateKey<I18nBundleDto | null>('i18n.bundle.ru');
    transferState.set(languagesKey, {
      defaultLanguage: 'ru',
      languages: [
        { code: 'ru', label: 'Русский' },
        { code: 'en', label: 'English' },
      ],
    });
    transferState.set(bundleKey, {
      language: 'ru',
      messages: {
        'shell.nav.articles': 'Статьи',
      },
    });

    service.initialize().subscribe();

    httpMock.expectNone((req) => req.url.includes('/api/i18n/'));
    expect(service.language()).toBe('ru');
    expect(service.languages()).toEqual([
      { code: 'ru', label: 'Русский' },
      { code: 'en', label: 'English' },
    ]);
    expect(service.translate('shell.nav.articles')).toBe('Статьи');
    expect(document.documentElement.lang).toBe('ru');
    expect(transferState.hasKey(languagesKey)).toBe(false);
    expect(transferState.hasKey(bundleKey)).toBe(false);
  });

  it('uses the stored language when it is still available', () => {
    localStorage.setItem('chosenLanguage', 'en');

    service.initialize().subscribe();
    httpMock
      .expectOne((req) => req.url.endsWith('/api/i18n/languages'))
      .flush({
        defaultLanguage: 'ru',
        languages: [
          { code: 'ru', label: 'Русский' },
          { code: 'en', label: 'English' },
        ],
      });

    const bundleReq = httpMock.expectOne((req) => req.url.endsWith('/api/i18n/bundles/en'));
    bundleReq.flush({ language: 'en', messages: { 'shell.nav.articles': 'Articles' } });

    expect(service.language()).toBe('en');
    expect(service.translate('shell.nav.articles')).toBe('Articles');
  });

  it('uses the URL language prefix before the stored language', () => {
    window.history.pushState({}, '', '/en/competency/articles/typed-articles');
    localStorage.setItem('chosenLanguage', 'ru');

    service.initialize().subscribe();
    httpMock
      .expectOne((req) => req.url.endsWith('/api/i18n/languages'))
      .flush({
        defaultLanguage: 'ru',
        languages: [
          { code: 'ru', label: 'Русский' },
          { code: 'en', label: 'English' },
        ],
      });

    const bundleReq = httpMock.expectOne((req) => req.url.endsWith('/api/i18n/bundles/en'));
    bundleReq.flush({ language: 'en', messages: { 'shell.nav.articles': 'Articles' } });

    expect(service.language()).toBe('en');
    expect(localStorage.getItem('chosenLanguage')).toBe('en');
    window.history.pushState({}, '', '/');
  });

  it('ignores a stale stored language and uses backend default language', () => {
    localStorage.setItem('chosenLanguage', 'de');

    service.initialize().subscribe();
    httpMock
      .expectOne((req) => req.url.endsWith('/api/i18n/languages'))
      .flush({
        defaultLanguage: 'ru',
        languages: [
          { code: 'ru', label: 'Русский' },
          { code: 'en', label: 'English' },
        ],
      });

    const bundleReq = httpMock.expectOne((req) => req.url.endsWith('/api/i18n/bundles/ru'));
    bundleReq.flush({ language: 'ru', messages: { 'shell.nav.articles': 'Статьи' } });

    expect(service.language()).toBe('ru');
    expect(localStorage.getItem('chosenLanguage')).toBe('ru');
  });

  it('switches language and reuses a cached bundle', () => {
    service.initialize().subscribe();
    httpMock
      .expectOne((req) => req.url.endsWith('/api/i18n/languages'))
      .flush({
        defaultLanguage: 'ru',
        languages: [
          { code: 'ru', label: 'Русский' },
          { code: 'en', label: 'English' },
        ],
      });
    httpMock
      .expectOne((req) => req.url.endsWith('/api/i18n/bundles/ru'))
      .flush({ language: 'ru', messages: { title: 'Заголовок' } });

    service.switchLanguage('en').subscribe();
    httpMock
      .expectOne((req) => req.url.endsWith('/api/i18n/bundles/en'))
      .flush({ language: 'en', messages: { title: 'Title' } });
    expect(service.translate('title')).toBe('Title');
    expect(localStorage.getItem('chosenLanguage')).toBe('en');

    service.switchLanguage('ru').subscribe();
    httpMock.expectNone((req) => req.url.includes('/api/i18n/bundles/ru'));
    expect(service.translate('title')).toBe('Заголовок');
    expect(localStorage.getItem('chosenLanguage')).toBe('ru');
  });

  it('loads a non-current bundle for explicit translations without switching UI language', () => {
    service.initialize().subscribe();
    httpMock
      .expectOne((req) => req.url.endsWith('/api/i18n/languages'))
      .flush({
        defaultLanguage: 'ru',
        languages: [
          { code: 'ru', label: 'Русский' },
          { code: 'en', label: 'English' },
        ],
      });
    httpMock
      .expectOne((req) => req.url.endsWith('/api/i18n/bundles/ru'))
      .flush({ language: 'ru', messages: { title: 'Заголовок' } });

    service.ensureLanguageBundle('en').subscribe();
    httpMock
      .expectOne((req) => req.url.endsWith('/api/i18n/bundles/en'))
      .flush({ language: 'en', messages: { title: 'Title' } });

    expect(service.translateForLanguage('en', 'title')).toBe('Title');
    expect(service.translate('title')).toBe('Заголовок');
    expect(service.language()).toBe('ru');
    expect(localStorage.getItem('chosenLanguage')).toBe('ru');
    expect(document.documentElement.lang).toBe('ru');
  });

  it('records startup error when languages cannot be loaded', () => {
    service.initialize().subscribe();

    httpMock
      .expectOne((req) => req.url.endsWith('/api/i18n/languages'))
      .flush({ detail: 'unavailable' }, { status: 500, statusText: 'Server Error' });

    expect(service.startupError()).toBe(true);
    expect(service.translate('i18n.startupError.title')).toBe('Failed to load localization');
  });
});

describe('Workspace localization integration', () => {
  let service: I18nService;
  let http: HttpTestingController;
  beforeEach(() => {
    localStorage.clear();
    history.replaceState({}, '', '/ru/how-this-site-is-built');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(I18nService);
    http = TestBed.inject(HttpTestingController);
    service.initialize().subscribe();
    http
      .expectOne((req) => req.url.endsWith('/api/i18n/languages'))
      .flush({
        defaultLanguage: 'ru',
        languages: [
          { code: 'ru', label: 'Русский' },
          { code: 'en', label: 'English' },
        ],
      });
    http
      .expectOne((req) => req.url.endsWith('/api/i18n/bundles/ru'))
      .flush({
        language: 'ru',
        messages: { 'shared.save': 'Сохранить', 'dashboard.tools.summary': 'Кэш и сессии' },
      });
  });
  afterEach(() => {
    http.verify();
    history.replaceState({}, '', '/');
  });

  it('loads workspace text only on demand without replacing shared or admin strings', () => {
    http.expectNone((req) => req.url.includes('/personal-workspace/'));
    service.ensureWorkspaceBundle().subscribe();
    http
      .expectOne((req) => req.url.endsWith('/api/personal-workspace/i18n/bundles/ru'))
      .flush({
        language: 'ru',
        messages: {
          'shared.save': 'Другая подпись',
          'knowledgePeople.title': 'Люди',
          'dashboard.tools.summary': 'Кэш',
        },
      });
    expect(service.translate('shared.save')).toBe('Сохранить');
    expect(service.translate('dashboard.tools.summary')).toBe('Кэш и сессии');
    expect(service.translate('workspaceDashboard.tools.summary')).toBe('Кэш');
    expect(service.translate('knowledgePeople.title')).toBe('Люди');
    service.ensureWorkspaceBundle().subscribe();
    http.expectNone((req) => req.url.includes('/personal-workspace/'));
  });

  it('loads both language bundles before changing the active workspace language', () => {
    history.replaceState({}, '', '/personal-workspace/resumes');
    service.switchLanguage('en').subscribe();
    expect(service.language()).toBe('ru');
    http
      .expectOne((req) => req.url.endsWith('/api/personal-workspace/i18n/bundles/en'))
      .flush({ language: 'en', messages: { 'resumeWorkspace.title': 'Resumes' } });
    http
      .expectOne((req) => req.url.endsWith('/api/i18n/bundles/en'))
      .flush({ language: 'en', messages: { 'shared.save': 'Save' } });
    expect(service.language()).toBe('en');
    expect(service.translate('resumeWorkspace.title')).toBe('Resumes');
    expect(service.translate('shared.save')).toBe('Save');
  });

  it('keeps the current language and reports errors if the workspace bundle cannot load', () => {
    history.replaceState({}, '', '/personal-workspace/resumes');
    const error = jest.fn();
    service.switchLanguage('en').subscribe({ error });
    http
      .expectOne((req) => req.url.endsWith('/api/personal-workspace/i18n/bundles/en'))
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect(service.language()).toBe('ru');
    expect(error).toHaveBeenCalled();
    http.expectNone((req) => req.url.endsWith('/api/i18n/bundles/en'));
  });

  it('shows a retryable startup error when a workspace bundle is unavailable', () => {
    service.ensureWorkspaceBundle().subscribe();
    http
      .expectOne((req) => req.url.endsWith('/api/personal-workspace/i18n/bundles/ru'))
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect(service.startupError()).toBe(true);
    service.ensureWorkspaceBundle().subscribe();
    http
      .expectOne((req) => req.url.endsWith('/api/personal-workspace/i18n/bundles/ru'))
      .flush({ language: 'ru', messages: { 'knowledgePeople.title': 'Люди' } });
    expect(service.translate('knowledgePeople.title')).toBe('Люди');
  });
});
