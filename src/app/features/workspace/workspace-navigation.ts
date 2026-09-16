import { WorkspaceNavigationSection } from './models/workspace-navigation.model';

export const WORKSPACE_NAVIGATION_SECTIONS: readonly WorkspaceNavigationSection[] = [
  {
    key: 'workspace',
    labelKey: 'workspace.section.workspace',
    pages: [
      {
        key: 'resumes',
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
        labelKey: 'workspace.section.people',
        route: '/personal-workspace/knowledge/people',
        badgeTextKey: null,
      },
      {
        key: 'knowledge-dates',
        labelKey: 'workspace.section.dates',
        route: '/personal-workspace/knowledge/dates',
        badgeTextKey: null,
      },
    ],
  },
];
