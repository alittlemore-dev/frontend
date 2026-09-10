import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { Observable, map } from 'rxjs';
import { ApiError } from '../../../../core/models/api-error.model';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ModalScrollDirective } from '../../../../core/layout/modal-scroll.directive';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorMessageComponent } from '../../../../shared/ui/error-message/error-message.component';
import { LoadingSpinnerComponent } from '../../../../shared/ui/loading-spinner/loading-spinner.component';
import { AdminControlValidationStateDirective } from '../../directives/admin-control-validation-state.directive';
import {
  AdminMatrixStructure,
  AdminMatrixStructureSection,
  AdminMatrixStructureSheet,
} from '../../models/matrix-question-workspace.model';
import { MatrixQuestionWorkspaceService } from '../../services/matrix-question-workspace.service';
import {
  AdminUnsavedChangesService,
  AdminUnsavedChangesSource,
} from '../../services/admin-unsaved-changes.service';
import {
  ADMIN_VALIDATION_LIMITS,
  controlInvalid,
  slugValidator,
  trimRequired,
  validationMessage,
} from '../../utils/admin-validation';
import {
  canonicalQueryMatches,
  readOptionalStringQuery,
  replaceAdminQueryParams,
} from '../../utils/admin-query-state';

const MATRIX_STRUCTURE_QUERY_KEYS = ['sheet'] as const;

type MatrixCreateKind = 'sheet' | 'section' | 'subsection';
type MatrixSheetCreateField = 'key' | 'nameRu' | 'nameEn';
type MatrixNameCreateField = 'nameRu' | 'nameEn';

interface MatrixCreateDialog {
  kind: MatrixCreateKind;
  parentId: string;
  parentName: string;
}

interface MatrixStructureCreateFormValue {
  nameRu: string;
  nameEn: string;
}

@Component({
  selector: 'app-matrix-structure-page',
  standalone: true,
  imports: [
    CdkDrag,
    CdkDropList,
    ReactiveFormsModule,
    TranslatePipe,
    LoadingSpinnerComponent,
    ErrorMessageComponent,
    EmptyStateComponent,
    AdminControlValidationStateDirective,
    ModalScrollDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './matrix-structure-page.component.html',
  styleUrl: './matrix-structure-page.component.scss',
})
export class MatrixStructurePageComponent implements OnInit {
  private readonly workspaceService = inject(MatrixQuestionWorkspaceService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly unsavedChangesScope = inject(AdminUnsavedChangesService).createScope(this.destroyRef);
  private currentQueryParams: ParamMap | null = null;
  private structureLoaded = false;

  readonly structure = signal<AdminMatrixStructure>({ sheets: [] });
  readonly selectedSheetId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly createDialog = signal<MatrixCreateDialog | null>(null);
  readonly createSubmitting = signal(false);
  readonly createFormSubmitted = signal(false);
  readonly createError = signal<ApiError | null>(null);
  readonly validationLimits = ADMIN_VALIDATION_LIMITS;

  readonly selectedSheet = computed(() => {
    const selectedId = this.selectedSheetId();
    return this.structure().sheets.find((sheet) => sheet.id === selectedId) ?? null;
  });
  readonly isEmpty = computed(() => !this.loading() && this.structure().sheets.length === 0);
  readonly createDialogTitleKey = computed(() => {
    const dialog = this.createDialog();
    if (dialog === null) return 'adminMatrixStructure.createSheetTitle';
    return `adminMatrixStructure.create${capitalizeCreateKind(dialog.kind)}Title`;
  });

  readonly sheetCreateForm = this.formBuilder.group({
    key: [
      '',
      [trimRequired, Validators.maxLength(ADMIN_VALIDATION_LIMITS.shortText), slugValidator],
    ],
    nameRu: ['', [trimRequired, Validators.maxLength(ADMIN_VALIDATION_LIMITS.shortText)]],
    nameEn: ['', [trimRequired, Validators.maxLength(ADMIN_VALIDATION_LIMITS.shortText)]],
  });
  readonly nameCreateForm = this.formBuilder.group({
    nameRu: ['', [trimRequired, Validators.maxLength(ADMIN_VALIDATION_LIMITS.shortText)]],
    nameEn: ['', [trimRequired, Validators.maxLength(ADMIN_VALIDATION_LIMITS.shortText)]],
  });
  private readonly sheetCreateFormValue = toSignal(
    this.sheetCreateForm.valueChanges.pipe(map(() => this.sheetCreateForm.getRawValue())),
    { initialValue: this.sheetCreateForm.getRawValue() },
  );
  private readonly nameCreateFormValue = toSignal(
    this.nameCreateForm.valueChanges.pipe(map(() => this.nameCreateForm.getRawValue())),
    { initialValue: this.nameCreateForm.getRawValue() },
  );
  private readonly sheetCreateActive = computed(() => this.createDialog()?.kind === 'sheet');
  private readonly nameCreateActive = computed(() => {
    const kind = this.createDialog()?.kind;
    return kind === 'section' || kind === 'subsection';
  });
  private structureUnsavedSource: AdminUnsavedChangesSource | null = null;
  private sheetCreateUnsavedSource: AdminUnsavedChangesSource | null = null;
  private nameCreateUnsavedSource: AdminUnsavedChangesSource | null = null;

  ngOnInit(): void {
    this.structureUnsavedSource = this.unsavedChangesScope.registerSource(
      this.structure,
      this.saving,
    );
    this.sheetCreateUnsavedSource = this.unsavedChangesScope.registerSource(
      this.sheetCreateFormValue,
      this.sheetCreateActive,
    );
    this.nameCreateUnsavedSource = this.unsavedChangesScope.registerSource(
      this.nameCreateFormValue,
      this.nameCreateActive,
    );
    this.setupQueryState();
    this.loadStructure();
  }

  loadStructure(): void {
    this.loading.set(true);
    this.error.set(null);
    this.workspaceService
      .getStructure(this.currentLanguage())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (structure) => {
          this.structure.set(structure);
          this.structureLoaded = true;
          this.applyQueryState();
          this.structureUnsavedSource?.commit();
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err);
          this.loading.set(false);
          this.notifications.error(this.i18n.translate('adminMatrixStructure.loadError'));
        },
      });
  }

  selectSheet(sheetId: string): void {
    const sheet = this.structure().sheets.find((item) => item.id === sheetId);
    if (sheet === undefined) return;
    this.selectedSheetId.set(sheet.id);
    this.replaceSelectedSheet(sheet.key);
  }

  openSheetCreateDialog(): void {
    this.sheetCreateForm.reset({ key: '', nameRu: '', nameEn: '' });
    this.openCreateDialog({ kind: 'sheet', parentId: '', parentName: '' });
  }

  openSectionCreateDialog(): void {
    const sheet = this.selectedSheet();
    if (sheet === null) return;
    this.nameCreateForm.reset({ nameRu: '', nameEn: '' });
    this.openCreateDialog({ kind: 'section', parentId: sheet.id, parentName: sheet.name });
  }

  openSubsectionCreateDialog(section: AdminMatrixStructureSection): void {
    this.nameCreateForm.reset({ nameRu: '', nameEn: '' });
    this.openCreateDialog({
      kind: 'subsection',
      parentId: section.id,
      parentName: section.name,
    });
  }

  closeCreateDialog(): void {
    if (this.createSubmitting()) return;
    if (!this.unsavedChangesScope.confirmDiscard()) return;
    this.discardCreateDialogDraft();
    this.createDialog.set(null);
    this.createError.set(null);
    this.createFormSubmitted.set(false);
  }

  submitCreateDialog(): void {
    const dialog = this.createDialog();
    if (dialog === null) return;
    if (dialog.kind === 'sheet') {
      this.createSheet();
      return;
    }
    if (dialog.kind === 'section') {
      this.createSection(dialog.parentId);
      return;
    }
    this.createSubsection(dialog.parentId);
  }

  retryCreateDialog(): void {
    this.submitCreateDialog();
  }

  sheetCreateFieldInvalid(field: MatrixSheetCreateField): boolean {
    return controlInvalid(this.sheetCreateForm.controls[field], this.createFormSubmitted());
  }

  sheetCreateFieldMessage(field: MatrixSheetCreateField): string | null {
    return validationMessage(this.sheetCreateForm.controls[field], this.i18n);
  }

  nameCreateFieldInvalid(field: MatrixNameCreateField): boolean {
    return controlInvalid(this.nameCreateForm.controls[field], this.createFormSubmitted());
  }

  nameCreateFieldMessage(field: MatrixNameCreateField): string | null {
    return validationMessage(this.nameCreateForm.controls[field], this.i18n);
  }

  dropSheets(event: CdkDragDrop<AdminMatrixStructureSheet[]>): void {
    this.reorderSheets(event.previousIndex, event.currentIndex);
  }

  dropSections(
    event: CdkDragDrop<AdminMatrixStructureSection[]>,
    sheet: AdminMatrixStructureSheet,
  ): void {
    this.reorderSections(sheet.id, event.previousIndex, event.currentIndex);
  }

  dropSubsections(
    event: CdkDragDrop<AdminMatrixStructureSection['subsections']>,
    section: AdminMatrixStructureSection,
  ): void {
    this.reorderSubsections(section.id, event.previousIndex, event.currentIndex);
  }

  private reorderSheets(previousIndex: number, currentIndex: number): void {
    const current = this.structure();
    if (this.shouldSkipReorder(previousIndex, currentIndex, current.sheets.length)) return;
    const snapshot = cloneStructure(current);
    const next = cloneStructure(current);
    moveItemInArray(next.sheets, previousIndex, currentIndex);
    renumberPriorities(next.sheets);
    this.structure.set(next);
    this.selectedSheetId.set(next.sheets[currentIndex]?.id ?? this.selectedSheetId());
    this.saveReorder(
      snapshot,
      this.workspaceService.updateSheetPriorities(next.sheets.map((sheet) => sheet.id)),
    );
  }

  private reorderSections(sheetId: string, previousIndex: number, currentIndex: number): void {
    const current = this.structure();
    const sheet = current.sheets.find((item) => item.id === sheetId);
    if (!sheet || this.shouldSkipReorder(previousIndex, currentIndex, sheet.sections.length))
      return;
    const snapshot = cloneStructure(current);
    const next = cloneStructure(current);
    const nextSheet = next.sheets.find((item) => item.id === sheetId);
    if (!nextSheet) return;
    moveItemInArray(nextSheet.sections, previousIndex, currentIndex);
    renumberPriorities(nextSheet.sections);
    this.structure.set(next);
    this.saveReorder(
      snapshot,
      this.workspaceService.updateSectionPriorities(
        sheetId,
        nextSheet.sections.map((section) => section.id),
      ),
    );
  }

  private reorderSubsections(sectionId: string, previousIndex: number, currentIndex: number): void {
    const current = this.structure();
    const section = findSection(current, sectionId);
    if (
      !section ||
      this.shouldSkipReorder(previousIndex, currentIndex, section.subsections.length)
    ) {
      return;
    }
    const snapshot = cloneStructure(current);
    const next = cloneStructure(current);
    const nextSection = findSection(next, sectionId);
    if (!nextSection) return;
    moveItemInArray(nextSection.subsections, previousIndex, currentIndex);
    renumberPriorities(nextSection.subsections);
    this.structure.set(next);
    this.saveReorder(
      snapshot,
      this.workspaceService.updateSubsectionPriorities(
        sectionId,
        nextSection.subsections.map((subsection) => subsection.id),
      ),
    );
  }

  private saveReorder(snapshot: AdminMatrixStructure, request: Observable<void>): void {
    this.saving.set(true);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.structureUnsavedSource?.commit();
        this.saving.set(false);
        this.notifications.success(this.i18n.translate('adminMatrixStructure.saved'));
      },
      error: () => {
        this.structure.set(snapshot);
        this.selectedSheetId.set(this.nextSelectedSheetId(snapshot));
        this.saving.set(false);
        this.notifications.error(this.i18n.translate('adminMatrixStructure.saveError'));
        this.loadStructure();
      },
    });
  }

  private openCreateDialog(dialog: MatrixCreateDialog): void {
    this.createError.set(null);
    this.createSubmitting.set(false);
    this.createFormSubmitted.set(false);
    this.createDialog.set(dialog);
  }

  private createSheet(): void {
    this.createFormSubmitted.set(true);
    if (this.sheetCreateForm.invalid) {
      this.sheetCreateForm.markAllAsTouched();
      this.notifications.error(this.i18n.translate('adminMatrixStructure.validationError'));
      return;
    }
    const language = this.currentLanguage();
    const value = this.sheetCreateForm.getRawValue();
    this.createSubmitting.set(true);
    this.createError.set(null);
    this.workspaceService
      .createSheet(
        {
          key: value.key.trim(),
          translations: translationsFromForm(value),
        },
        language,
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sheet) => {
          this.createSubmitting.set(false);
          this.createDialog.set(null);
          this.createFormSubmitted.set(false);
          this.sheetCreateForm.reset({ key: '', nameRu: '', nameEn: '' });
          this.sheetCreateUnsavedSource?.commit();
          this.notifications.success(this.i18n.translate('adminMatrixStructure.sheetCreated'));
          this.refreshStructureAfterCreate(sheet.id);
        },
        error: (err: ApiError) => {
          this.createSubmitting.set(false);
          this.createError.set(err);
          this.notifications.error(this.i18n.translate('adminMatrixStructure.createError'));
        },
      });
  }

  private createSection(sheetId: string): void {
    this.createFormSubmitted.set(true);
    if (this.nameCreateForm.invalid) {
      this.nameCreateForm.markAllAsTouched();
      this.notifications.error(this.i18n.translate('adminMatrixStructure.validationError'));
      return;
    }
    const language = this.currentLanguage();
    const value = this.nameCreateForm.getRawValue();
    this.createSubmitting.set(true);
    this.createError.set(null);
    this.workspaceService
      .createSection(sheetId, { translations: translationsFromForm(value) }, language)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.createSubmitting.set(false);
          this.createDialog.set(null);
          this.createFormSubmitted.set(false);
          this.nameCreateForm.reset({ nameRu: '', nameEn: '' });
          this.nameCreateUnsavedSource?.commit();
          this.notifications.success(this.i18n.translate('adminMatrixStructure.sectionCreated'));
          this.refreshStructureAfterCreate(sheetId);
        },
        error: (err: ApiError) => {
          this.createSubmitting.set(false);
          this.createError.set(err);
          this.notifications.error(this.i18n.translate('adminMatrixStructure.createError'));
        },
      });
  }

  private createSubsection(sectionId: string): void {
    this.createFormSubmitted.set(true);
    if (this.nameCreateForm.invalid) {
      this.nameCreateForm.markAllAsTouched();
      this.notifications.error(this.i18n.translate('adminMatrixStructure.validationError'));
      return;
    }
    const language = this.currentLanguage();
    const value = this.nameCreateForm.getRawValue();
    this.createSubmitting.set(true);
    this.createError.set(null);
    this.workspaceService
      .createSubsection(sectionId, { translations: translationsFromForm(value) }, language)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const preferredSheetId = this.sheetIdBySectionId(this.structure(), sectionId);
          this.createSubmitting.set(false);
          this.createDialog.set(null);
          this.createFormSubmitted.set(false);
          this.nameCreateForm.reset({ nameRu: '', nameEn: '' });
          this.nameCreateUnsavedSource?.commit();
          this.notifications.success(this.i18n.translate('adminMatrixStructure.subsectionCreated'));
          this.refreshStructureAfterCreate(preferredSheetId);
        },
        error: (err: ApiError) => {
          this.createSubmitting.set(false);
          this.createError.set(err);
          this.notifications.error(this.i18n.translate('adminMatrixStructure.createError'));
        },
      });
  }

  private refreshStructureAfterCreate(preferredSheetId: string | null): void {
    this.workspaceService
      .getStructure(this.currentLanguage())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (structure) => {
          this.structure.set(structure);
          const selectedSheetId = this.selectedSheetIdAfterRefresh(structure, preferredSheetId);
          this.selectedSheetId.set(selectedSheetId);
          const selectedSheet = structure.sheets.find((sheet) => sheet.id === selectedSheetId);
          this.replaceSelectedSheet(selectedSheet?.key ?? null);
        },
        error: (err: ApiError) => {
          this.error.set(err);
          this.notifications.error(this.i18n.translate('adminMatrixStructure.loadError'));
        },
      });
  }

  private discardCreateDialogDraft(): void {
    const kind = this.createDialog()?.kind;
    if (kind === 'sheet') {
      this.sheetCreateForm.reset({ key: '', nameRu: '', nameEn: '' });
      this.sheetCreateUnsavedSource?.commit();
      return;
    }
    if (kind === 'section' || kind === 'subsection') {
      this.nameCreateForm.reset({ nameRu: '', nameEn: '' });
      this.nameCreateUnsavedSource?.commit();
    }
  }

  private selectedSheetIdAfterRefresh(
    structure: AdminMatrixStructure,
    preferredSheetId: string | null,
  ): string | null {
    if (preferredSheetId !== null) {
      const preferred = structure.sheets.find((sheet) => sheet.id === preferredSheetId);
      if (preferred !== undefined) return preferred.id;
    }
    return this.nextSelectedSheetId(structure);
  }

  private sheetIdBySectionId(structure: AdminMatrixStructure, sectionId: string): string | null {
    return (
      structure.sheets.find((sheet) => sheet.sections.some((section) => section.id === sectionId))
        ?.id ?? this.selectedSheetId()
    );
  }

  private shouldSkipReorder(previousIndex: number, currentIndex: number, length: number): boolean {
    return (
      this.saving() ||
      previousIndex === currentIndex ||
      previousIndex < 0 ||
      currentIndex < 0 ||
      previousIndex >= length ||
      currentIndex >= length
    );
  }

  private nextSelectedSheetId(structure: AdminMatrixStructure): string | null {
    const selectedId = this.selectedSheetId();
    const existing = structure.sheets.find((sheet) => sheet.id === selectedId);
    return existing?.id ?? structure.sheets[0]?.id ?? null;
  }

  private setupQueryState(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.currentQueryParams = params;
      if (this.structureLoaded) this.applyQueryState();
    });
  }

  private applyQueryState(): void {
    const params = this.currentQueryParams;
    if (params === null) return;
    const requestedSheetKey = readOptionalStringQuery(params, 'sheet').value;
    const selectedSheet =
      this.structure().sheets.find((sheet) => sheet.key === requestedSheetKey) ??
      this.structure().sheets[0] ??
      null;
    this.selectedSheetId.set(selectedSheet?.id ?? null);
    const canonical = { sheet: selectedSheet?.key ?? null };
    if (!canonicalQueryMatches(params, MATRIX_STRUCTURE_QUERY_KEYS, canonical)) {
      void replaceAdminQueryParams(this.router, this.route, canonical);
    }
  }

  private replaceSelectedSheet(sheetKey: string | null): void {
    const canonical = { sheet: sheetKey };
    if (
      this.currentQueryParams !== null &&
      canonicalQueryMatches(this.currentQueryParams, MATRIX_STRUCTURE_QUERY_KEYS, canonical)
    ) {
      return;
    }
    void replaceAdminQueryParams(this.router, this.route, canonical);
  }

  private currentLanguage(): 'ru' | 'en' {
    const language = this.i18n.language();
    if (language === null) {
      throw new Error('I18n language is not initialized');
    }
    return language;
  }
}

function findSection(
  structure: AdminMatrixStructure,
  sectionId: string,
): AdminMatrixStructureSection | null {
  for (const sheet of structure.sheets) {
    const section = sheet.sections.find((item) => item.id === sectionId);
    if (section) return section;
  }
  return null;
}

function cloneStructure(structure: AdminMatrixStructure): AdminMatrixStructure {
  return {
    sheets: structure.sheets.map((sheet) => ({
      ...sheet,
      sections: sheet.sections.map((section) => ({
        ...section,
        subsections: section.subsections.map((subsection) => ({ ...subsection })),
      })),
    })),
  };
}

function renumberPriorities<T extends { priority: number }>(items: T[]): void {
  items.forEach((item, index) => {
    item.priority = index + 1;
  });
}

function translationsFromForm(value: MatrixStructureCreateFormValue): {
  ru: { name: string };
  en: { name: string };
} {
  return {
    ru: { name: value.nameRu.trim() },
    en: { name: value.nameEn.trim() },
  };
}

function capitalizeCreateKind(kind: MatrixCreateKind): 'Sheet' | 'Section' | 'Subsection' {
  if (kind === 'sheet') return 'Sheet';
  if (kind === 'section') return 'Section';
  return 'Subsection';
}
