import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import {
  NavigationComponent,
  type NavigationGroup,
  type NavigationItem,
  type NavigationSelection,
  type IconName,
} from '@alittlemore.dev/design-system';
import { I18nService } from '../../../core/i18n/i18n.service';

export interface SectionNavigationLink {
  key: string;
  labelKey: string;
  route: string;
  icon?: IconName;
}
export interface SectionNavigationGroup {
  key: string;
  labelKey: string;
  pages: readonly SectionNavigationLink[];
}
@Component({
  selector: 'app-section-navigation',
  imports: [NavigationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ds-navigation
    [id]="id()"
    [label]="label()"
    [rootItems]="rootItems()"
    [groups]="navigationGroups()"
    [selectedItemKey]="selectedKey()"
    [emptyMessage]="label()"
    (itemSelected)="select($event)"
  />`,
})
export class SectionNavigationComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  readonly id = input.required<string>();
  readonly label = input.required<string>();
  readonly home = input.required<SectionNavigationLink>();
  readonly groups = input.required<readonly SectionNavigationGroup[]>();
  readonly selectedKey = input<string | null>(null);
  readonly linkSelected = output<void>();
  readonly rootItems = computed<readonly NavigationItem[]>(() => {
    this.i18n.language();
    return [this.item(this.home())];
  });
  readonly navigationGroups = computed<readonly NavigationGroup[]>(() => {
    this.i18n.language();
    return this.groups().map((group) => ({
      key: group.key,
      label: this.i18n.translate(group.labelKey),
      items: group.pages.map((page) => this.item(page)),
    }));
  });
  select(selection: NavigationSelection): void {
    selection.event.preventDefault();
    void this.router.navigateByUrl(selection.item.href);
    this.linkSelected.emit();
  }
  private item(link: SectionNavigationLink): NavigationItem {
    return {
      key: link.key,
      label: this.i18n.translate(link.labelKey),
      href: link.route,
      icon: link.icon,
    };
  }
}
