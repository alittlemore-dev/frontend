import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';
import { DropdownComponent } from '@alittlemore.dev/design-system';

export interface DropdownAction {
  id: string;
  label: string;
  destructive: boolean;
  disabled: boolean;
}

@Component({
  selector: 'app-actions-dropdown',
  standalone: true,
  imports: [DropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (availableActions().length > 0) {
      <ds-dropdown [id]="menuId()" [label]="ariaLabel()">
        <span dsDropdownTrigger>{{ buttonLabel() }}</span>
        @for (action of availableActions(); track action.id) {
          <button
            type="button"
            class="dropdown-item"
            [class.text-danger]="action.destructive"
            [attr.aria-label]="
              action.destructive ? action.label + ', ' + destructiveActionLabel() : action.label
            "
            [attr.data-testid]="testId() + '-' + action.id"
            (click)="select(action)"
          >
            {{ action.label }}
          </button>
        }
      </ds-dropdown>
    }
  `,
})
export class ActionsDropdownComponent {
  private readonly dropdown = viewChild(DropdownComponent);
  readonly actions = input.required<readonly DropdownAction[]>();
  readonly buttonLabel = input.required<string>();
  readonly ariaLabel = input.required<string>();
  readonly destructiveActionLabel = input.required<string>();
  readonly testId = input.required<string>();
  readonly actionSelected = output<string>();
  readonly availableActions = computed(() => this.actions().filter((action) => !action.disabled));
  readonly menuId = computed(() => `${this.testId()}-menu`);

  select(action: DropdownAction): void {
    if (action.disabled) return;
    this.dropdown()?.close();
    this.actionSelected.emit(action.id);
  }
}
