import { WorkspaceNavigationSection } from './models/workspace-navigation.model';

export const WORKSPACE_NAVIGATION_SECTIONS: readonly WorkspaceNavigationSection[] = [
  {
    key: 'workspace',
    labelKey: 'workspace.section.workspace',
    pages: [
      {
        key: 'resumes',
        icon: 'document',
        labelKey: 'workspace.section.resumes',
        route: '/personal-workspace/resumes',
        badgeTextKey: null,
      },
    ],
  },
  {
    key: 'knowledge',
    labelKey: 'workspace.section.knowledge',
    pages: [
      {
        key: 'knowledge-people',
        icon: 'people',
        labelKey: 'workspace.section.people',
        route: '/personal-workspace/knowledge/people',
        badgeTextKey: null,
      },
      {
        key: 'knowledge-dates',
        icon: 'calendar',
        labelKey: 'workspace.section.dates',
        route: '/personal-workspace/knowledge/dates',
        badgeTextKey: null,
      },
      {
        key: 'events',
        icon: 'calendar',
        labelKey: 'workspaceEvents.title',
        route: '/personal-workspace/events',
        badgeTextKey: null,
      },
    ],
  },
  {
    key: 'finance',
    labelKey: 'finance.section',
    pages: [
      {
        key: 'finance-overview',
        labelKey: 'finance.overview',
        route: '/personal-workspace/finance',
        badgeTextKey: null,
      },
      {
        key: 'finance-statistics',
        labelKey: 'finance.statistics.title',
        route: '/personal-workspace/finance/statistics',
        badgeTextKey: null,
      },
    ],
  },
];
