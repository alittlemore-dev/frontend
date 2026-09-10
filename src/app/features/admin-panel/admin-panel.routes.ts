import { Routes } from '@angular/router';
import { ownerGuard, teamGuard } from '../../core/auth/auth.guard';
import { adminUnsavedChangesGuard } from './guards/admin-unsaved-changes.guard';

export const adminPanelRoutes: Routes = [
  {
    path: '',
    title: 'adminPanel.title',
    loadComponent: () =>
      import('./pages/admin-panel-page/admin-panel-page.component').then(
        (m) => m.AdminPanelPageComponent,
      ),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },
      {
        path: 'dashboard',
        title: 'dashboard.title',
        loadComponent: () =>
          import('./pages/dashboard-page.component').then((m) => m.DashboardPageComponent),
      },
      {
        path: 'articles',
        title: 'articles.title',
        canDeactivate: [adminUnsavedChangesGuard],
        loadComponent: () =>
          import('./pages/articles-page/articles-page.component').then(
            (m) => m.AdminArticlesPageComponent,
          ),
      },
      {
        path: 'article-folders',
        title: 'articles.folders.title',
        canDeactivate: [adminUnsavedChangesGuard],
        loadComponent: () =>
          import('./pages/article-folders-page/article-folders-page.component').then(
            (m) => m.ArticleFoldersPageComponent,
          ),
      },
      {
        path: 'article-tags',
        title: 'articles.tags.title',
        canDeactivate: [adminUnsavedChangesGuard],
        loadComponent: () =>
          import('./pages/article-tags-page/article-tags-page.component').then(
            (m) => m.ArticleTagsPageComponent,
          ),
      },
      {
        path: 'article-statistics',
        title: 'articles.stats.button',
        canDeactivate: [adminUnsavedChangesGuard],
        loadComponent: () =>
          import('./pages/article-statistics-page/article-statistics-page.component').then(
            (m) => m.AdminArticleStatisticsPageComponent,
          ),
      },
      {
        path: 'articles/:slug',
        title: 'articles.modal.edit',
        canDeactivate: [adminUnsavedChangesGuard],
        loadComponent: () =>
          import('./pages/article-detail-page/article-detail-page.component').then(
            (m) => m.AdminArticleDetailPageComponent,
          ),
      },
      {
        path: 'matrix-questions',
        title: 'adminMatrixWorkspace.title',
        canDeactivate: [adminUnsavedChangesGuard],
        loadComponent: () =>
          import('./pages/matrix-questions-page/matrix-questions-page.component').then(
            (m) => m.MatrixQuestionsPageComponent,
          ),
      },
      {
        path: 'matrix-structure',
        title: 'adminMatrixStructure.title',
        canDeactivate: [adminUnsavedChangesGuard],
        loadComponent: () =>
          import('./pages/matrix-structure-page/matrix-structure-page.component').then(
            (m) => m.MatrixStructurePageComponent,
          ),
      },
      {
        path: 'matrix-questions/:id',
        title: 'matrix.modal.edit',
        canDeactivate: [adminUnsavedChangesGuard],
        loadComponent: () =>
          import('./pages/matrix-question-detail-page/matrix-question-detail-page.component').then(
            (m) => m.MatrixQuestionDetailPageComponent,
          ),
      },
      {
        path: 'matrix-question-queue',
        title: 'adminMatrixQueue.title',
        canDeactivate: [adminUnsavedChangesGuard],
        loadComponent: () =>
          import('./pages/matrix-question-queue-page/matrix-question-queue-page.component').then(
            (m) => m.MatrixQuestionQueuePageComponent,
          ),
      },
      {
        path: 'workspace/tools',
        pathMatch: 'full',
        redirectTo: '/admin-panel/dashboard',
      },
      {
        path: 'workspace/agent-clients',
        title: 'adminAgentClients.title',
        canActivate: [ownerGuard],
        canDeactivate: [adminUnsavedChangesGuard],
        loadComponent: () =>
          import('./pages/agent-clients-page/agent-clients-page.component').then(
            (m) => m.AgentClientsPageComponent,
          ),
      },
      {
        path: 'workspace/team',
        title: 'adminTeamWorkspace.title',
        canActivate: [teamGuard],
        canDeactivate: [adminUnsavedChangesGuard],
        loadComponent: () =>
          import('./pages/team-page/team-page.component').then((m) => m.TeamPageComponent),
      },
      {
        path: 'workspace/team/:username',
        title: 'adminTeamWorkspace.detailTitle',
        canActivate: [teamGuard],
        canDeactivate: [adminUnsavedChangesGuard],
        loadComponent: () =>
          import('./pages/team-member-detail-page/team-member-detail-page.component').then(
            (m) => m.TeamMemberDetailPageComponent,
          ),
      },
    ],
  },
];
