import { Routes } from '@angular/router';

export const articlesRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/articles-page/articles-page.component').then((m) => m.ArticlesPageComponent),
  },
  {
    path: ':slug',
    loadComponent: () =>
      import('./pages/articles-page/articles-page.component').then((m) => m.ArticlesPageComponent),
  },
];
