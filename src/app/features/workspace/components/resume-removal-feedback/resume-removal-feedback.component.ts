import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-resume-removal-feedback',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="feedback" role="status" data-testid="resume-removal-feedback">
    <span>{{ 'resumeWorkspace.editor.removed' | t: { count: count() } }}</span>
    <button
      type="button"
      class="btn btn-link btn-sm text-decoration-none"
      [disabled]="disabled()"
      (click)="undo.emit()"
    >
      {{ 'resumeWorkspace.editor.undo' | t }}
    </button>
  </div>`,
  styles: `
    .feedback {
      position: fixed;
      bottom: 1rem;
      right: 1rem;
      z-index: 1040;
      display: flex;
      align-items: center;
      gap: 1rem;
      max-width: calc(100vw - 2rem);
      padding: 0.5rem 0.875rem;
      font-size: 0.875rem;
      background: var(--bs-body-bg);
      border: 1px solid var(--bs-border-color);
      border-radius: 0.5rem;
      box-shadow: var(--bs-box-shadow);
    }
  `,
})
export class ResumeRemovalFeedbackComponent {
  readonly count = input.required<number>();
  readonly disabled = input(false);
  readonly undo = output();
}
