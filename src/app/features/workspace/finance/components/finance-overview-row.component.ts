import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-finance-row-name',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './_finance-inline-input.scss',
  template: `
    @if (readOnly()) {
      <span>{{ value() }}</span>
    } @else {
      <input
        class="finance-inline-input finance-name-input"
        maxlength="255"
        [attr.id]="inputId()"
        [attr.aria-label]="label()"
        [placeholder]="creating() ? label() : ''"
        [ngModel]="value()"
        (ngModelChange)="changed.emit($event)"
        (blur)="!creating() && submitted.emit()"
        (keydown.enter)="$event.preventDefault(); submitted.emit()"
        [disabled]="disabled()"
      />
    }
    <ng-content />
  `,
})
export class FinanceRowNameComponent {
  readonly inputId = input<string | null>(null);
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly readOnly = input(false);
  readonly disabled = input(false);
  readonly creating = input(false);
  readonly changed = output<string>();
  readonly submitted = output<void>();
}

@Component({
  selector: 'app-finance-row-actions',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './finance-row-actions.component.scss',
  template: `
    @if (archived()) {
      <button
        type="button"
        class="finance-icon-button"
        [attr.aria-label]="'finance.restore' | t"
        [title]="'finance.restore' | t"
        [disabled]="disabled()"
        (click)="restore.emit()"
      >
        +
      </button>
    }
    <button
      type="button"
      class="finance-icon-button"
      [class.finance-icon-button-danger]="!creating()"
      [attr.aria-label]="label()"
      [title]="label()"
      [disabled]="disabled()"
      (click)="primary.emit()"
    >
      {{ creating() ? '+' : '−' }}
    </button>
  `,
})
export class FinanceRowActionsComponent {
  readonly label = input.required<string>();
  readonly creating = input(false);
  readonly archived = input(false);
  readonly disabled = input(false);
  readonly primary = output<void>();
  readonly restore = output<void>();
}
