import { MatrixQuestionTranslationField } from './matrix-question-translation.model';
import {
  MatrixQuestionReadinessInput,
  analyzeMatrixQuestionReadiness,
  matrixQuestionTranslationFieldSignature,
} from './matrix-question-readiness.model';

describe('analyzeMatrixQuestionReadiness', () => {
  it('separates empty-form draft blockers, publication blockers, and advisory warnings', () => {
    const analysis = analyzeMatrixQuestionReadiness(
      readinessInput({
        invalidFields: new Set(['slug', 'subsectionId', 'questionRu', 'questionEn']),
      }),
    );

    expect(analysis.completedRequired).toBe(0);
    expect(analysis.totalRequired).toBe(9);
    expect(analysis.draftBlockerCount).toBe(4);
    expect(analysis.publicationBlockerCount).toBe(5);
    expect(analysis.warningCount).toBe(2);
    expect(analysis.canSaveDraft).toBe(false);
    expect(analysis.canPublish).toBe(false);
  });

  it('allows a valid minimum draft while keeping publication-only fields blocked', () => {
    const analysis = analyzeMatrixQuestionReadiness(
      readinessInput({
        slug: 'dependency-injection',
        subsectionId: 'subsection-1',
        fields: questionFields({ questionRu: 'Что такое DI?', questionEn: 'What is DI?' }),
      }),
    );

    expect(analysis.completedRequired).toBe(4);
    expect(analysis.draftBlockerCount).toBe(0);
    expect(analysis.publicationBlockerCount).toBe(5);
    expect(analysis.canSaveDraft).toBe(true);
    expect(analysis.canPublish).toBe(false);
  });

  it('treats optional health warnings as non-blocking for a complete publication', () => {
    const analysis = analyzeMatrixQuestionReadiness(
      readinessInput({
        slug: 'dependency-injection',
        subsectionId: 'subsection-1',
        grade: 'Middle',
        interviewFrequency: 'often',
        fields: completeQuestionFields(),
      }),
    );

    expect(analysis.completedRequired).toBe(9);
    expect(analysis.draftBlockerCount).toBe(0);
    expect(analysis.publicationBlockerCount).toBe(0);
    expect(analysis.warningCount).toBe(1);
    expect(analysis.canSaveDraft).toBe(true);
    expect(analysis.canPublish).toBe(true);
  });

  it('does not duplicate an invalid required publication field as a publication blocker', () => {
    const analysis = analyzeMatrixQuestionReadiness(
      readinessInput({
        slug: 'dependency-injection',
        subsectionId: 'subsection-1',
        grade: 'Middle',
        interviewFrequency: 'often',
        fields: completeQuestionFields(),
        invalidFields: new Set(['answerEn']),
        resources: [completeResource()],
      }),
    );

    expect(analysis.completedRequired).toBe(8);
    expect(analysis.draftBlockerCount).toBe(1);
    expect(analysis.publicationBlockerCount).toBe(0);
    expect(analysis.issues.filter((issue) => issue.fieldId === 'answerEn')).toHaveLength(1);
  });

  it('warns about missing resource contexts without making resources publication requirements', () => {
    const analysis = analyzeMatrixQuestionReadiness(
      readinessInput({
        slug: 'dependency-injection',
        subsectionId: 'subsection-1',
        grade: 'Middle',
        interviewFrequency: 'often',
        fields: [...completeQuestionFields(), ...resourceFields('', '')],
        resources: [
          {
            id: 'resource-1',
            label: 'Documentation',
            contextRu: '',
            contextEn: '',
          },
        ],
      }),
    );

    expect(analysis.completedRequired).toBe(9);
    expect(analysis.warningCount).toBe(2);
    expect(analysis.groups.find((group) => group.id === 'resources')?.issues).toHaveLength(2);
    expect(analysis.canPublish).toBe(true);
  });

  it('clears an identical-content warning only for the reviewed field signature', () => {
    const fields = completeQuestionFields({ questionEn: 'Что такое DI?' });
    const questionField = fields[0];
    const warningAnalysis = analyzeMatrixQuestionReadiness(
      readinessInput({
        slug: 'dependency-injection',
        subsectionId: 'subsection-1',
        grade: 'Middle',
        interviewFrequency: 'often',
        fields,
        resources: [completeResource()],
      }),
    );

    expect(warningAnalysis.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'identical:question:question', severity: 'warning' }),
      ]),
    );

    const reviewedAnalysis = analyzeMatrixQuestionReadiness(
      readinessInput({
        slug: 'dependency-injection',
        subsectionId: 'subsection-1',
        grade: 'Middle',
        interviewFrequency: 'often',
        fields,
        resources: [completeResource()],
        reviewedTranslationSignatures: new Map([
          ['question:question', matrixQuestionTranslationFieldSignature(questionField)],
        ]),
      }),
    );

    expect(reviewedAnalysis.issues.map((issue) => issue.id)).not.toContain(
      'identical:question:question',
    );
  });
});

function readinessInput(
  overrides: Partial<MatrixQuestionReadinessInput> = {},
): MatrixQuestionReadinessInput {
  return {
    slug: '',
    subsectionId: null,
    grade: null,
    interviewFrequency: null,
    fields: questionFields(),
    resources: [],
    invalidFields: new Set(),
    invalidResourceContextKeys: new Set(),
    reviewedTranslationSignatures: new Map(),
    ...overrides,
  };
}

function questionFields(
  values: {
    questionRu?: string;
    questionEn?: string;
    answerRu?: string;
    answerEn?: string;
    explanationRu?: string;
    explanationEn?: string;
  } = {},
): MatrixQuestionTranslationField[] {
  return [
    questionField('question', values.questionRu ?? '', values.questionEn ?? ''),
    questionField('answer', values.answerRu ?? '', values.answerEn ?? ''),
    questionField(
      'interviewAnswerExplanation',
      values.explanationRu ?? '',
      values.explanationEn ?? '',
    ),
  ];
}

function completeQuestionFields(
  overrides: { questionEn?: string } = {},
): MatrixQuestionTranslationField[] {
  return questionFields({
    questionRu: 'Что такое DI?',
    questionEn: overrides.questionEn ?? 'What is DI?',
    answerRu: 'Внедрение зависимостей.',
    answerEn: 'Dependency injection.',
    explanationRu: 'Проверяет понимание архитектуры.',
    explanationEn: 'Checks architecture knowledge.',
  });
}

function questionField(
  fieldId: 'question' | 'answer' | 'interviewAnswerExplanation',
  source: string,
  translation: string,
): MatrixQuestionTranslationField {
  return {
    scope: 'question',
    fieldId,
    source,
    translation,
    editable: true,
    required: true,
    maxLength: 20_000,
  };
}

function resourceFields(source: string, translation: string): MatrixQuestionTranslationField[] {
  return [
    {
      scope: 'resource',
      resourceId: 'resource-1',
      fieldId: 'name',
      resourceLabel: 'Documentation',
      resourceUrl: 'https://example.com',
      source: 'Документация',
      translation: 'Documentation',
      editable: false,
      required: false,
      maxLength: 255,
    },
    {
      scope: 'resource',
      resourceId: 'resource-1',
      fieldId: 'context',
      resourceLabel: 'Documentation',
      resourceUrl: 'https://example.com',
      source,
      translation,
      editable: true,
      required: false,
      maxLength: 20_000,
    },
  ];
}

function completeResource(): MatrixQuestionReadinessInput['resources'][number] {
  return {
    id: 'resource-1',
    label: 'Documentation',
    contextRu: 'Русский контекст',
    contextEn: 'English context',
  };
}
