import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  untracked,
  signal,
} from '@angular/core';
import { MarkdownEditorComponent } from '../../../../core/editor/markdown-editor.component';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { NotificationService } from '../../../../core/notifications/notification.service';
import {
  MatrixQuestionTranslationChange,
  MatrixQuestionTranslationField,
  MatrixQuestionTranslationPackagePreview,
  MatrixQuestionTranslationPreviewIssue,
  MatrixQuestionTranslationPreviewRow,
} from './matrix-question-translation.model';
import {
  matrixQuestionTranslationFieldKey,
  normalizeMatrixQuestionTranslationContent,
  previewMatrixQuestionTranslationPackage,
  serializeMatrixQuestionTranslationPackage,
} from './matrix-question-translation-package';
import { matrixQuestionTranslationFieldSignature } from './matrix-question-readiness.model';

type TranslationFieldStatus =
  'complete' | 'missingSource' | 'missingTranslation' | 'identical' | 'reviewed' | 'notApplicable';

interface TranslationWorkspaceRow {
  field: MatrixQuestionTranslationField;
  key: string;
  status: TranslationFieldStatus;
  includedInCompleteness: boolean;
}

@Component({
  selector: 'app-matrix-question-translation-workspace',
  standalone: true,
  imports: [MarkdownEditorComponent, TranslatePipe],
  templateUrl: './matrix-question-translation-workspace.component.html',
  styleUrl: './matrix-question-translation-workspace.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatrixQuestionTranslationWorkspaceComponent {
  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly i18n = inject(I18nService);
  private readonly notifications = inject(NotificationService);

  readonly fields = input.required<readonly MatrixQuestionTranslationField[]>();
  readonly resetKey = input.required<string>();
  readonly disabled = input.required<boolean>();
  readonly reviewedTranslationSignatures = input.required<ReadonlyMap<string, string>>();
  readonly translationChange = output<MatrixQuestionTranslationChange>();
  readonly identicalReviewed = output<MatrixQuestionTranslationField>();
  readonly previewEnglish = output<void>();

  readonly importInput = signal('');
  private readonly previewInput = signal<string | null>(null);
  private readonly selectedPreviewKeys = signal<ReadonlySet<string>>(new Set<string>());
  private previousResetKey: string | undefined;

  readonly rows = computed<TranslationWorkspaceRow[]>(() =>
    this.fields().map((field) => {
      const key = matrixQuestionTranslationFieldKey(field);
      return {
        field,
        key,
        status: this.translationFieldStatus(field, key),
        includedInCompleteness: this.includedInCompleteness(field),
      };
    }),
  );
  readonly completeness = computed(() => {
    const includedRows = this.rows().filter((row) => row.includedInCompleteness);
    return {
      completed: includedRows.filter(
        (row) => row.status === 'complete' || row.status === 'reviewed',
      ).length,
      total: includedRows.length,
    };
  });
  readonly packagePreview = computed<MatrixQuestionTranslationPackagePreview | null>(() => {
    const previewInput = this.previewInput();
    return previewInput === null
      ? null
      : previewMatrixQuestionTranslationPackage(previewInput, this.fields());
  });
  readonly importErrorKey = computed(() => {
    const preview = this.packagePreview();
    return preview !== null && !preview.ok
      ? `matrix.translation.import.error.${preview.error}`
      : null;
  });
  readonly previewRows = computed(() => {
    const preview = this.packagePreview();
    return preview?.ok ? preview.rows : [];
  });
  readonly selectedCount = computed(() => this.selectedPreviewKeys().size);

  constructor() {
    effect(() => {
      const resetKey = this.resetKey();
      untracked(() => this.reconcileImportState(resetKey));
    });
  }

  copySource(field: MatrixQuestionTranslationField): void {
    if (field.source.trim() === '') {
      this.notifications.error(this.i18n.translate('matrix.translation.copyUnavailable'));
      return;
    }
    this.copyText(field.source);
  }

  copyAll(): void {
    const fields = this.fields();
    if (fields.length === 0 || fields.every((field) => field.source.trim() === '')) {
      this.notifications.error(this.i18n.translate('matrix.translation.copyUnavailable'));
      return;
    }
    this.copyText(serializeMatrixQuestionTranslationPackage(fields));
  }

  updateTranslation(field: MatrixQuestionTranslationField, value: string): void {
    if (!field.editable || this.disabled()) return;
    this.translationChange.emit(
      field.scope === 'question'
        ? { scope: field.scope, fieldId: field.fieldId, value }
        : {
            scope: field.scope,
            resourceId: field.resourceId,
            fieldId: field.fieldId,
            value,
          },
    );
  }

  reviewIdentical(row: TranslationWorkspaceRow): void {
    if (row.status !== 'identical') return;
    this.identicalReviewed.emit(row.field);
    this.notifications.success(this.i18n.translate('matrix.translation.reviewed'));
  }

  focusTranslationField(translationKey: string): void {
    const card = Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>('[data-translation-key]'),
    ).find((candidate) => candidate.dataset['translationKey'] === translationKey);
    if (card === undefined) return;
    card.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    const reviewButton = card.querySelector<HTMLButtonElement>(
      '[data-testid^="matrix-translation-review-"]',
    );
    const editableTarget = card.querySelector<HTMLElement>('.form-control, button');
    (reviewButton ?? editableTarget)?.focus({ preventScroll: true });
  }

  setImportInput(value: string): void {
    this.importInput.set(value);
    this.previewInput.set(null);
    this.selectedPreviewKeys.set(new Set<string>());
  }

  previewImport(): void {
    this.previewInput.set(this.importInput());
    const preview = this.packagePreview();
    if (preview === null || !preview.ok) {
      this.selectedPreviewKeys.set(new Set<string>());
      this.notifications.error(this.i18n.translate('matrix.translation.importInvalid'));
      return;
    }
    this.selectedPreviewKeys.set(
      new Set(preview.rows.filter((row) => row.selectable).map((row) => row.key)),
    );
    this.notifications.success(this.i18n.translate('matrix.translation.importPreviewReady'));
  }

  previewRowSelected(row: MatrixQuestionTranslationPreviewRow): boolean {
    return this.selectedPreviewKeys().has(row.key);
  }

  togglePreviewRow(row: MatrixQuestionTranslationPreviewRow, checked: boolean): void {
    if (!row.selectable || this.disabled()) return;
    const selected = new Set(this.selectedPreviewKeys());
    if (checked) selected.add(row.key);
    else selected.delete(row.key);
    this.selectedPreviewKeys.set(selected);
  }

  applySelectedImport(): void {
    const selectedKeys = this.selectedPreviewKeys();
    const selectedRows = this.previewRows().filter(
      (row) => row.selectable && selectedKeys.has(row.key),
    );
    if (selectedRows.length === 0) {
      this.notifications.error(this.i18n.translate('matrix.translation.importNothingSelected'));
      return;
    }
    for (const row of selectedRows) {
      this.translationChange.emit(
        row.scope === 'question'
          ? {
              scope: row.scope,
              fieldId: row.fieldId,
              value: row.importedTranslation,
            }
          : {
              scope: row.scope,
              resourceId: row.resourceId,
              fieldId: row.fieldId,
              value: row.importedTranslation,
            },
      );
    }
    this.selectedPreviewKeys.set(new Set<string>());
    this.notifications.success(
      this.i18n.translate('matrix.translation.importApplied', {
        count: String(selectedRows.length),
      }),
    );
  }

  fieldTestId(field: MatrixQuestionTranslationField): string {
    return field.scope === 'question'
      ? `question-${field.fieldId}`
      : `resource-${field.resourceId}-${field.fieldId}`;
  }

  fieldLabelKey(field: MatrixQuestionTranslationField): string {
    return `matrix.translation.field.${field.fieldId}`;
  }

  statusLabelKey(status: TranslationFieldStatus): string {
    return `matrix.translation.status.${status}`;
  }

  previewStatusLabelKey(status: MatrixQuestionTranslationPreviewRow['status']): string {
    return `matrix.translation.import.status.${status}`;
  }

  previewIssueLabelKey(issue: MatrixQuestionTranslationPreviewIssue): string {
    return `matrix.translation.import.issue.${issue}`;
  }

  previewFieldLabel(row: MatrixQuestionTranslationPreviewRow): string {
    const field = this.fields().find(
      (candidate) => matrixQuestionTranslationFieldKey(candidate) === row.key,
    );
    if (field === undefined) return row.key;
    const label = this.i18n.translate(this.fieldLabelKey(field));
    return field.scope === 'resource' ? `${field.resourceLabel}: ${label}` : label;
  }

  isMarkdownField(field: MatrixQuestionTranslationField): boolean {
    return (
      field.scope === 'question' &&
      (field.fieldId === 'answer' || field.fieldId === 'interviewAnswerExplanation')
    );
  }

  isContextField(field: MatrixQuestionTranslationField): boolean {
    return field.scope === 'resource' && field.fieldId === 'context';
  }

  private translationFieldStatus(
    field: MatrixQuestionTranslationField,
    key: string,
  ): TranslationFieldStatus {
    const source = normalizeMatrixQuestionTranslationContent(field.source);
    const translation = normalizeMatrixQuestionTranslationContent(field.translation);
    if (!field.required && source === '' && translation === '') return 'notApplicable';
    if (source === '') return 'missingSource';
    if (translation === '') return 'missingTranslation';
    if (source !== translation) return 'complete';
    return this.reviewedTranslationSignatures().get(key) ===
      matrixQuestionTranslationFieldSignature(field)
      ? 'reviewed'
      : 'identical';
  }

  private includedInCompleteness(field: MatrixQuestionTranslationField): boolean {
    if (!field.editable) return false;
    if (field.required) return true;
    return field.source.trim() !== '' || field.translation.trim() !== '';
  }

  private copyText(value: string): void {
    const clipboard = this.document.defaultView?.navigator.clipboard;
    if (clipboard === undefined) {
      this.notifications.error(this.i18n.translate('matrix.translation.clipboardUnavailable'));
      return;
    }
    try {
      void clipboard.writeText(value).then(
        () => this.notifications.success(this.i18n.translate('matrix.translation.copySuccess')),
        () => this.notifications.error(this.i18n.translate('matrix.translation.copyFailure')),
      );
    } catch {
      this.notifications.error(this.i18n.translate('matrix.translation.copyFailure'));
    }
  }

  private reconcileImportState(resetKey: string): void {
    if (this.previousResetKey !== resetKey) {
      this.resetImportState();
    }
    this.previousResetKey = resetKey;
  }

  private resetImportState(): void {
    this.importInput.set('');
    this.previewInput.set(null);
    this.selectedPreviewKeys.set(new Set<string>());
  }
}
