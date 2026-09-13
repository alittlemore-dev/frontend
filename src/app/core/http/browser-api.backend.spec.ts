import { DOCUMENT } from '@angular/common';
import {
  FetchBackend,
  HttpBackend,
  HttpClient,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
  provideHttpClient,
  withNoXsrfProtection,
  ɵHTTP_ROOT_INTERCEPTOR_FNS,
} from '@angular/common/http';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { BrowserApiBackend } from './browser-api.backend';

describe('BrowserApiBackend', () => {
  it('rewrites API requests only after root interceptors such as the transfer cache', () => {
    const { http, rootUrls, transport } = configure('browser');

    http.get('/api/articles').subscribe();

    expect(rootUrls).toEqual(['/api/articles']);
    expect(transport.handle).toHaveBeenCalledTimes(1);
    expect(requestSentTo(transport).url).toBe('https://site.example/api/competency/articles');
  });

  it('does not rewrite server API requests', () => {
    const { http, transport } = configure('server');

    http.get('/api/articles').subscribe();

    expect(requestSentTo(transport).url).toBe('/api/articles');
  });

  it('does not rewrite non-API URLs', () => {
    const { http, transport } = configure('browser');

    http.get('/assets/logo.svg').subscribe();

    expect(requestSentTo(transport).url).toBe('/assets/logo.svg');
  });
});

function configure(platformId: 'browser' | 'server') {
  const rootUrls: string[] = [];
  const rootInterceptor: HttpInterceptorFn = (request, next) => {
    rootUrls.push(request.url);
    return next(request);
  };
  const transport = {
    handle: jest.fn(() => of(new HttpResponse({ status: 200, body: {} }))),
  };

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withNoXsrfProtection()),
      BrowserApiBackend,
      { provide: FetchBackend, useValue: transport },
      { provide: HttpBackend, useExisting: BrowserApiBackend },
      { provide: ɵHTTP_ROOT_INTERCEPTOR_FNS, useValue: rootInterceptor, multi: true },
      {
        provide: DOCUMENT,
        useValue: {
          location: { origin: 'https://site.example' },
        },
      },
      { provide: PLATFORM_ID, useValue: platformId },
    ],
  });

  return { http: TestBed.inject(HttpClient), rootUrls, transport };
}

function requestSentTo(transport: { handle: jest.Mock }): HttpRequest<unknown> {
  return transport.handle.mock.calls[0][0] as HttpRequest<unknown>;
}
