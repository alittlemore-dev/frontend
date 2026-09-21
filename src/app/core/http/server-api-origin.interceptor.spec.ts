import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  SSR_API_ORIGIN,
  SSR_I18N_ORIGIN,
  serverApiOriginInterceptor,
} from './server-api-origin.interceptor';

describe('SSR API origins', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([serverApiOriginInterceptor])),
        provideHttpClientTesting(),
        { provide: SSR_API_ORIGIN, useValue: 'http://competency.internal' },
        { provide: SSR_I18N_ORIGIN, useValue: 'http://i18n.internal' },
      ],
    });
  });

  it.each([
    ['/api/i18n/languages', 'http://i18n.internal/api/i18n/languages'],
    ['/api/i18n/bundles/en', 'http://i18n.internal/api/i18n/bundles/en'],
    [
      '/api/i18n/personal-workspace/bundles/ru',
      'http://i18n.internal/api/i18n/personal-workspace/bundles/ru',
    ],
    ['/api/articles?language=en', 'http://competency.internal/api/articles?language=en'],
    ['/assets/logo.svg', '/assets/logo.svg'],
    ['https://other.example/api/i18n/languages', 'https://other.example/api/i18n/languages'],
  ])('routes %s to its owning service', (path, expected) => {
    TestBed.inject(HttpClient).get(path).subscribe();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(expected).flush({});
    http.verify();
  });
});
