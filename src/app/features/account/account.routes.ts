import { Routes } from '@angular/router';
import { accountUnsavedChangesGuard } from './guards/account-unsaved-changes.guard';

export const accountRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/account-page/account-page.component').then((m) => m.AccountPageComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'me' },
      {
        path: 'me',
        title: 'account.profile.title',
        canDeactivate: [accountUnsavedChangesGuard],
        loadComponent: () =>
          import('./pages/profile-page/profile-page.component').then((m) => m.ProfilePageComponent),
      },
    ],
  },
];
