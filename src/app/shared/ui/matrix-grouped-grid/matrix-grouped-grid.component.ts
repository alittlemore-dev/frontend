import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  ReadonlyMatrixQuestion,
  ReadonlyMatrixQuestionList,
  ReadonlyMatrixSectionGroup,
} from '../matrix-readonly.model';

const GRADE_RANK: ReadonlyMap<string, number> = new Map(
  ['Junior', 'Junior+', 'Middle', 'Middle+', 'Senior'].map((grade, index) => [grade, index]),
);

interface GridCell {
  grade: string | null;
  questions: ReadonlyMatrixQuestion[];
}

interface GridRow {
  section: ReadonlyMatrixSectionGroup;
  subsection: string;
  isFirstSubsection: boolean;
  sectionRowspan: number;
  cells: GridCell[];
}

@Component({
  selector: 'app-matrix-readonly-grouped-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './matrix-grouped-grid.component.html',
  styleUrl: './matrix-grouped-grid.component.scss',
})
export class MatrixGroupedGridComponent {
  readonly questions = input.required<ReadonlyMatrixQuestionList>();
  readonly sectionLabel = input.required<string>();
  readonly subsectionLabel = input.required<string>();
  readonly gradeLabels = input<Record<string, string>>({});
  readonly notSetLabel = input.required<string>();

  readonly questionSelected = output<string>();

  readonly grades = computed<(string | null)[]>(() => {
    const seen = new Set<string | null>();
    const result: (string | null)[] = [];
    for (const section of this.questions().sections) {
      for (const subsection of section.subsections) {
        for (const grade of subsection.grades) {
          if (!seen.has(grade.grade)) {
            seen.add(grade.grade);
            result.push(grade.grade);
          }
        }
      }
    }
    return result.sort(
      (left, right) =>
        (left === null ? GRADE_RANK.size : (GRADE_RANK.get(left) ?? GRADE_RANK.size)) -
        (right === null ? GRADE_RANK.size : (GRADE_RANK.get(right) ?? GRADE_RANK.size)),
    );
  });

  readonly rows = computed<GridRow[]>(() => {
    const gradeList = this.grades();
    const result: GridRow[] = [];
    for (const section of this.questions().sections) {
      for (let i = 0; i < section.subsections.length; i += 1) {
        const subsection = section.subsections[i];
        const cells: GridCell[] = gradeList.map((gradeName) => {
          const gradeGroup = subsection.grades.find((group) => group.grade === gradeName);
          return { grade: gradeName, questions: gradeGroup ? gradeGroup.questions : [] };
        });
        result.push({
          section,
          subsection: subsection.subsection,
          isFirstSubsection: i === 0,
          sectionRowspan: section.subsections.length,
          cells,
        });
      }
    }
    return result;
  });

  selectQuestion(slug: string): void {
    this.questionSelected.emit(slug);
  }

  gradeLabel(grade: string | null): string {
    return grade === null ? this.notSetLabel() : (this.gradeLabels()[grade] ?? grade);
  }
}
