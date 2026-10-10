import { SidebarComponent } from '@alittlemore.dev/design-system';
import { AuthModalService } from '../../../../core/auth/auth-modal.service';
import { SectionNavigationComponent } from '../../../../shared/ui/section-navigation/section-navigation.component';
import { NavigationPreferencesService } from '../../../../core/routing/navigation-preferences.service';
import { WorkspaceDetailNavigationService } from '../../services/workspace-detail-navigation.service';
import { BreakpointObserver } from '@angular/cdk/layout';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, PRIMARY_OUTLET, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { WORKSPACE_NAVIGATION_SECTIONS } from '../../workspace-navigation';
import { WorkspaceNavigationSection } from '../../models/workspace-navigation.model';

@Component({
  selector: 'app-workspace-page',
  standalone: true,
  imports: [SidebarComponent, SectionNavigationComponent, RouterOutlet, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workspace-page.component.html',
  styleUrl: './workspace-page.component.scss',
})
export class WorkspacePageComponent {
  private readonly router = inject(Router);
  private readonly desktop = toSignal(
    inject(BreakpointObserver)
      .observe('(min-width: 768px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );
  private readonly authModal = inject(AuthModalService);
  private readonly manualOpen = signal<boolean | null>(null);
  readonly navigationOpen = computed(
    () =>
      this.manualOpen() ??
      (this.desktop() && !this.contextualNavigation() && !this.navigationCollapsed()),
  );
  readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  readonly contextualNavigation = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.hasContextualNavigation()),
    ),
    { initialValue: this.hasContextualNavigation() },
  );
  readonly visibleNavigationSections = computed<readonly WorkspaceNavigationSection[]>(
    () => WORKSPACE_NAVIGATION_SECTIONS,
  );
  private readonly navigationPreferences = inject(NavigationPreferencesService);
  readonly navigationCollapsed = signal(this.navigationPreferences.collapsed('workspace'));
  readonly home = {
    key: 'dashboard',
    labelKey: 'workspace.section.dashboard',
    route: '/personal-workspace',
    icon: 'dashboard' as const,
  };
  readonly selectedPageKey = computed<string | null>(() => {
    const path = this.currentUrl().split(/[?#]/u, 1)[0];
    if (path === '/personal-workspace') {
      return 'dashboard';
    }
    const pages = this.visibleNavigationSections().flatMap((section) => section.pages);
    return (
      pages
        .filter((page) => path === page.route || path.startsWith(`${page.route}/`))
        .sort((left, right) => right.route.length - left.route.length)[0]?.key ?? null
    );
  });

  constructor() {
    effect(() => {
      this.currentUrl();
      this.desktop();
      this.authModal.isLoginOpen();
      untracked(() => this.manualOpen.set(null));
    });
    inject(WorkspaceDetailNavigationService);
  }

  private hasContextualNavigation(): boolean {
    let route = this.router.routerState.snapshot.root;
    let child = route.children.find((item) => item.outlet === PRIMARY_OUTLET);
    while (child !== undefined) {
      route = child;
      child = route.children.find((item) => item.outlet === PRIMARY_OUTLET);
    }
    return route.data['workspaceNavigation'] === 'contextual';
  }

  setNavigationOpen(open: boolean): void {
    this.manualOpen.set(open);
    if (this.desktop() && !this.contextualNavigation()) {
      this.navigationCollapsed.set(!open);
      this.navigationPreferences.setCollapsed('workspace', !open);
    }
  }
  onSectionSelected(): void {
    if (!this.desktop()) this.manualOpen.set(false);
  }
}
