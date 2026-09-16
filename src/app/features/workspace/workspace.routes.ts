import { Routes } from '@angular/router';
import { unsavedChangesGuard } from './guards/unsaved-changes.guard';

export const workspaceRoutes: Routes = [
  {
    path: '',
    title: 'workspace.title',
    loadComponent: () =>
      import('./pages/workspace-page/workspace-page.component').then(
        (m) => m.WorkspacePageComponent,
      ),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'workspaceDashboard.title',
        loadComponent: () =>
          import('./pages/dashboard-page.component').then((m) => m.DashboardPageComponent),
      },
      {
        path: 'knowledge/people',
        title: 'knowledgePeople.title',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./knowledge/people/pages/people-list/people-list.component').then(
            (m) => m.PeopleListComponent,
          ),
      },
      {
        path: 'knowledge/people/:id',
        title: 'knowledgePeople.detailTitle',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./knowledge/people/pages/person-detail/person-detail.component').then(
            (m) => m.PersonDetailComponent,
          ),
      },
      {
        path: 'knowledge/dates',
        title: 'knowledgeDates.title',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./knowledge/dates/pages/dates-list/dates-list.component').then(
            (m) => m.DatesListComponent,
          ),
      },
      {
        path: 'knowledge/dates/:id',
        title: 'knowledgeDates.detailTitle',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./knowledge/dates/pages/date-detail/date-detail.component').then(
            (m) => m.DateDetailComponent,
          ),
      },
      {
        path: 'resumes',
        title: 'resumeWorkspace.title',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./pages/resumes-page/resumes-page.component').then((m) => m.ResumesPageComponent),
      },
      {
        path: 'resumes/:id',
        title: 'resumeWorkspace.detailTitle',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./pages/resume-detail-page/resume-detail-page.component').then(
            (m) => m.ResumeDetailPageComponent,
          ),
      },
    ],
  },
];
