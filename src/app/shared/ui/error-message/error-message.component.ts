import { Component, ChangeDetectionStrategy, computed, input, output } from '@angular/core';

export interface ErrorDisplay {
  message: string;
  location?: string | null;
  attr?: string | null;
  nested_errors?: readonly ErrorDisplay[];
}

export function errorDisplayMessages(error: ErrorDisplay): readonly string[] {
  const nestedMessages = flattenNestedErrorMessages(error);
  return nestedMessages.length > 0 ? nestedMessages : [formatErrorMessage(error)];
}

export function formatErrorMessage(error: ErrorDisplay): string {
  const context = readableErrorContext(error.attr ?? error.location ?? null);
  if (context === null) return error.message;
  return `${context}: ${error.message}`;
}

export function flattenNestedErrorMessages(error: ErrorDisplay): readonly string[] {
  const messages: string[] = [];
  appendNestedErrorMessages(error.nested_errors ?? [], messages);
  return messages;
}

function appendNestedErrorMessages(errors: readonly ErrorDisplay[], messages: string[]): void {
  for (const error of errors) {
    messages.push(formatErrorMessage(error));
    appendNestedErrorMessages(error.nested_errors ?? [], messages);
  }
}

function readableErrorContext(context: string | null): string | null {
  if (context === null || context.trim() === '') return null;

  const segments = context.split('.').filter((segment) => segment !== '');
  if (segments.length === 0) return null;

  const readableSegments: string[] = [];
  for (const segment of segments) {
    if (/^\d+$/.test(segment) && readableSegments.length > 0) {
      const lastIndex = readableSegments.length - 1;
      readableSegments[lastIndex] = `${readableSegments[lastIndex]} ${segment}`;
      continue;
    }
    readableSegments.push(segment);
  }
  return readableSegments.join(' / ');
}

@Component({
  selector: 'app-error-message',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="alert alert-danger d-flex align-items-center justify-content-between" role="alert">
      <div class="flex-grow-1">
        @if (nestedMessages().length > 0) {
          <ul class="mb-0 ps-3">
            @for (message of nestedMessages(); track $index) {
              <li>{{ message }}</li>
            }
          </ul>
        } @else {
          <span>{{ topLevelMessage() }}</span>
        }
      </div>
      <button type="button" class="btn btn-sm btn-outline-danger ms-3" (click)="retry.emit()">
        {{ retryLabel() }}
      </button>
    </div>
  `,
})
export class ErrorMessageComponent {
  readonly error = input.required<ErrorDisplay>();
  readonly retryLabel = input.required<string>();
  readonly retry = output<void>();
  readonly nestedMessages = computed(() => flattenNestedErrorMessages(this.error()));
  readonly topLevelMessage = computed(() => formatErrorMessage(this.error()));
}
