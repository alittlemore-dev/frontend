import { Routes } from '@angular/router';

export const matrixRoutes: Routes = [
  {
    path: 'questions/:slug',
    loadComponent: () =>
      import('./pages/matrix-question-page/matrix-question-page.component').then(
        (m) => m.MatrixQuestionPageComponent,
      ),
  },
  {
    path: '',
    loadComponent: () =>
      import('./pages/matrix-list/matrix-list.component').then((m) => m.MatrixListComponent),
  },
];
