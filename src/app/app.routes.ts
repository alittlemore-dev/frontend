import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { injectedPublicHomePath } from './core/routing/public-home';

export const routes: Routes = [
  { path: '', redirectTo: () => injectedPublicHomePath(), pathMatch: 'full' },
  {
    path: 'ru',
    children: publicRoutes(),
  },
  {
    path: 'en',
    children: publicRoutes(),
  },
  ...publicRoutes(),
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

function publicRoutes(): Routes {
  return [
    {
      path: 'competency-matrix',
      loadChildren: () => import('./features/matrix/matrix.routes').then((m) => m.matrixRoutes),
    },
    {
      path: 'articles',
      loadChildren: () =>
        import('./features/articles/articles.routes').then((m) => m.articlesRoutes),
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
