import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

export interface FoldableTreeItem {
  key: string;
  label: string;
  badgeText: string | null;
}

export interface FoldableTreeSection {
  key: string;
  label: string;
  trailingText: string | null;
  items: readonly FoldableTreeItem[];
}

interface FoldableTreeTitleTarget {
  kind: 'section' | 'rootItem' | 'item';
  key: string;
  label: string;
}

@Component({
  selector: 'app-foldable-tree',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './foldable-tree.component.html',
  styleUrl: './foldable-tree.component.scss',
})
export class FoldableTreeComponent {
  readonly rootItems = input.required<readonly FoldableTreeItem[]>();
  readonly sections = input.required<readonly FoldableTreeSection[]>();
  readonly emptyMessage = input.required<string>();
  readonly selectedItemKey = input.required<string | null>();
  readonly defaultExpandedSectionKeys = input.required<readonly string[]>();
  readonly sectionTestId = input.required<string>();
  readonly itemTestId = input.required<string>();
  readonly itemSelected = output<string>();

  private readonly defaultExpandedSectionKeySet = computed(
    () => new Set(this.defaultExpandedSectionKeys()),
  );
  readonly sectionExpansionOverrides = signal<ReadonlyMap<string, boolean>>(
    new Map<string, boolean>(),
  );
  readonly truncatedTitleTarget = signal<FoldableTreeTitleTarget | null>(null);

  isExpanded(sectionKey: string): boolean {
    return (
      this.sectionExpansionOverrides().get(sectionKey) ??
      this.defaultExpandedSectionKeySet().has(sectionKey)
    );
  }

  toggleSection(sectionKey: string): void {
    const expanded = !this.isExpanded(sectionKey);
    this.sectionExpansionOverrides.update((current) => {
      const next = new Map(current);
      next.set(sectionKey, expanded);
      return next;
    });
  }

  showConditionalTitle(
    kind: FoldableTreeTitleTarget['kind'],
    key: string,
    label: string,
    labelElement: HTMLElement,
  ): void {
    if (!this.isTextTruncated(labelElement)) {
      this.clearConditionalTitle(kind, key);
      return;
    }
    this.truncatedTitleTarget.set({ kind, key, label });
  }

  clearConditionalTitle(kind: FoldableTreeTitleTarget['kind'], key: string): void {
    const current = this.truncatedTitleTarget();
    if (current?.kind === kind && current.key === key) {
      this.truncatedTitleTarget.set(null);
    }
  }

  conditionalTitleFor(kind: FoldableTreeTitleTarget['kind'], key: string): string | null {
    const current = this.truncatedTitleTarget();
    if (current?.kind !== kind || current.key !== key) {
      return null;
    }
    return current.label;
  }

  private isTextTruncated(element: HTMLElement): boolean {
    return element.scrollWidth > element.clientWidth;
  }
}
