import { inject } from '@angular/core';
import { RedirectFunction, Router, Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { LanguageCode } from './core/i18n/i18n.model';
import { injectedPublicHomePath } from './core/routing/public-home';

export const routes: Routes = [
  { path: '', redirectTo: () => injectedPublicHomePath(), pathMatch: 'full' },
  {
    path: 'ru',
    children: publicRoutes('ru'),
  },
  {
    path: 'en',
    children: publicRoutes('en'),
  },
  ...publicRoutes(null),
  {
    path: '404',
    loadChildren: () =>
      import('./features/not-found/not-found.routes').then((m) => m.notFoundRoutes),
  },
  {
    path: 'login',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: 'admin-panel',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/admin-panel/admin-panel.routes').then((m) => m.adminPanelRoutes),
  },
  { path: '**', redirectTo: '404' },
];

function publicRoutes(language: LanguageCode | null): Routes {
  return [
    {
      path: 'competency',
      children: competencyRoutes(),
    },
    {
      path: 'competency-matrix/questions/:slug',
      redirectTo: competencyRedirect(language, ['matrix', 'questions', ':slug']),
    },
    {
      path: 'competency-matrix',
      redirectTo: competencyRedirect(language, ['matrix']),
      pathMatch: 'full',
    },
    {
      path: 'articles/:slug',
      redirectTo: competencyRedirect(language, ['articles', ':slug']),
    },
    {
      path: 'articles',
      redirectTo: competencyRedirect(language, ['articles']),
      pathMatch: 'full',
    },
    {
      path: 'sitemap',
      loadChildren: () => import('./features/sitemap/sitemap.routes').then((m) => m.sitemapRoutes),
    },
    {
      path: 'updates',
      loadChildren: () => import('./features/updates/updates.routes').then((m) => m.updatesRoutes),
    },
    {
      path: 'how-this-site-is-built',
      loadChildren: () =>
        import('./features/site-case-study/site-case-study.routes').then(
          (m) => m.siteCaseStudyRoutes,
        ),
    },
  ];
}

function competencyRedirect(
  language: LanguageCode | null,
  destinationSegments: readonly string[],
): RedirectFunction {
  return ({ params, queryParams, fragment }) => {
    const resolvedSegments = destinationSegments.map((segment) => {
      if (segment !== ':slug') return segment;
      const slug = params['slug'];
      if (typeof slug !== 'string') {
        throw new Error('Legacy competency detail redirect requires a slug.');
      }
      return slug;
    });
    const languageSegments = language === null ? [] : [language];
    return inject(Router).createUrlTree(
      ['/', ...languageSegments, 'competency', ...resolvedSegments],
      { queryParams, fragment: fragment ?? undefined },
    );
  };
}

function competencyRoutes(): Routes {
  return [
    {
      path: 'matrix',
      loadChildren: () => import('./features/matrix/matrix.routes').then((m) => m.matrixRoutes),
    },
    {
      path: 'articles',
      loadChildren: () =>
        import('./features/articles/articles.routes').then((m) => m.articlesRoutes),
    },
  ];
}
