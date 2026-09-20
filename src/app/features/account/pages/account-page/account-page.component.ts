import { NgTemplateOutlet } from '@angular/common';
import { BreakpointObserver } from '@angular/cdk/layout';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { DrawerComponent } from '@alittlemore.dev/design-system';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-account-page',
  standalone: true,
  imports: [
    DrawerComponent,
    NgTemplateOutlet,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account-page.component.html',
  styleUrl: './account-page.component.scss',
})
export class AccountPageComponent {
  private readonly drawer = viewChild(DrawerComponent);
  private readonly i18n = inject(I18nService);
  private readonly desktop = toSignal(
    inject(BreakpointObserver)
      .observe('(min-width: 992px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  readonly sidePanelOpen = computed(() => this.drawer()?.isOpen() ?? false);
  readonly sidePanelToggleLabel = computed(() =>
    this.i18n.translate(
      this.sidePanelOpen() ? 'account.sidePanel.close' : 'account.sidePanel.open',
    ),
  );

  constructor() {
    effect(() => {
      if (this.desktop()) this.closeSidePanel();
    });
  }

  toggleSidePanel(): void {
    if (this.sidePanelOpen()) this.closeSidePanel();
    else this.drawer()?.open();
  }

  closeSidePanel(): void {
    this.drawer()?.close();
  }
}
