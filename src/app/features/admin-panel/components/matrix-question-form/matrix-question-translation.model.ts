export type MatrixQuestionTranslationQuestionFieldId =
  'question' | 'answer' | 'interviewAnswerExplanation';
export type MatrixQuestionTranslationResourceFieldId = 'name' | 'context';

interface MatrixQuestionTranslationFieldBase {
  source: string;
  translation: string;
  editable: boolean;
}

interface MatrixQuestionTranslationCurrentFieldBase extends MatrixQuestionTranslationFieldBase {
  required: boolean;
  maxLength: number;
}

export interface MatrixQuestionTranslationQuestionField extends MatrixQuestionTranslationCurrentFieldBase {
  scope: 'question';
  fieldId: MatrixQuestionTranslationQuestionFieldId;
}

export interface MatrixQuestionTranslationResourceField extends MatrixQuestionTranslationCurrentFieldBase {
  scope: 'resource';
  resourceId: string;
  fieldId: MatrixQuestionTranslationResourceFieldId;
  resourceLabel: string;
  resourceUrl: string;
}

export type MatrixQuestionTranslationField =
  MatrixQuestionTranslationQuestionField | MatrixQuestionTranslationResourceField;

export interface MatrixQuestionTranslationPackageQuestionField extends MatrixQuestionTranslationFieldBase {
  scope: 'question';
  fieldId: MatrixQuestionTranslationQuestionFieldId;
}

export interface MatrixQuestionTranslationPackageResourceField extends MatrixQuestionTranslationFieldBase {
  scope: 'resource';
  resourceId: string;
  fieldId: MatrixQuestionTranslationResourceFieldId;
}

export type MatrixQuestionTranslationPackageField =
  MatrixQuestionTranslationPackageQuestionField | MatrixQuestionTranslationPackageResourceField;

export type MatrixQuestionTranslationPreviewStatus =
  'changed' | 'unchanged' | 'invalid' | 'stale' | 'readOnly';

export type MatrixQuestionTranslationPreviewIssue =
  | 'unknownField'
  | 'duplicateField'
  | 'staleSource'
  | 'emptyTranslation'
  | 'translationTooLong'
  | 'protectedContentChanged'
  | 'readOnlyField';

export interface MatrixQuestionTranslationPreviewRow {
  key: string;
  scope: MatrixQuestionTranslationPackageField['scope'];
  fieldId: MatrixQuestionTranslationQuestionFieldId | MatrixQuestionTranslationResourceFieldId;
  resourceId?: string;
  currentTranslation: string;
  importedTranslation: string;
  status: MatrixQuestionTranslationPreviewStatus;
  issues: MatrixQuestionTranslationPreviewIssue[];
  selectable: boolean;
}

export type MatrixQuestionTranslationPackageError =
  | 'invalidJson'
  | 'invalidEnvelope'
  | 'unsupportedVersion'
  | 'invalidLanguageDirection'
  | 'invalidFields';

export type MatrixQuestionTranslationPackagePreview =
  | { ok: false; error: MatrixQuestionTranslationPackageError }
  | { ok: true; rows: MatrixQuestionTranslationPreviewRow[] };

export interface MatrixQuestionTranslationChange {
  scope: MatrixQuestionTranslationField['scope'];
  fieldId: MatrixQuestionTranslationQuestionFieldId | MatrixQuestionTranslationResourceFieldId;
  resourceId?: string;
  value: string;
}
