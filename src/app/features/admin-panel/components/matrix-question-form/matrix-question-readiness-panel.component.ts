import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import {
  MatrixQuestionReadinessAnalysis,
  MatrixQuestionReadinessGroup,
  MatrixQuestionReadinessItem,
  MatrixQuestionReadinessSeverity,
} from './matrix-question-readiness.model';

@Component({
  selector: 'app-matrix-question-readiness-panel',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './matrix-question-readiness-panel.component.html',
  styles: [
    `
      .readiness-toggle:hover,
      .readiness-toggle:focus-visible {
        background: var(--bs-tertiary-bg);
      }

      .readiness-chevron {
        transition: transform 0.15s ease-in-out;
      }

      .readiness-chevron.expanded {
        transform: rotate(90deg);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatrixQuestionReadinessPanelComponent {
  readonly analysis = input.required<MatrixQuestionReadinessAnalysis>();
  readonly itemSelected = output<MatrixQuestionReadinessItem>();
  readonly expanded = signal(false);

  toggleDetails(): void {
    this.expanded.update((expanded) => !expanded);
  }

  groupTitleKey(group: MatrixQuestionReadinessGroup): string {
    return `matrix.readiness.group.${group.id}`;
  }

  severityLabelKey(severity: MatrixQuestionReadinessSeverity): string {
    return `matrix.readiness.severity.${severity}`;
  }

  severityBadgeClass(severity: MatrixQuestionReadinessSeverity): string {
    if (severity === 'draftBlocker') return 'badge text-bg-danger';
    if (severity === 'publicationBlocker') return 'badge text-bg-secondary';
    return 'badge text-bg-warning';
  }

  issueButtonClass(severity: MatrixQuestionReadinessSeverity): string {
    return severity === 'warning'
      ? 'btn btn-link text-warning-emphasis'
      : 'btn btn-link text-danger';
  }
}
