import type { IconName } from '@alittlemore.dev/design-system';

export interface AdminPanelNavigationPage {
  key: string;
  labelKey: string;
  route: string;
  icon?: IconName;
  badgeTextKey: string | null;
  adminOnly: boolean;
  ownerOnly: boolean;
}

export interface AdminPanelNavigationSection {
  key: string;
  labelKey: string;
  pages: readonly AdminPanelNavigationPage[];
}
