import { inject } from '@angular/core';
import { RedirectFunction, Router, Routes } from '@angular/router';
import {
  accountChildGuard,
  accountGuard,
  authGuard,
  workspaceGuard,
  workspaceChildGuard,
  authChildGuard,
} from './core/auth/auth.guard';
import { I18nBundle, LanguageCode } from './core/i18n/i18n.model';
import { i18nBundleResolver } from './core/i18n/i18n.resolver';
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
    resolve: { localization: i18nBundleResolver(null) },
    loadChildren: () =>
      import('./features/not-found/not-found.routes').then((m) => m.notFoundRoutes),
  },
  {
    path: 'login',
    resolve: { localization: i18nBundleResolver(null) },
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: 'personal-workspace',
    canActivate: [workspaceGuard],
    canActivateChild: [workspaceChildGuard],
    resolve: { localization: i18nBundleResolver(I18nBundle.PersonalWorkspace) },
    loadChildren: () =>
      import('./features/workspace/workspace.routes').then((m) => m.workspaceRoutes),
  },
  {
    path: 'account',
    canActivate: [accountGuard],
    canActivateChild: [accountChildGuard],
    resolve: { localization: i18nBundleResolver(I18nBundle.Account) },
    loadChildren: () => import('./features/account/account.routes').then((m) => m.accountRoutes),
  },
  {
    path: 'admin-panel',
    canActivate: [authGuard],
    canActivateChild: [authChildGuard],
    resolve: { localization: i18nBundleResolver(I18nBundle.AdminPanel) },
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
      resolve: { localization: i18nBundleResolver(I18nBundle.Sitemap) },
      loadChildren: () => import('./features/sitemap/sitemap.routes').then((m) => m.sitemapRoutes),
    },
    {
      path: 'updates',
      resolve: { localization: i18nBundleResolver(I18nBundle.Updates) },
      loadChildren: () => import('./features/updates/updates.routes').then((m) => m.updatesRoutes),
    },
    {
      path: 'how-this-site-is-built',
      resolve: { localization: i18nBundleResolver(I18nBundle.HowThisSiteIsBuilt) },
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
      resolve: { localization: i18nBundleResolver(I18nBundle.CompetencyMatrix) },
      loadChildren: () => import('./features/matrix/matrix.routes').then((m) => m.matrixRoutes),
    },
    {
      path: 'articles',
      resolve: { localization: i18nBundleResolver(I18nBundle.Articles) },
      loadChildren: () =>
        import('./features/articles/articles.routes').then((m) => m.articlesRoutes),
    },
  ];
}
