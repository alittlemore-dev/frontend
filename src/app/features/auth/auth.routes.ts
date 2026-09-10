import { Routes } from '@angular/router';

export const authRoutes: Routes = [
  {
    path: '',
    title: 'auth.login.title',
    loadComponent: () =>
      import('./pages/login-page/login-page.component').then((m) => m.LoginPageComponent),
  },
];
