import {
  MatrixQuestionTranslationField,
  MatrixQuestionTranslationPackageField,
} from './matrix-question-translation.model';
import {
  matrixQuestionTranslationFieldKey,
  normalizeMatrixQuestionTranslationContent,
  previewMatrixQuestionTranslationPackage,
  serializeMatrixQuestionTranslationPackage,
} from './matrix-question-translation-package';

const markdownSource = [
  '## Ответ',
  '',
  '```python',
  'print("hello")',
  '```',
  '',
  'Используйте `Protocol`: https://docs.python.org/3/library/typing.html',
  'и [[articles:python-typing|статью]], а затем [[matrix:python|матрицу]].',
].join('\n');

const markdownTranslation = [
  '## Answer',
  '',
  '```python',
  'print("hello")',
  '```',
  '',
  'Use `Protocol`: https://docs.python.org/3/library/typing.html',
  'read the [[articles:python-typing|article]], then the [[matrix:python|matrix]].',
].join('\n');

const fields: readonly MatrixQuestionTranslationField[] = [
  {
    scope: 'question',
    fieldId: 'question',
    source: 'Что такое Protocol?',
    translation: 'What is Protocol?',
    editable: true,
    required: true,
    maxLength: 255,
  },
  {
    scope: 'question',
    fieldId: 'answer',
    source: markdownSource,
    translation: markdownTranslation,
    editable: true,
    required: true,
    maxLength: 20_000,
  },
  {
    scope: 'resource',
    resourceId: 'resource-1',
    fieldId: 'name',
    resourceLabel: 'Документация Python',
    resourceUrl: 'https://docs.python.org',
    source: 'Документация Python',
    translation: 'Python documentation',
    editable: false,
    required: false,
    maxLength: 255,
  },
  {
    scope: 'resource',
    resourceId: 'new--1',
    fieldId: 'context',
    resourceLabel: 'Новый ресурс',
    resourceUrl: 'https://example.com',
    source: 'Прочитать раздел typing',
    translation: '',
    editable: true,
    required: false,
    maxLength: 20_000,
  },
];

describe('matrix question translation package', () => {
  it('normalizes Unicode, line endings, and line-edge whitespace without folding case', () => {
    expect(normalizeMatrixQuestionTranslationContent('  cafe\u0301  \r\n value\t\r\n')).toBe(
      'café\nvalue',
    );
    expect(normalizeMatrixQuestionTranslationContent('HTTP')).not.toBe(
      normalizeMatrixQuestionTranslationContent('http'),
    );
  });

  it('serializes raw Markdown and stable field/resource identifiers without altering values', () => {
    const serialized = serializeMatrixQuestionTranslationPackage(fields);
    const parsed = JSON.parse(serialized) as {
      schema: string;
      version: number;
      sourceLanguage: string;
      targetLanguage: string;
      fields: MatrixQuestionTranslationPackageField[];
    };

    expect(parsed).toEqual(
      expect.objectContaining({
        schema: 'matrix-question-translation',
        version: 1,
        sourceLanguage: 'ru',
        targetLanguage: 'en',
      }),
    );
    expect(parsed.fields).toEqual(fields.map((field) => packageField(field, field.translation)));
    expect(parsed.fields[1].source).toBe(markdownSource);
    expect(parsed.fields[1].translation).toBe(markdownTranslation);
  });

  it('accepts a partial plain or fenced package and preserves protected Markdown tokens', () => {
    const importedField = packageField(
      fields[1],
      markdownTranslation.replace('## Answer', '## EN'),
    );
    const plain = packageText([importedField]);
    const fenced = `\n\`\`\`json\n${plain}\n\`\`\`\n`;

    const plainPreview = previewMatrixQuestionTranslationPackage(plain, fields);
    const fencedPreview = previewMatrixQuestionTranslationPackage(fenced, fields);

    expect(plainPreview).toEqual(fencedPreview);
    expect(plainPreview.ok).toBe(true);
    if (!plainPreview.ok) return;
    expect(plainPreview.rows).toEqual([
      expect.objectContaining({
        key: 'question:answer',
        status: 'changed',
        selectable: true,
        importedTranslation: markdownTranslation.replace('## Answer', '## EN'),
      }),
    ]);
  });

  it.each([
    {
      description: 'fenced code',
      translation: markdownTranslation.replace('print("hello")', 'print("translated")'),
    },
    {
      description: 'inline code',
      translation: markdownTranslation.replace('`Protocol`', '`TranslatedProtocol`'),
    },
    {
      description: 'fenced code delimiters',
      translation: markdownTranslation.split('```').join('~~~'),
    },
    {
      description: 'URL',
      translation: markdownTranslation.replace('https://docs.python.org', 'https://example.com'),
    },
    {
      description: 'typed wiki target',
      translation: markdownTranslation.replace('articles:python-typing', 'matrix:python-typing'),
    },
  ])('rejects a translation that changes protected $description', ({ translation }) => {
    const preview = previewMatrixQuestionTranslationPackage(
      packageText([packageField(fields[1], translation)]),
      fields,
    );

    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.rows[0]).toEqual(
      expect.objectContaining({
        status: 'invalid',
        selectable: false,
        issues: ['protectedContentChanged'],
      }),
    );
  });

  it('classifies stale, duplicate, read-only, unchanged, empty, oversized, and unknown rows', () => {
    const stale = { ...packageField(fields[0], 'Changed'), source: 'Другой вопрос' };
    const duplicate = packageField(fields[1], 'Changed answer');
    const readOnly = packageField(fields[2], 'Changed globally');
    const unchanged = packageField(fields[0], fields[0].translation);
    const empty = packageField(fields[3], '');
    const oversized = packageField(fields[0], 'x'.repeat(256));
    const unknown: MatrixQuestionTranslationPackageField = {
      scope: 'resource',
      resourceId: 'missing-resource',
      fieldId: 'context',
      source: 'Source',
      translation: 'Translation',
      editable: true,
    };

    const previews = [
      [stale],
      [duplicate, duplicate],
      [readOnly],
      [unchanged],
      [empty],
      [oversized],
      [unknown],
    ].map((packageFields) =>
      previewMatrixQuestionTranslationPackage(packageText(packageFields), fields),
    );
    expect(previews.every((preview) => preview.ok)).toBe(true);
    const rows = previews.flatMap((preview) => (preview.ok ? preview.rows : []));
    expect(rows.map(({ status }) => status)).toEqual([
      'stale',
      'invalid',
      'invalid',
      'readOnly',
      'unchanged',
      'invalid',
      'invalid',
      'invalid',
    ]);
    expect(rows[1].issues).toEqual(['duplicateField']);
    expect(rows[5].issues).toEqual(['emptyTranslation']);
    expect(rows[6].issues).toEqual(['translationTooLong']);
    expect(rows[7].issues).toEqual(['unknownField']);
  });

  it.each([
    ['not json', 'invalidJson'],
    [JSON.stringify({ schema: 'other', version: 1, fields: [] }), 'invalidEnvelope'],
    [
      JSON.stringify({
        schema: 'matrix-question-translation',
        version: 2,
        sourceLanguage: 'ru',
        targetLanguage: 'en',
        task: 'translate',
        fields: [],
      }),
      'unsupportedVersion',
    ],
    [
      JSON.stringify({
        schema: 'matrix-question-translation',
        version: 1,
        sourceLanguage: 'en',
        targetLanguage: 'ru',
        task: 'translate',
        fields: [],
      }),
      'invalidLanguageDirection',
    ],
  ])('rejects an invalid package envelope', (value, expectedError) => {
    expect(previewMatrixQuestionTranslationPackage(value, fields)).toEqual({
      ok: false,
      error: expectedError,
    });
  });

  it('builds stable keys for question and resource fields', () => {
    expect(matrixQuestionTranslationFieldKey(fields[0])).toBe('question:question');
    expect(matrixQuestionTranslationFieldKey(fields[2])).toBe('resource:resource-1:name');
  });
});

function packageField(
  field: MatrixQuestionTranslationField,
  translation: string,
): MatrixQuestionTranslationPackageField {
  return field.scope === 'question'
    ? {
        scope: field.scope,
        fieldId: field.fieldId,
        source: field.source,
        translation,
        editable: field.editable,
      }
    : {
        scope: field.scope,
        resourceId: field.resourceId,
        fieldId: field.fieldId,
        source: field.source,
        translation,
        editable: field.editable,
      };
}

function packageText(packageFields: readonly MatrixQuestionTranslationPackageField[]): string {
  return JSON.stringify({
    schema: 'matrix-question-translation',
    version: 1,
    sourceLanguage: 'ru',
    targetLanguage: 'en',
    task: 'translate',
    fields: packageFields,
  });
}
