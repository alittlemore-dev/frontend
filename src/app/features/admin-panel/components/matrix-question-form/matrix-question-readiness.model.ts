import { I18nParams } from '../../../../core/i18n/i18n.model';
import {
  AdminMatrixGrade,
  AdminMatrixInterviewFrequency,
} from '../../models/matrix-question-workspace.model';
import {
  MatrixQuestionTranslationField,
  MatrixQuestionTranslationQuestionFieldId,
} from './matrix-question-translation.model';
import {
  matrixQuestionTranslationFieldKey,
  normalizeMatrixQuestionTranslationContent,
} from './matrix-question-translation-package';

export type MatrixQuestionReadinessSeverity = 'draftBlocker' | 'publicationBlocker' | 'warning';
export type MatrixQuestionReadinessGroupId = 'structure' | 'ru' | 'en' | 'resources';
export type MatrixQuestionReadinessFieldId =
  | 'slug'
  | 'subsectionId'
  | 'grade'
  | 'interviewFrequency'
  | 'questionRu'
  | 'questionEn'
  | 'answerRu'
  | 'answerEn'
  | 'interviewAnswerExplanationRu'
  | 'interviewAnswerExplanationEn'
  | 'resources'
  | 'resourceNameTranslation'
  | 'resourceContextRu'
  | 'resourceContextEn'
  | 'resourceContextTranslation';

export type MatrixQuestionReadinessTarget =
  | {
      kind: 'field';
      fieldId: Exclude<
        MatrixQuestionReadinessFieldId,
        | 'resources'
        | 'resourceNameTranslation'
        | 'resourceContextRu'
        | 'resourceContextEn'
        | 'resourceContextTranslation'
      >;
    }
  | { kind: 'resourceSearch' }
  | { kind: 'resourceContext'; resourceId: string; language: 'ru' | 'en' }
  | { kind: 'translation'; translationKey: string };

export interface MatrixQuestionReadinessItem {
  id: string;
  groupId: MatrixQuestionReadinessGroupId;
  severity: MatrixQuestionReadinessSeverity;
  fieldId: MatrixQuestionReadinessFieldId;
  labelKey: string;
  labelParams?: I18nParams;
  reasonKey: string;
  target: MatrixQuestionReadinessTarget;
}

export interface MatrixQuestionReadinessGroup {
  id: MatrixQuestionReadinessGroupId;
  completedRequired: number;
  totalRequired: number;
  resourceCount: number;
  issues: MatrixQuestionReadinessItem[];
}

export interface MatrixQuestionReadinessAnalysis {
  completedRequired: number;
  totalRequired: number;
  draftBlockerCount: number;
  publicationBlockerCount: number;
  warningCount: number;
  canSaveDraft: boolean;
  canPublish: boolean;
  issues: MatrixQuestionReadinessItem[];
  groups: MatrixQuestionReadinessGroup[];
}

export interface MatrixQuestionReadinessResource {
  id: string;
  label: string;
  contextRu: string;
  contextEn: string;
}

export interface MatrixQuestionReadinessInput {
  slug: string;
  subsectionId: string | null;
  grade: AdminMatrixGrade | null;
  interviewFrequency: AdminMatrixInterviewFrequency | null;
  fields: readonly MatrixQuestionTranslationField[];
  resources: readonly MatrixQuestionReadinessResource[];
  invalidFields: ReadonlySet<MatrixQuestionReadinessFieldId>;
  invalidResourceContextKeys: ReadonlySet<string>;
  reviewedTranslationSignatures: ReadonlyMap<string, string>;
}

interface RequiredReadinessCheck {
  fieldId: Exclude<
    MatrixQuestionReadinessFieldId,
    | 'interviewFrequency'
    | 'resources'
    | 'resourceNameTranslation'
    | 'resourceContextRu'
    | 'resourceContextEn'
    | 'resourceContextTranslation'
  >;
  groupId: Exclude<MatrixQuestionReadinessGroupId, 'resources'>;
  valuePresent: boolean;
  draftRequired: boolean;
}

const GROUPS: readonly MatrixQuestionReadinessGroupId[] = ['structure', 'ru', 'en', 'resources'];
const TOTAL_REQUIRED = 9;

export function analyzeMatrixQuestionReadiness(
  input: MatrixQuestionReadinessInput,
): MatrixQuestionReadinessAnalysis {
  const questionFields = new Map(
    input.fields
      .filter((field) => field.scope === 'question')
      .map((field) => [field.fieldId, field]),
  );
  const requiredChecks = requiredReadinessChecks(input, questionFields);
  const issues: MatrixQuestionReadinessItem[] = [];

  for (const check of requiredChecks) {
    const invalid = input.invalidFields.has(check.fieldId);
    if (invalid) {
      issues.push(fieldIssue(check.fieldId, check.groupId, 'draftBlocker', 'invalidDraft'));
      continue;
    }
    if (!check.valuePresent) {
      issues.push(
        fieldIssue(
          check.fieldId,
          check.groupId,
          check.draftRequired ? 'draftBlocker' : 'publicationBlocker',
          check.draftRequired ? 'requiredForDraft' : 'requiredForPublication',
        ),
      );
    }
  }

  for (const resource of input.resources) {
    for (const language of ['ru', 'en'] as const) {
      const contextKey = resourceContextKey(resource.id, language);
      if (!input.invalidResourceContextKeys.has(contextKey)) continue;
      const fieldId = language === 'ru' ? 'resourceContextRu' : 'resourceContextEn';
      issues.push({
        id: `draftBlocker:${contextKey}`,
        groupId: 'resources',
        severity: 'draftBlocker',
        fieldId,
        labelKey: `matrix.readiness.field.${fieldId}`,
        labelParams: { resource: resource.label },
        reasonKey: 'matrix.readiness.reason.invalidDraft',
        target: { kind: 'resourceContext', resourceId: resource.id, language },
      });
    }
  }

  if (input.interviewFrequency === null) {
    issues.push(fieldIssue('interviewFrequency', 'structure', 'warning', 'recommendedMetadata'));
  }
  if (input.resources.length === 0) {
    issues.push({
      id: 'warning:resources',
      groupId: 'resources',
      severity: 'warning',
      fieldId: 'resources',
      labelKey: 'matrix.readiness.field.resources',
      reasonKey: 'matrix.readiness.reason.resourceRecommended',
      target: { kind: 'resourceSearch' },
    });
  }

  for (const resource of input.resources) {
    for (const language of ['ru', 'en'] as const) {
      const contextKey = resourceContextKey(resource.id, language);
      const context = language === 'ru' ? resource.contextRu : resource.contextEn;
      if (context.trim() !== '' || input.invalidResourceContextKeys.has(contextKey)) continue;
      const fieldId = language === 'ru' ? 'resourceContextRu' : 'resourceContextEn';
      issues.push({
        id: `warning:${contextKey}`,
        groupId: 'resources',
        severity: 'warning',
        fieldId,
        labelKey: `matrix.readiness.field.${fieldId}`,
        labelParams: { resource: resource.label },
        reasonKey: 'matrix.readiness.reason.contextRecommended',
        target: { kind: 'resourceContext', resourceId: resource.id, language },
      });
    }
  }

  for (const field of input.fields) {
    if (!field.editable || translationFieldBlocked(field, input)) continue;
    const source = normalizeMatrixQuestionTranslationContent(field.source);
    const translation = normalizeMatrixQuestionTranslationContent(field.translation);
    if (source === '' || translation === '' || source !== translation) continue;
    const translationKey = matrixQuestionTranslationFieldKey(field);
    if (
      input.reviewedTranslationSignatures.get(translationKey) ===
      matrixQuestionTranslationFieldSignature(field)
    ) {
      continue;
    }
    const resource =
      field.scope === 'resource'
        ? input.resources.find((candidate) => candidate.id === field.resourceId)
        : undefined;
    const fieldId = identicalFieldId(field);
    issues.push({
      id: `identical:${translationKey}`,
      groupId: field.scope === 'question' ? 'en' : 'resources',
      severity: 'warning',
      fieldId,
      labelKey: `matrix.readiness.field.${fieldId}`,
      ...(resource === undefined ? {} : { labelParams: { resource: resource.label } }),
      reasonKey: 'matrix.readiness.reason.identical',
      target: { kind: 'translation', translationKey },
    });
  }

  const groups = GROUPS.map((groupId) => ({
    id: groupId,
    completedRequired: requiredChecks.filter(
      (check) =>
        check.groupId === groupId && check.valuePresent && !input.invalidFields.has(check.fieldId),
    ).length,
    totalRequired: requiredChecks.filter((check) => check.groupId === groupId).length,
    resourceCount: groupId === 'resources' ? input.resources.length : 0,
    issues: issues.filter((issue) => issue.groupId === groupId),
  }));
  const completedRequired = groups.reduce((total, group) => total + group.completedRequired, 0);
  const draftBlockerCount = countSeverity(issues, 'draftBlocker');
  const publicationBlockerCount = countSeverity(issues, 'publicationBlocker');
  const warningCount = countSeverity(issues, 'warning');

  return {
    completedRequired,
    totalRequired: TOTAL_REQUIRED,
    draftBlockerCount,
    publicationBlockerCount,
    warningCount,
    canSaveDraft: draftBlockerCount === 0,
    canPublish: draftBlockerCount === 0 && publicationBlockerCount === 0,
    issues,
    groups,
  };
}

export function matrixQuestionTranslationFieldSignature(
  field: MatrixQuestionTranslationField,
): string {
  return `${field.source}\u0000${field.translation}`;
}

export function matrixQuestionResourceContextKey(
  resourceId: string,
  language: 'ru' | 'en',
): string {
  return resourceContextKey(resourceId, language);
}

function requiredReadinessChecks(
  input: MatrixQuestionReadinessInput,
  questionFields: ReadonlyMap<
    MatrixQuestionTranslationQuestionFieldId,
    MatrixQuestionTranslationField
  >,
): RequiredReadinessCheck[] {
  return [
    {
      fieldId: 'slug',
      groupId: 'structure',
      valuePresent: input.slug.trim() !== '',
      draftRequired: true,
    },
    {
      fieldId: 'subsectionId',
      groupId: 'structure',
      valuePresent: input.subsectionId !== null,
      draftRequired: true,
    },
    {
      fieldId: 'grade',
      groupId: 'structure',
      valuePresent: input.grade !== null,
      draftRequired: false,
    },
    questionCheck(questionFields, 'question', 'ru', true),
    questionCheck(questionFields, 'answer', 'ru', false),
    questionCheck(questionFields, 'interviewAnswerExplanation', 'ru', false),
    questionCheck(questionFields, 'question', 'en', true),
    questionCheck(questionFields, 'answer', 'en', false),
    questionCheck(questionFields, 'interviewAnswerExplanation', 'en', false),
  ];
}

function questionCheck(
  fields: ReadonlyMap<MatrixQuestionTranslationQuestionFieldId, MatrixQuestionTranslationField>,
  fieldId: MatrixQuestionTranslationQuestionFieldId,
  language: 'ru' | 'en',
  draftRequired: boolean,
): RequiredReadinessCheck {
  const field = fields.get(fieldId);
  const value = language === 'ru' ? field?.source : field?.translation;
  const suffix = language === 'ru' ? 'Ru' : 'En';
  const readinessFieldId = `${fieldId}${suffix}` as RequiredReadinessCheck['fieldId'];
  return {
    fieldId: readinessFieldId,
    groupId: language,
    valuePresent: (value ?? '').trim() !== '',
    draftRequired,
  };
}

function fieldIssue(
  fieldId: RequiredReadinessCheck['fieldId'] | 'interviewFrequency',
  groupId: Exclude<MatrixQuestionReadinessGroupId, 'resources'>,
  severity: MatrixQuestionReadinessSeverity,
  reason: 'invalidDraft' | 'requiredForDraft' | 'requiredForPublication' | 'recommendedMetadata',
): MatrixQuestionReadinessItem {
  return {
    id: `${severity}:${fieldId}`,
    groupId,
    severity,
    fieldId,
    labelKey: `matrix.readiness.field.${fieldId}`,
    reasonKey: `matrix.readiness.reason.${reason}`,
    target: { kind: 'field', fieldId },
  };
}

function translationFieldBlocked(
  field: MatrixQuestionTranslationField,
  input: MatrixQuestionReadinessInput,
): boolean {
  if (field.scope === 'resource') {
    return (
      field.fieldId === 'context' &&
      (input.invalidResourceContextKeys.has(resourceContextKey(field.resourceId, 'ru')) ||
        input.invalidResourceContextKeys.has(resourceContextKey(field.resourceId, 'en')))
    );
  }
  const suffixes = ['Ru', 'En'] as const;
  return suffixes.some((suffix) =>
    input.invalidFields.has(`${field.fieldId}${suffix}` as MatrixQuestionReadinessFieldId),
  );
}

function identicalFieldId(field: MatrixQuestionTranslationField): MatrixQuestionReadinessFieldId {
  if (field.scope === 'resource') {
    return field.fieldId === 'name' ? 'resourceNameTranslation' : 'resourceContextTranslation';
  }
  return `${field.fieldId}En` as MatrixQuestionReadinessFieldId;
}

function resourceContextKey(resourceId: string, language: 'ru' | 'en'): string {
  return `resource:${resourceId}:context:${language}`;
}

function countSeverity(
  issues: readonly MatrixQuestionReadinessItem[],
  severity: MatrixQuestionReadinessSeverity,
): number {
  return issues.filter((issue) => issue.severity === severity).length;
}
