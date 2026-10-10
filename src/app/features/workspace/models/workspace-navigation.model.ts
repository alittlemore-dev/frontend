import type { IconName } from '@alittlemore.dev/design-system';

export interface WorkspaceNavigationPage {
  key: string;
  labelKey: string;
  route: string;
  icon?: IconName;
  badgeTextKey: string | null;
}

export interface WorkspaceNavigationSection {
  key: string;
  labelKey: string;
  pages: readonly WorkspaceNavigationPage[];
}
