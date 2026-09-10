import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-admin-remove-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: inline-flex;
    }

    button {
      display: inline-flex;
      width: 1.75rem;
      height: 1.75rem;
      align-items: center;
      justify-content: center;
      padding: 0;
      color: var(--bs-danger-text-emphasis);
      background-color: var(--bs-danger-bg-subtle);
      border: var(--bs-border-width) solid var(--bs-danger-border-subtle);
      font-size: 1.15rem;
      font-weight: 700;
      line-height: 1;
    }

    button:hover:not(:disabled),
    button:focus-visible {
      color: var(--bs-white);
      background-color: var(--bs-danger);
      border-color: var(--bs-danger);
    }
  `,
  template: `
    <button
      type="button"
      class="btn btn-sm rounded-circle"
      [disabled]="disabled()"
      [attr.aria-label]="ariaLabel()"
      [attr.title]="ariaLabel()"
      [attr.data-testid]="testId()"
      (click)="remove.emit()"
    >
      <span aria-hidden="true">−</span>
    </button>
  `,
})
export class AdminRemoveButtonComponent {
  readonly ariaLabel = input.required<string>();
  readonly testId = input.required<string>();
  readonly disabled = input.required<boolean>();
  readonly remove = output<void>();
}
