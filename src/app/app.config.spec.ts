import { HttpRequest } from '@angular/common/http';
import { authStartupMode, shouldTransferCacheRequest } from './app.config';

describe('appConfig HTTP transfer cache filter', () => {
  it('allows safe public GET requests used by SSR pages', () => {
    expect(
      shouldTransferCacheRequest(
        new HttpRequest(
          'GET',
          'http://localhost:8000/api/articles/detail/typed-articles?language=ru',
        ),
      ),
    ).toBe(true);
    expect(
      shouldTransferCacheRequest(
        new HttpRequest(
          'GET',
          'http://localhost:8000/api/competency-matrix/items/public/how-to-write-function?language=ru',
        ),
      ),
    ).toBe(true);
    expect(shouldTransferCacheRequest(new HttpRequest('GET', '/api/articles/tags'))).toBe(true);
    expect(shouldTransferCacheRequest(new HttpRequest('GET', '/api/articles/tree'))).toBe(true);
    expect(
      shouldTransferCacheRequest(
        new HttpRequest(
          'GET',
          '/api/articles/public-stats?articleIds=00000000-0000-0000-0000-000000000001',
        ),
      ),
    ).toBe(true);
  });

  it('excludes auth, private, analytics, and reaction requests', () => {
    expect(shouldTransferCacheRequest(new HttpRequest('GET', '/api/i18n/languages'))).toBe(false);
    expect(shouldTransferCacheRequest(new HttpRequest('GET', '/api/i18n/bundles/ru'))).toBe(false);
    expect(shouldTransferCacheRequest(new HttpRequest('GET', '/api/auth/me'))).toBe(false);
    expect(shouldTransferCacheRequest(new HttpRequest('GET', '/api/admin/articles/stats'))).toBe(
      false,
    );
    expect(shouldTransferCacheRequest(new HttpRequest('GET', '/api/admin/articles'))).toBe(false);
    expect(
      shouldTransferCacheRequest(
        new HttpRequest('POST', '/api/articles/detail/typed-articles/analytics/view', {}),
      ),
    ).toBe(false);
    expect(
      shouldTransferCacheRequest(
        new HttpRequest('POST', '/api/articles/detail/typed-articles/reaction', {}),
      ),
    ).toBe(false);
  });
});

describe('appConfig auth startup', () => {
  it('skips auth restore probes for anonymous public visits', () => {
    expect(authStartupMode('/ru/how-this-site-is-built', false)).toBe('skip');
    expect(authStartupMode('/en/articles/typed-articles', false)).toBe('skip');
    expect(authStartupMode('/ru/competency-matrix', false)).toBe('skip');
    expect(authStartupMode('/ru/competency-matrix/questions/how-to-write-function', false)).toBe(
      'skip',
    );
  });

  it('restores a known session after the first public render', () => {
    expect(authStartupMode('/ru/how-this-site-is-built', true)).toBe('after-render');
    expect(authStartupMode('/en/articles/typed-articles', true)).toBe('after-render');
  });

  it('blocks protected admin startup until auth restoration completes', () => {
    expect(authStartupMode('/admin-panel', false)).toBe('blocking');
    expect(authStartupMode('/admin-panel/articles', false)).toBe('blocking');
    expect(authStartupMode('/admin-panel/articles', true)).toBe('blocking');
  });
});
