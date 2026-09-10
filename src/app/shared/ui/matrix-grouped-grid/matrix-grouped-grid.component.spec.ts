import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatrixGroupedGridComponent } from './matrix-grouped-grid.component';
import { ReadonlyMatrixQuestionList } from '../matrix-readonly.model';

const questions: ReadonlyMatrixQuestionList = {
  sheetKey: 'python',
  sheet: 'Python',
  sections: [
    {
      section: 'Core',
      subsections: [
        {
          subsection: 'Syntax',
          grades: [
            {
              grade: 'Junior',
              questions: [
                {
                  slug: 'pep-8',
                  question: 'What is PEP 8?',
                  interviewFrequency: 'often',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe('MatrixGroupedGridComponent', () => {
  let fixture: ComponentFixture<MatrixGroupedGridComponent>;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatrixGroupedGridComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MatrixGroupedGridComponent);
    fixture.componentRef.setInput('questions', questions);
    fixture.componentRef.setInput('sectionLabel', 'Section');
    fixture.componentRef.setInput('subsectionLabel', 'Subsection');
    fixture.componentRef.setInput('notSetLabel', 'Not set');
    fixture.componentRef.setInput('gradeLabels', { Junior: 'Junior' });
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  it('renders table headings and question buttons', () => {
    expect(el.textContent).toContain('Section');
    expect(el.textContent).toContain('Subsection');
    expect(el.textContent).toContain('Junior');
    expect(el.textContent).toContain('What is PEP 8?');
    expect(el.textContent).not.toContain('often');
    expect(el.querySelector('.badge')).toBeNull();
  });

  it('renders grade columns in ascending competency order', () => {
    fixture.componentRef.setInput('questions', {
      sheetKey: 'python',
      sheet: 'Python',
      sections: [
        {
          section: 'Core',
          subsections: [
            {
              subsection: 'Sequences',
              grades: [
                { grade: 'Junior+', questions: [] },
                { grade: 'Middle+', questions: [] },
              ],
            },
            {
              subsection: 'Functions',
              grades: [
                { grade: 'Junior', questions: [] },
                { grade: 'Middle', questions: [] },
                { grade: 'Senior', questions: [] },
              ],
            },
          ],
        },
      ],
    } satisfies ReadonlyMatrixQuestionList);
    fixture.detectChanges();

    const headings = Array.from(
      el.querySelectorAll<HTMLTableCellElement>('[data-testid="matrix-desktop-table"] thead th'),
      (heading) => heading.textContent?.trim(),
    );

    expect(headings).toEqual([
      'Section',
      'Subsection',
      'Junior',
      'Junior+',
      'Middle',
      'Middle+',
      'Senior',
    ]);
  });

  it('renders mobile cards with section, subsection, grade, and question context', () => {
    const card = el.querySelector('[data-testid="matrix-mobile-card"]') as HTMLElement | null;

    expect(card).not.toBeNull();
    expect(card?.textContent).toContain('Section');
    expect(card?.textContent).toContain('Core');
    expect(card?.textContent).toContain('Subsection');
    expect(card?.textContent).toContain('Syntax');
    expect(card?.textContent).toContain('Junior');
    expect(card?.textContent).toContain('What is PEP 8?');
  });

  it('emits selected question slugs from mobile card question buttons', () => {
    const emitted: string[] = [];
    fixture.componentInstance.questionSelected.subscribe((slug) => emitted.push(slug));

    el.querySelector<HTMLButtonElement>('[data-testid="matrix-mobile-question"]')?.click();

    expect(emitted).toEqual(['pep-8']);
  });

  it('emits selected question slugs', () => {
    const emitted: string[] = [];
    fixture.componentInstance.questionSelected.subscribe((slug) => emitted.push(slug));

    el.querySelector<HTMLButtonElement>('button')?.click();

    expect(emitted).toEqual(['pep-8']);
  });
});
