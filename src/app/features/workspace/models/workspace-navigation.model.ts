export interface WorkspaceNavigationPage {
  key: string;
  labelKey: string;
  route: string;
  badgeTextKey: string | null;
}

export interface WorkspaceNavigationSection {
  key: string;
  labelKey: string;
  pages: readonly WorkspaceNavigationPage[];
}
