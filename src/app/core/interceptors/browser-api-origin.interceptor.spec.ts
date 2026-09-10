import { DOCUMENT } from '@angular/common';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
  withNoXsrfProtection,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { browserApiOriginInterceptor } from './browser-api-origin.interceptor';

describe('browserApiOriginInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  afterEach(() => {
    httpMock.verify();
  });

  it('normalizes browser API requests to the current public origin', () => {
    configure('browser');

    http.get('/api/articles').subscribe();

    httpMock.expectOne('https://site.example/api/articles').flush({});
  });

  it('keeps server API requests relative for the server origin interceptor', () => {
    configure('server');

    http.get('/api/articles').subscribe();

    httpMock.expectOne('/api/articles').flush({});
  });

  it('does not rewrite non-API URLs', () => {
    configure('browser');

    http.get('/assets/logo.svg').subscribe();

    httpMock.expectOne('/assets/logo.svg').flush('');
  });

  function configure(platformId: 'browser' | 'server'): void {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withNoXsrfProtection(), withInterceptors([browserApiOriginInterceptor])),
        provideHttpClientTesting(),
        {
          provide: DOCUMENT,
          useValue: {
            location: { origin: 'https://site.example' },
          },
        },
        { provide: PLATFORM_ID, useValue: platformId },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  }
});
