import { AdminPanelNavigationSection } from './models/admin-panel-navigation.model';

export const ADMIN_PANEL_NAVIGATION_SECTIONS: readonly AdminPanelNavigationSection[] = [
  {
    key: 'workspace',
    labelKey: 'adminPanel.section.workspace',
    pages: [
      {
        key: 'team',
        labelKey: 'adminPanel.section.team',
        route: '/admin-panel/workspace/team',
        badgeTextKey: null,
        adminOnly: true,
        ownerOnly: false,
      },
      {
        key: 'agent-clients',
        labelKey: 'adminPanel.section.agentClients',
        route: '/admin-panel/workspace/agent-clients',
        badgeTextKey: null,
        adminOnly: false,
        ownerOnly: true,
      },
    ],
  },
  {
    key: 'articles',
    labelKey: 'adminPanel.section.articles',
    pages: [
      {
        key: 'articles',
        labelKey: 'shell.nav.articles',
        route: '/admin-panel/articles',
        badgeTextKey: null,
        adminOnly: false,
        ownerOnly: false,
      },
      {
        key: 'article-folders',
        labelKey: 'adminPanel.section.articleFolders',
        route: '/admin-panel/article-folders',
        badgeTextKey: null,
        adminOnly: false,
        ownerOnly: false,
      },
      {
        key: 'article-tags',
        labelKey: 'adminPanel.section.articleTags',
        route: '/admin-panel/article-tags',
        badgeTextKey: null,
        adminOnly: false,
        ownerOnly: false,
      },
      {
        key: 'article-statistics',
        labelKey: 'articles.stats.button',
        route: '/admin-panel/article-statistics',
        badgeTextKey: null,
        adminOnly: false,
        ownerOnly: false,
      },
    ],
  },
  {
    key: 'matrix',
    labelKey: 'shell.nav.matrix',
    pages: [
      {
        key: 'matrix-questions',
        labelKey: 'adminPanel.section.matrixQuestions',
        route: '/admin-panel/matrix-questions',
        badgeTextKey: null,
        adminOnly: false,
        ownerOnly: false,
      },
      {
        key: 'matrix-structure',
        labelKey: 'adminPanel.section.matrixStructure',
        route: '/admin-panel/matrix-structure',
        badgeTextKey: null,
        adminOnly: false,
        ownerOnly: false,
      },
      {
        key: 'matrix-question-queue',
        labelKey: 'adminPanel.section.matrixQuestionQueue',
        route: '/admin-panel/matrix-question-queue',
        badgeTextKey: null,
        adminOnly: false,
        ownerOnly: false,
      },
    ],
  },
];
