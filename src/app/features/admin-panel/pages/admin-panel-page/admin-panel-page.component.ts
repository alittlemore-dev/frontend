import { SidebarComponent } from '@alittlemore.dev/design-system';
import { AuthModalService } from '../../../../core/auth/auth-modal.service';
import { SectionNavigationComponent } from '../../../../shared/ui/section-navigation/section-navigation.component';
import { NavigationPreferencesService } from '../../../../core/routing/navigation-preferences.service';
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
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ADMIN_PANEL_NAVIGATION_SECTIONS } from '../../admin-panel-navigation';
import { AdminPanelNavigationSection } from '../../models/admin-panel-navigation.model';

@Component({
  selector: 'app-admin-panel-page',
  standalone: true,
  imports: [SidebarComponent, SectionNavigationComponent, RouterOutlet, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-panel-page.component.html',
  styleUrl: './admin-panel-page.component.scss',
})
export class AdminPanelPageComponent {
  private readonly auth = inject(AuthService);
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
  readonly contextualNavigation = computed(() => {
    this.currentUrl();
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild !== null) route = route.firstChild;
    return route.data['adminDetail'] === true;
  });
  readonly visibleNavigationSections = computed<readonly AdminPanelNavigationSection[]>(() => {
    const canManageTeam = this.auth.canManageTeam();
    const isOwner = this.auth.isOwner();
    return ADMIN_PANEL_NAVIGATION_SECTIONS.map((section) => ({
      ...section,
      pages: section.pages.filter(
        (page) => (canManageTeam || !page.adminOnly) && (isOwner || !page.ownerOnly),
      ),
    })).filter((section) => section.pages.length > 0);
  });
  private readonly navigationPreferences = inject(NavigationPreferencesService);
  readonly navigationCollapsed = signal(this.navigationPreferences.collapsed('admin'));
  readonly home = {
    key: 'dashboard',
    labelKey: 'adminPanel.section.dashboard',
    route: '/admin-panel/dashboard',
    icon: 'dashboard' as const,
  };
  readonly selectedPageKey = computed<string | null>(() => {
    const path = this.currentUrl().split(/[?#]/u, 1)[0];
    if (path === '/admin-panel' || path === '/admin-panel/' || path === '/admin-panel/dashboard') {
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
  }

  setNavigationOpen(open: boolean): void {
    this.manualOpen.set(open);
    if (this.desktop() && !this.contextualNavigation()) {
      this.navigationCollapsed.set(!open);
      this.navigationPreferences.setCollapsed('admin', !open);
    }
  }
  onSectionSelected(): void {
    if (!this.desktop()) this.manualOpen.set(false);
  }
}
