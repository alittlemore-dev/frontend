import { Routes } from '@angular/router';

export const sitemapRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/sitemap-page/sitemap-page.component').then((m) => m.SitemapPageComponent),
  },
];
