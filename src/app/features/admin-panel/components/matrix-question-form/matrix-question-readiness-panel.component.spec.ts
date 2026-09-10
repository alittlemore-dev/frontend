import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { MatrixQuestionReadinessAnalysis } from './matrix-question-readiness.model';
import { MatrixQuestionReadinessPanelComponent } from './matrix-question-readiness-panel.component';

describe('MatrixQuestionReadinessPanelComponent', () => {
  let fixture: ComponentFixture<MatrixQuestionReadinessPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatrixQuestionReadinessPanelComponent],
      providers: [provideI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(MatrixQuestionReadinessPanelComponent);
    fixture.componentRef.setInput('analysis', analysis());
    fixture.detectChanges();
  });

  it('starts collapsed with the title and severity totals in the summary', () => {
    const panel = fixture.nativeElement.querySelector<HTMLElement>(
      '[data-testid="matrix-readiness-panel"]',
    );
    const toggle = panel?.querySelector<HTMLButtonElement>(
      '[data-testid="matrix-readiness-toggle"]',
    );
    const details = panel?.querySelector<HTMLElement>('[data-testid="matrix-readiness-details"]');

    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(toggle?.textContent).toContain('Готовность');
    expect(toggle?.querySelector('[data-severity="draftBlocker"]')?.textContent).toContain('1');
    expect(toggle?.querySelector('[data-severity="publicationBlocker"]')?.textContent).toContain(
      '1',
    );
    expect(toggle?.querySelector('[data-severity="warning"]')?.textContent).toContain('1');
    expect(details?.hidden).toBe(true);
  });

  it('reveals progress, groups, and issues when expanded', () => {
    const toggle = fixture.nativeElement.querySelector<HTMLButtonElement>(
      '[data-testid="matrix-readiness-toggle"]',
    );

    toggle?.click();
    fixture.detectChanges();

    const details = fixture.nativeElement.querySelector<HTMLElement>(
      '[data-testid="matrix-readiness-details"]',
    );
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(details?.hidden).toBe(false);
    expect(details?.textContent).toContain('4 / 9');
    expect(details?.querySelectorAll('[data-testid="matrix-readiness-group"]')).toHaveLength(4);
  });

  it('keeps every issue visible as a button and emits the selected item', () => {
    const emitted: string[] = [];
    fixture.componentInstance.itemSelected.subscribe((item) => emitted.push(item.id));
    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-readiness-toggle"]')
      ?.click();
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll<HTMLButtonElement>(
      '[data-testid="matrix-readiness-item"]',
    );

    expect(buttons).toHaveLength(3);
    buttons[1].click();

    expect(emitted).toEqual(['publicationBlocker:answerEn']);
  });
});

function analysis(): MatrixQuestionReadinessAnalysis {
  const issues: MatrixQuestionReadinessAnalysis['issues'] = [
    {
      id: 'draftBlocker:slug',
      groupId: 'structure',
      severity: 'draftBlocker',
      fieldId: 'slug',
      labelKey: 'matrix.readiness.field.slug',
      reasonKey: 'matrix.readiness.reason.requiredForDraft',
      target: { kind: 'field', fieldId: 'slug' },
    },
    {
      id: 'publicationBlocker:answerEn',
      groupId: 'en',
      severity: 'publicationBlocker',
      fieldId: 'answerEn',
      labelKey: 'matrix.readiness.field.answerEn',
      reasonKey: 'matrix.readiness.reason.requiredForPublication',
      target: { kind: 'field', fieldId: 'answerEn' },
    },
    {
      id: 'warning:resources',
      groupId: 'resources',
      severity: 'warning',
      fieldId: 'resources',
      labelKey: 'matrix.readiness.field.resources',
      reasonKey: 'matrix.readiness.reason.resourceRecommended',
      target: { kind: 'resourceSearch' },
    },
  ];
  return {
    completedRequired: 4,
    totalRequired: 9,
    draftBlockerCount: 1,
    publicationBlockerCount: 1,
    warningCount: 1,
    canSaveDraft: false,
    canPublish: false,
    issues,
    groups: [
      {
        id: 'structure',
        completedRequired: 2,
        totalRequired: 3,
        resourceCount: 0,
        issues: [issues[0]],
      },
      { id: 'ru', completedRequired: 2, totalRequired: 3, resourceCount: 0, issues: [] },
      { id: 'en', completedRequired: 0, totalRequired: 3, resourceCount: 0, issues: [issues[1]] },
      {
        id: 'resources',
        completedRequired: 0,
        totalRequired: 0,
        resourceCount: 0,
        issues: [issues[2]],
      },
    ],
  };
}
