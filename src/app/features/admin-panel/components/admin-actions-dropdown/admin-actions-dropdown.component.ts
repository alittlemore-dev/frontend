import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

export interface AdminAction {
  id: string;
  label: string;
  destructive: boolean;
  disabled: boolean;
}

@Component({
  selector: 'app-admin-actions-dropdown',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: inline-block;
    }

    .dropdown-menu[popover] {
      position: fixed;
      inset: auto;
      z-index: 1055;
      margin: var(--bs-dropdown-spacer) 0;
      max-inline-size: calc(100vw - 2rem);
      max-block-size: calc(100vh - 2rem);
      max-block-size: calc(100dvh - 2rem);
      overflow-y: auto;
      position-area: block-end span-inline-start;
      position-try-fallbacks:
        flip-block,
        flip-inline,
        flip-block flip-inline;
    }

    .dropdown-menu[popover]:popover-open {
      display: block;
    }
  `,
  template: `
    @if (availableActions().length > 0) {
      <div class="dropdown">
        <button
          type="button"
          class="btn btn-outline-secondary btn-sm dropdown-toggle"
          [attr.aria-expanded]="open()"
          [attr.aria-label]="ariaLabel()"
          [attr.popovertarget]="menuId()"
          popovertargetaction="toggle"
          [attr.data-testid]="testId() + '-toggle'"
        >
          {{ buttonLabel() }}
        </button>
        <ul
          #menu
          [id]="menuId()"
          popover="auto"
          class="dropdown-menu dropdown-menu-end"
          [attr.data-testid]="testId() + '-menu'"
          (toggle)="onToggle($event)"
        >
          @for (action of availableActions(); track action.id) {
            <li>
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
            </li>
          }
        </ul>
      </div>
    }
  `,
})
export class AdminActionsDropdownComponent {
  private readonly menu = viewChild<ElementRef<HTMLElement>>('menu');

  readonly actions = input.required<readonly AdminAction[]>();
  readonly buttonLabel = input.required<string>();
  readonly ariaLabel = input.required<string>();
  readonly destructiveActionLabel = input.required<string>();
  readonly testId = input.required<string>();
  readonly actionSelected = output<string>();
  readonly availableActions = computed(() => this.actions().filter((action) => !action.disabled));
  readonly menuId = computed(() => `${this.testId()}-menu`);
  readonly open = signal(false);

  @HostListener('window:resize')
  @HostListener('window:scroll')
  onViewportChange(): void {
    this.close();
  }

  onToggle(event: ToggleEvent): void {
    this.open.set(event.newState === 'open');
  }

  close(): void {
    const menu = this.menu()?.nativeElement;
    if (this.open() && typeof menu?.hidePopover === 'function') {
      menu.hidePopover();
    }
    this.open.set(false);
  }

  select(action: AdminAction): void {
    if (action.disabled) return;
    this.close();
    this.actionSelected.emit(action.id);
  }
}
