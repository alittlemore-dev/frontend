import { Routes } from '@angular/router';

export const notFoundRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/not-found-page/not-found-page.component').then(
        (m) => m.NotFoundPageComponent,
      ),
  },
];
