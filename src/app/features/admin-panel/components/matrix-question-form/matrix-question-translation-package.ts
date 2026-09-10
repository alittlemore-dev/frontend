import { marked } from 'marked';
import { parseWikiLinks } from '../../../../core/wiki-links/wiki-links';
import {
  MatrixQuestionTranslationField,
  MatrixQuestionTranslationPackageError,
  MatrixQuestionTranslationPackageField,
  MatrixQuestionTranslationPackagePreview,
  MatrixQuestionTranslationPreviewIssue,
  MatrixQuestionTranslationPreviewRow,
  MatrixQuestionTranslationQuestionFieldId,
  MatrixQuestionTranslationResourceFieldId,
} from './matrix-question-translation.model';

const PACKAGE_SCHEMA = 'matrix-question-translation';
const PACKAGE_VERSION = 1;
const PACKAGE_TASK =
  'Translate editable non-empty source values into English by changing only translation values. ' +
  'Preserve identifiers, source text, Markdown, code, URLs, and typed wiki-link targets.';
const QUESTION_FIELD_IDS: readonly MatrixQuestionTranslationQuestionFieldId[] = [
  'question',
  'answer',
  'interviewAnswerExplanation',
];
const RESOURCE_FIELD_IDS: readonly MatrixQuestionTranslationResourceFieldId[] = ['name', 'context'];
const URL_PATTERN = /https?:\/\/[^\s<>"')\]}]+/gu;
const JSON_FENCE_PATTERN = /^```json[ \t]*\r?\n([\s\S]*?)\r?\n```$/iu;

interface ProtectedTokens {
  code: string[];
  urls: string[];
  wikiTargets: string[];
}

interface TranslationPackageV1 {
  schema: typeof PACKAGE_SCHEMA;
  version: typeof PACKAGE_VERSION;
  sourceLanguage: 'ru';
  targetLanguage: 'en';
  task: string;
  fields: MatrixQuestionTranslationPackageField[];
}

export function normalizeMatrixQuestionTranslationContent(value: string): string {
  return value
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}

export function matrixQuestionTranslationFieldKey(
  field: MatrixQuestionTranslationField | MatrixQuestionTranslationPackageField,
): string {
  return field.scope === 'question'
    ? `question:${field.fieldId}`
    : `resource:${field.resourceId}:${field.fieldId}`;
}

export function serializeMatrixQuestionTranslationPackage(
  fields: readonly MatrixQuestionTranslationField[],
): string {
  const translationPackage: TranslationPackageV1 = {
    schema: PACKAGE_SCHEMA,
    version: PACKAGE_VERSION,
    sourceLanguage: 'ru',
    targetLanguage: 'en',
    task: PACKAGE_TASK,
    fields: fields.map(toPackageField),
  };
  return JSON.stringify(translationPackage, null, 2);
}

export function previewMatrixQuestionTranslationPackage(
  input: string,
  currentFields: readonly MatrixQuestionTranslationField[],
): MatrixQuestionTranslationPackagePreview {
  const parsed = parseTranslationPackage(input);
  if (!parsed.ok) return parsed;

  const fieldsByKey = new Map(
    currentFields.map((field) => [matrixQuestionTranslationFieldKey(field), field]),
  );
  const keyCounts = countPackageKeys(parsed.value.fields);
  return {
    ok: true,
    rows: parsed.value.fields.map((field) => previewPackageField(field, fieldsByKey, keyCounts)),
  };
}

function toPackageField(
  field: MatrixQuestionTranslationField,
): MatrixQuestionTranslationPackageField {
  if (field.scope === 'question') {
    return {
      scope: field.scope,
      fieldId: field.fieldId,
      source: field.source,
      translation: field.translation,
      editable: field.editable,
    };
  }
  return {
    scope: field.scope,
    resourceId: field.resourceId,
    fieldId: field.fieldId,
    source: field.source,
    translation: field.translation,
    editable: field.editable,
  };
}

function parseTranslationPackage(
  input: string,
):
  | { ok: false; error: MatrixQuestionTranslationPackageError }
  | { ok: true; value: TranslationPackageV1 } {
  const value = unwrapJsonFence(input.trim());
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return { ok: false, error: 'invalidJson' };
  }
  if (!isRecord(parsed) || parsed['schema'] !== PACKAGE_SCHEMA) {
    return { ok: false, error: 'invalidEnvelope' };
  }
  if (parsed['version'] !== PACKAGE_VERSION) {
    return { ok: false, error: 'unsupportedVersion' };
  }
  if (parsed['sourceLanguage'] !== 'ru' || parsed['targetLanguage'] !== 'en') {
    return { ok: false, error: 'invalidLanguageDirection' };
  }
  if (typeof parsed['task'] !== 'string' || !Array.isArray(parsed['fields'])) {
    return { ok: false, error: 'invalidEnvelope' };
  }

  const fields: MatrixQuestionTranslationPackageField[] = [];
  for (const field of parsed['fields']) {
    const parsedField = parsePackageField(field);
    if (parsedField === undefined) {
      return { ok: false, error: 'invalidFields' };
    }
    fields.push(parsedField);
  }
  return {
    ok: true,
    value: {
      schema: PACKAGE_SCHEMA,
      version: PACKAGE_VERSION,
      sourceLanguage: 'ru',
      targetLanguage: 'en',
      task: parsed['task'],
      fields,
    },
  };
}

function parsePackageField(value: unknown): MatrixQuestionTranslationPackageField | undefined {
  if (
    !isRecord(value) ||
    typeof value['source'] !== 'string' ||
    typeof value['translation'] !== 'string' ||
    typeof value['editable'] !== 'boolean'
  ) {
    return undefined;
  }
  if (
    value['scope'] === 'question' &&
    isQuestionFieldId(value['fieldId']) &&
    value['resourceId'] === undefined
  ) {
    return {
      scope: value['scope'],
      fieldId: value['fieldId'],
      source: value['source'],
      translation: value['translation'],
      editable: value['editable'],
    };
  }
  if (
    value['scope'] === 'resource' &&
    typeof value['resourceId'] === 'string' &&
    value['resourceId'] !== '' &&
    isResourceFieldId(value['fieldId'])
  ) {
    return {
      scope: value['scope'],
      resourceId: value['resourceId'],
      fieldId: value['fieldId'],
      source: value['source'],
      translation: value['translation'],
      editable: value['editable'],
    };
  }
  return undefined;
}

function previewPackageField(
  packageField: MatrixQuestionTranslationPackageField,
  fieldsByKey: ReadonlyMap<string, MatrixQuestionTranslationField>,
  keyCounts: ReadonlyMap<string, number>,
): MatrixQuestionTranslationPreviewRow {
  const key = matrixQuestionTranslationFieldKey(packageField);
  const currentField = fieldsByKey.get(key);
  if (currentField === undefined) {
    return previewRow(packageField, key, '', 'invalid', ['unknownField'], false);
  }
  if ((keyCounts.get(key) ?? 0) > 1) {
    return previewRow(
      packageField,
      key,
      currentField.translation,
      'invalid',
      ['duplicateField'],
      false,
    );
  }
  if (packageField.source !== currentField.source) {
    return previewRow(packageField, key, currentField.translation, 'stale', ['staleSource'], false);
  }
  if (!currentField.editable) {
    return previewRow(
      packageField,
      key,
      currentField.translation,
      'readOnly',
      ['readOnlyField'],
      false,
    );
  }

  const issues = translationIssues(packageField, currentField);
  if (issues.length > 0) {
    return previewRow(packageField, key, currentField.translation, 'invalid', issues, false);
  }
  if (packageField.translation === currentField.translation) {
    return previewRow(packageField, key, currentField.translation, 'unchanged', [], false);
  }
  return previewRow(packageField, key, currentField.translation, 'changed', [], true);
}

function previewRow(
  field: MatrixQuestionTranslationPackageField,
  key: string,
  currentTranslation: string,
  status: MatrixQuestionTranslationPreviewRow['status'],
  issues: MatrixQuestionTranslationPreviewIssue[],
  selectable: boolean,
): MatrixQuestionTranslationPreviewRow {
  return {
    key,
    scope: field.scope,
    fieldId: field.fieldId,
    ...(field.scope === 'resource' ? { resourceId: field.resourceId } : {}),
    currentTranslation,
    importedTranslation: field.translation,
    status,
    issues,
    selectable,
  };
}

function translationIssues(
  packageField: MatrixQuestionTranslationPackageField,
  currentField: MatrixQuestionTranslationField,
): MatrixQuestionTranslationPreviewIssue[] {
  if (packageField.translation.trim() === '') return ['emptyTranslation'];
  if (packageField.translation.length > currentField.maxLength) return ['translationTooLong'];
  if (!protectedTokensEqual(packageField.source, packageField.translation)) {
    return ['protectedContentChanged'];
  }
  return [];
}

function protectedTokensEqual(source: string, translation: string): boolean {
  const sourceTokens = protectedTokens(source);
  const translationTokens = protectedTokens(translation);
  return (
    arraysEqual(sourceTokens.code, translationTokens.code) &&
    arraysEqual(sourceTokens.urls, translationTokens.urls) &&
    arraysEqual(sourceTokens.wikiTargets, translationTokens.wikiTargets)
  );
}

function protectedTokens(markdown: string): ProtectedTokens {
  const code: string[] = [];
  collectMarkdownCodeTokens(marked.lexer(markdown), code);
  return {
    code: code.sort(),
    urls: Array.from(markdown.matchAll(URL_PATTERN), (match) => match[0]).sort(),
    wikiTargets: parseWikiLinks(markdown)
      .map((link) => `${link.type}:${link.slug}`)
      .sort(),
  };
}

function collectMarkdownCodeTokens(value: unknown, result: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectMarkdownCodeTokens(item, result);
    return;
  }
  if (!isRecord(value)) return;
  if (
    (value['type'] === 'code' || value['type'] === 'codespan') &&
    typeof value['text'] === 'string'
  ) {
    const raw = typeof value['raw'] === 'string' ? value['raw'] : value['text'];
    result.push(`${value['type']}:${raw}`);
  }
  if (Array.isArray(value['tokens'])) collectMarkdownCodeTokens(value['tokens'], result);
  if (Array.isArray(value['items'])) collectMarkdownCodeTokens(value['items'], result);
}

function countPackageKeys(
  fields: readonly MatrixQuestionTranslationPackageField[],
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const field of fields) {
    const key = matrixQuestionTranslationFieldKey(field);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function unwrapJsonFence(value: string): string {
  return JSON_FENCE_PATTERN.exec(value)?.[1] ?? value;
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isQuestionFieldId(value: unknown): value is MatrixQuestionTranslationQuestionFieldId {
  return QUESTION_FIELD_IDS.some((fieldId) => fieldId === value);
}

function isResourceFieldId(value: unknown): value is MatrixQuestionTranslationResourceFieldId {
  return RESOURCE_FIELD_IDS.some((fieldId) => fieldId === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
