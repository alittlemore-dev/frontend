import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { SiteSelectComponent, SiteSelectOption } from '@alittlemore.dev/design-system';

export interface ResumeEditorNavigationItem {
  readonly key: string;
  readonly label: string;
  readonly selectLabel: string;
  readonly count: number | null;
  readonly errors: number;
}

@Component({
  selector: 'app-resume-editor-navigation',
  imports: [SiteSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './resume-editor-navigation.component.html',
  styleUrl: './resume-editor-navigation.component.scss',
})
export class ResumeEditorNavigationComponent {
  readonly items = input.required<readonly ResumeEditorNavigationItem[]>();
  readonly activeKey = input.required<string>();
  readonly label = input.required<string>();
  readonly textLabel = input.required<string>();
  readonly textCount = input.required<number>();
  readonly textMax = input.required<number>();
  readonly textTitle = input.required<string>();
  readonly selected = output<string>();
  readonly options = computed<readonly SiteSelectOption[]>(() =>
    this.items().map((item) => ({ value: item.key, label: item.selectLabel })),
  );
  readonly invalid = computed(() =>
    this.items().some((item) => item.key === this.activeKey() && item.errors > 0),
  );
}
