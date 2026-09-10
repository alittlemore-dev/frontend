import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-dashboard-foldable-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-foldable-section.component.html',
  styleUrl: './dashboard-foldable-section.component.scss',
})
export class DashboardFoldableSectionComponent {
  readonly sectionKey = input.required<string>();
  readonly title = input.required<string>();
  readonly summary = input.required<string>();
  readonly expanded = input.required<boolean>();
  readonly expandedChange = output<boolean>();

  readonly bodyId = computed(() => `dashboard-section-body-${this.sectionKey()}`);

  toggle(): void {
    this.expandedChange.emit(!this.expanded());
  }
}
