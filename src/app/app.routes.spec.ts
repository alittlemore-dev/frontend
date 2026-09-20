import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RedirectFunction, Router, UrlTree, provideRouter } from '@angular/router';
import { accountChildGuard, accountGuard, authGuard } from './core/auth/auth.guard';
import { I18nService } from './core/i18n/i18n.service';
import { routes } from './app.routes';

describe('routes', () => {
  it('redirects the root route to the localized site-build case study', () => {
    const rootRoute = routes.find((route) => route.path === '');
    expect(typeof rootRoute?.redirectTo).toBe('function');

    TestBed.configureTestingModule({
      providers: [{ provide: I18nService, useValue: { language: signal('en') } }],
    });

    const redirectTo = rootRoute?.redirectTo as RedirectFunction;
    const result = TestBed.runInInjectionContext(() =>
      redirectTo({} as Parameters<RedirectFunction>[0]),
    );

    expect(result).toBe('/en/how-this-site-is-built');
  });

  it('registers localized and legacy public routes for the site-build case study', () => {
    const russianRoutes = routes.find((route) => route.path === 'ru')?.children ?? [];
    const englishRoutes = routes.find((route) => route.path === 'en')?.children ?? [];
    const legacyRoutes = routes.filter((route) => route.path === 'how-this-site-is-built');

    expect(russianRoutes.find((route) => route.path === 'how-this-site-is-built')).toBeDefined();
    expect(englishRoutes.find((route) => route.path === 'how-this-site-is-built')).toBeDefined();
    expect(legacyRoutes).toHaveLength(1);
    expect(legacyRoutes[0]?.loadChildren).toBeDefined();
  });

  it('registers localized and legacy public routes for updates', () => {
    const russianRoutes = routes.find((route) => route.path === 'ru')?.children ?? [];
    const englishRoutes = routes.find((route) => route.path === 'en')?.children ?? [];
    const legacyRoutes = routes.filter((route) => route.path === 'updates');

    expect(russianRoutes.find((route) => route.path === 'updates')).toBeDefined();
    expect(englishRoutes.find((route) => route.path === 'updates')).toBeDefined();
    expect(legacyRoutes).toHaveLength(1);
    expect(legacyRoutes[0]?.loadChildren).toBeDefined();
  });

  it('registers competency public routes under the shared namespace', () => {
    const russianRoutes = routes.find((route) => route.path === 'ru')?.children ?? [];
    const competencyRoutes = russianRoutes.find((route) => route.path === 'competency')?.children;

    expect(competencyRoutes?.find((route) => route.path === 'matrix')?.loadChildren).toBeDefined();
    expect(
      competencyRoutes?.find((route) => route.path === 'articles')?.loadChildren,
    ).toBeDefined();
  });

  it('redirects legacy competency SEO routes into the shared namespace', () => {
    const russianRoutes = routes.find((route) => route.path === 'ru')?.children ?? [];
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const router = TestBed.inject(Router);

    const articleRedirect = russianRoutes.find((route) => route.path === 'articles/:slug')
      ?.redirectTo as RedirectFunction;
    const articleResult = TestBed.runInInjectionContext(() =>
      articleRedirect({
        params: { slug: 'typed-articles' },
        queryParams: { tag: 'angular' },
        fragment: 'content',
      } as Parameters<RedirectFunction>[0]),
    );
    expect(router.serializeUrl(articleResult as UrlTree)).toBe(
      '/ru/competency/articles/typed-articles?tag=angular#content',
    );

    const matrixRedirect = russianRoutes.find(
      (route) => route.path === 'competency-matrix/questions/:slug',
    )?.redirectTo as RedirectFunction;
    const matrixResult = TestBed.runInInjectionContext(() =>
      matrixRedirect({
        params: { slug: 'angular-forms' },
        queryParams: {},
        fragment: null,
      } as Parameters<RedirectFunction>[0]),
    );
    expect(router.serializeUrl(matrixResult as UrlTree)).toBe(
      '/ru/competency/matrix/questions/angular-forms',
    );

    expect(russianRoutes.find((route) => route.path === 'articles')).toBeDefined();
    expect(russianRoutes.find((route) => route.path === 'competency-matrix')).toBeDefined();
    expect(routes.find((route) => route.path === 'articles')).toBeDefined();
    expect(routes.find((route) => route.path === 'competency-matrix')).toBeDefined();
  });

  it('does not register localized or legacy about routes', () => {
    const russianRoutes = routes.find((route) => route.path === 'ru')?.children ?? [];
    const englishRoutes = routes.find((route) => route.path === 'en')?.children ?? [];
    const legacyRoutes = routes.filter((route) => route.path === 'about-me');

    expect(russianRoutes.find((route) => route.path === 'about-me')).toBeUndefined();
    expect(englishRoutes.find((route) => route.path === 'about-me')).toBeUndefined();
    expect(legacyRoutes).toHaveLength(0);
  });

  it('registers admin-panel as a protected top-level CSR route', () => {
    const adminRoute = routes.find((route) => route.path === 'admin-panel');

    expect(adminRoute).toBeDefined();
    expect(adminRoute?.canActivate).toEqual([authGuard]);
    expect(adminRoute?.loadChildren).toBeDefined();
  });

  it('registers account as a protected lazy-loaded CSR route', () => {
    const accountRoute = routes.find((route) => route.path === 'account');

    expect(accountRoute).toBeDefined();
    expect(accountRoute?.canActivate).toEqual([accountGuard]);
    expect(accountRoute?.canActivateChild).toEqual([accountChildGuard]);
    expect(accountRoute?.loadChildren).toBeDefined();
  });
});
