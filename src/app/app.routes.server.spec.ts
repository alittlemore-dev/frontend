jest.mock('@angular/ssr', () => ({
  RenderMode: {
    Server: 0,
    Client: 1,
    Prerender: 2,
  },
}));

import { RenderMode } from '@angular/ssr';
import { serverRoutes } from './app.routes.server';

describe('serverRoutes', () => {
  it('server-renders localized public SEO pages', () => {
    expect(serverRoutes).toEqual(
      expect.arrayContaining([
        { path: 'ru/articles/:slug', renderMode: RenderMode.Server },
        { path: 'en/articles/:slug', renderMode: RenderMode.Server },
        { path: 'ru/competency-matrix/questions/:slug', renderMode: RenderMode.Server },
        { path: 'en/competency-matrix/questions/:slug', renderMode: RenderMode.Server },
        { path: 'ru/how-this-site-is-built', renderMode: RenderMode.Server },
        { path: 'en/how-this-site-is-built', renderMode: RenderMode.Server },
        { path: 'ru/updates', renderMode: RenderMode.Server },
        { path: 'en/updates', renderMode: RenderMode.Server },
      ]),
    );
    expect(serverRoutes.find((route) => route.path === 'ru/competency-matrix')).toBeUndefined();
    expect(serverRoutes.find((route) => route.path === 'en/competency-matrix')).toBeUndefined();
    expect(serverRoutes.find((route) => route.path === 'admin-panel')).toBeUndefined();
  });

  it('keeps the rest of the Angular app in CSR mode', () => {
    expect(serverRoutes.at(-1)).toEqual({ path: '**', renderMode: RenderMode.Client });
  });
});
