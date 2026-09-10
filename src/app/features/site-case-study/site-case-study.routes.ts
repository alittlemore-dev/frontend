import { Routes } from '@angular/router';

export const siteCaseStudyRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/site-case-study-page/site-case-study-page.component').then(
        (m) => m.SiteCaseStudyPageComponent,
      ),
  },
];
