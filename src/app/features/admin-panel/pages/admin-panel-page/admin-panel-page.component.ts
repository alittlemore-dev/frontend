import { NgTemplateOutlet } from '@angular/common';
import { BreakpointObserver } from '@angular/cdk/layout';
import { AuthModalService } from '../../../../core/auth/auth-modal.service';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import {
  DrawerComponent,
  FoldableTreeComponent,
  FoldableTreeItem,
  FoldableTreeSection,
} from '@alittlemore.dev/design-system';
import { AuthService } from '../../../../core/auth/auth.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ADMIN_PANEL_NAVIGATION_SECTIONS } from '../../admin-panel-navigation';
import { AdminPanelNavigationSection } from '../../models/admin-panel-navigation.model';

@Component({
  selector: 'app-admin-panel-page',
  standalone: true,
  imports: [DrawerComponent, FoldableTreeComponent, NgTemplateOutlet, RouterOutlet, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-panel-page.component.html',
  styleUrl: './admin-panel-page.component.scss',
})
export class AdminPanelPageComponent {
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  private readonly drawer = viewChild(DrawerComponent);
  private readonly authModal = inject(AuthModalService);
  private readonly desktop = toSignal(
    inject(BreakpointObserver)
      .observe('(min-width: 992px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );
  readonly sidePanelOpen = computed(() => this.drawer()?.isOpen() ?? false);
  readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
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
  readonly defaultExpandedSectionKeys = computed<readonly string[]>(() =>
    this.visibleNavigationSections().map((section) => section.key),
  );
  readonly sidePanelToggleLabel = computed(() =>
    this.i18n.translate(
      this.sidePanelOpen() ? 'adminPanel.sidePanel.close' : 'adminPanel.sidePanel.open',
    ),
  );
  readonly rootItems = computed<readonly FoldableTreeItem[]>(() => {
    this.i18n.language();
    return [
      {
        key: 'dashboard',
        label: this.i18n.translate('adminPanel.section.dashboard'),
        badgeText: null,
      },
    ];
  });
  readonly sections = computed<readonly FoldableTreeSection[]>(() => {
    this.i18n.language();
    return this.visibleNavigationSections().map((section) => {
      const items = section.pages.map((page) => ({
        key: page.key,
        label: this.i18n.translate(page.labelKey),
        badgeText: page.badgeTextKey === null ? null : this.i18n.translate(page.badgeTextKey),
      }));
      return {
        key: section.key,
        label: this.i18n.translate(section.labelKey),
        trailingText: String(items.length),
        items,
      };
    });
  });
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
      if (this.desktop() || this.authModal.isLoginOpen()) this.closeSidePanel();
    });
  }

  toggleSidePanel(): void {
    if (this.sidePanelOpen()) this.closeSidePanel();
    else this.drawer()?.open();
  }

  closeSidePanel(): void {
    this.drawer()?.close();
  }

  selectPage(pageKey: string): void {
    if (pageKey === 'dashboard') {
      this.closeSidePanel();
      this.router.navigateByUrl('/admin-panel/dashboard');
      return;
    }
    const page = this.visibleNavigationSections()
      .flatMap((section) => section.pages)
      .find((item) => item.key === pageKey);
    if (!page) return;
    this.closeSidePanel();
    this.router.navigateByUrl(page.route);
  }
}
