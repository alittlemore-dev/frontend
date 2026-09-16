import { NgTemplateOutlet } from '@angular/common';
import { BreakpointObserver } from '@angular/cdk/layout';
import { AuthModalService } from '../../../../core/auth/auth-modal.service';
import {
  DrawerComponent,
  FoldableTreeComponent,
  FoldableTreeItem,
  FoldableTreeSection,
} from '@alittlemore.dev/design-system';
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

import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { WORKSPACE_NAVIGATION_SECTIONS } from '../../workspace-navigation';
import { WorkspaceNavigationSection } from '../../models/workspace-navigation.model';

@Component({
  selector: 'app-workspace-page',
  standalone: true,
  imports: [DrawerComponent, FoldableTreeComponent, NgTemplateOutlet, RouterOutlet, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workspace-page.component.html',
  styleUrl: './workspace-page.component.scss',
})
export class WorkspacePageComponent {
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
  readonly visibleNavigationSections = computed<readonly WorkspaceNavigationSection[]>(
    () => WORKSPACE_NAVIGATION_SECTIONS,
  );
  readonly defaultExpandedSectionKeys = computed<readonly string[]>(() =>
    this.visibleNavigationSections().map((section) => section.key),
  );
  readonly sidePanelToggleLabel = computed(() =>
    this.i18n.translate(
      this.sidePanelOpen() ? 'workspace.sidePanel.close' : 'workspace.sidePanel.open',
    ),
  );
  readonly rootItems = computed<readonly FoldableTreeItem[]>(() => {
    this.i18n.language();
    return [
      {
        key: 'dashboard',
        label: this.i18n.translate('workspace.section.dashboard'),
        badgeText: null,
      },
    ];
  });
  readonly sections = computed<readonly FoldableTreeSection[]>(() => {
    this.i18n.language();
    return this.visibleNavigationSections().map((section) => ({
      key: section.key,
      label: this.i18n.translate(section.labelKey),
      trailingText: String(section.pages.length),
      items: section.pages.map((page) => ({
        key: page.key,
        label: this.i18n.translate(page.labelKey),
        badgeText: page.badgeTextKey === null ? null : this.i18n.translate(page.badgeTextKey),
      })),
    }));
  });
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
      this.router.navigateByUrl('/personal-workspace');
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
