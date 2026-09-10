import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="text-center py-5 text-muted">
      <p class="mb-0">{{ message() }}</p>
    </div>
  `,
})
export class EmptyStateComponent {
  readonly message = input<string>('');
}
