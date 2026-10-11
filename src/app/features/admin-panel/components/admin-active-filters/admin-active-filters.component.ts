import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

export interface AdminActiveFilter {
  key: string;
  label: string;
  value: string;
}

@Component({
  selector: 'app-admin-active-filters',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    @if (filters().length > 0) {
      <div
        class="admin-active-filters"
        role="group"
        [attr.aria-label]="'adminCollection.activeFilters' | t"
      >
        @for (filter of filters(); track filter.key) {
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm"
            [attr.aria-label]="
              'adminCollection.removeFilter' | t: { name: filter.label, value: filter.value }
            "
            (click)="filterRemoved.emit(filter.key)"
          >
            <span>{{ filter.label }}: {{ filter.value }}</span
            ><span aria-hidden="true"> ×</span>
          </button>
        }
      </div>
    }
  `,
})
export class AdminActiveFiltersComponent {
  readonly filters = input.required<readonly AdminActiveFilter[]>();
  readonly filterRemoved = output<string>();
}
