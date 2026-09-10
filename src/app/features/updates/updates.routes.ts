import { Routes } from '@angular/router';

export const updatesRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/updates-page/updates-page.component').then((m) => m.UpdatesPageComponent),
  },
];
