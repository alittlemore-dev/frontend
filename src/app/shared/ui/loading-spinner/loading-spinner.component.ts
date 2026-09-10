import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="d-flex justify-content-center py-5" role="status" [attr.aria-label]="ariaLabel()">
      <div class="spinner-border text-primary"></div>
    </div>
  `,
})
export class LoadingSpinnerComponent {
  readonly ariaLabel = input.required<string>();
}
