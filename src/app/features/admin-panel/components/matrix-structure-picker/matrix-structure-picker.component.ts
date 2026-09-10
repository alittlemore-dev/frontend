import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { finalize, map, switchMap } from 'rxjs';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { LanguageCode } from '../../../../core/i18n/i18n.model';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import {
  AdminMatrixStructure,
  AdminMatrixStructureSection,
  AdminMatrixStructureSheet,
  AdminMatrixStructureSubsection,
} from '../../models/matrix-question-workspace.model';
import { MatrixQuestionWorkspaceService } from '../../services/matrix-question-workspace.service';
import { AdminControlValidationStateDirective } from '../../directives/admin-control-validation-state.directive';
import {
  AdminUnsavedChangesScope,
  AdminUnsavedChangesSource,
} from '../../services/admin-unsaved-changes.service';
import {
  ADMIN_VALIDATION_LIMITS,
  slugValidator,
  trimRequired,
  validationMessage,
} from '../../utils/admin-validation';
import {
  SiteSelectComponent,
  SiteSelectOption,
} from '../../../../shared/ui/site-select/site-select.component';

interface MatrixStructureCreateFormValue {
  nameRu: string;
  nameEn: string;
}

@Component({
  selector: 'app-matrix-structure-picker',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    AdminControlValidationStateDirective,
    SiteSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './matrix-structure-picker.component.html',
})
export class MatrixStructurePickerComponent implements OnInit, OnChanges {
  private readonly workspaceService = inject(MatrixQuestionWorkspaceService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) language!: LanguageCode;
  @Input({ required: true }) selectedSubsectionId!: string | null;
  @Input({ required: true }) preferredSheetKey!: string | null;
  @Input() disabled = false;
  @Input() invalid = false;
  @Input({ required: true }) unsavedChangesScope!: AdminUnsavedChangesScope;

  @Output() readonly selectedSubsectionIdChange = new EventEmitter<string | null>();

  readonly structure = signal<AdminMatrixStructure>({ sheets: [] });
  readonly loading = signal(false);
  readonly creating = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly missingPreferredSheetKey = signal<string | null>(null);
  readonly selectedSheetId = signal<string | null>(null);
  readonly selectedSectionId = signal<string | null>(null);
  readonly validationLimits = ADMIN_VALIDATION_LIMITS;

  readonly selectedSections = computed(() => {
    const sheetId = this.selectedSheetId();
    if (sheetId === null) return [];
    return this.structure().sheets.find((sheet) => sheet.id === sheetId)?.sections ?? [];
  });
  readonly selectedSubsections = computed(() => {
    const sectionId = this.selectedSectionId();
    if (sectionId === null) return [];
    return this.selectedSections().find((section) => section.id === sectionId)?.subsections ?? [];
  });
  readonly sheetSelectOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    return [
      { value: '', label: this.i18n.translate('shared.notSet') },
      ...this.structure().sheets.map((sheet) => ({ value: sheet.id, label: sheet.name })),
    ];
  });
  readonly sectionSelectOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    return [
      { value: '', label: this.i18n.translate('shared.notSet') },
      ...this.selectedSections().map((section) => ({
        value: section.id,
        label: section.name,
      })),
    ];
  });
  readonly subsectionSelectOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    return [
      { value: '', label: this.i18n.translate('shared.notSet') },
      ...this.selectedSubsections().map((subsection) => ({
        value: subsection.id,
        label: subsection.name,
      })),
    ];
  });

  readonly sheetForm = this.formBuilder.group({
    key: [
      '',
      [trimRequired, Validators.maxLength(ADMIN_VALIDATION_LIMITS.shortText), slugValidator],
    ],
    nameRu: ['', [trimRequired, Validators.maxLength(ADMIN_VALIDATION_LIMITS.shortText)]],
    nameEn: ['', [trimRequired, Validators.maxLength(ADMIN_VALIDATION_LIMITS.shortText)]],
  });
  readonly sectionForm = this.formBuilder.group({
    nameRu: ['', [trimRequired, Validators.maxLength(ADMIN_VALIDATION_LIMITS.shortText)]],
    nameEn: ['', [trimRequired, Validators.maxLength(ADMIN_VALIDATION_LIMITS.shortText)]],
  });
  readonly subsectionForm = this.formBuilder.group({
    nameRu: ['', [trimRequired, Validators.maxLength(ADMIN_VALIDATION_LIMITS.shortText)]],
    nameEn: ['', [trimRequired, Validators.maxLength(ADMIN_VALIDATION_LIMITS.shortText)]],
  });
  private readonly sheetFormValue = toSignal(
    this.sheetForm.valueChanges.pipe(map(() => this.sheetForm.getRawValue())),
    { initialValue: this.sheetForm.getRawValue() },
  );
  private readonly sectionFormValue = toSignal(
    this.sectionForm.valueChanges.pipe(map(() => this.sectionForm.getRawValue())),
    { initialValue: this.sectionForm.getRawValue() },
  );
  private readonly subsectionFormValue = toSignal(
    this.subsectionForm.valueChanges.pipe(map(() => this.subsectionForm.getRawValue())),
    { initialValue: this.subsectionForm.getRawValue() },
  );
  private readonly draftTrackingActive = signal(true);
  private sheetUnsavedSource: AdminUnsavedChangesSource | null = null;
  private sectionUnsavedSource: AdminUnsavedChangesSource | null = null;
  private subsectionUnsavedSource: AdminUnsavedChangesSource | null = null;
  private readonly sheetSelect = viewChild.required<SiteSelectComponent>('sheetSelect');
  private readonly sectionSelect = viewChild.required<SiteSelectComponent>('sectionSelect');
  private readonly subsectionSelect = viewChild.required<SiteSelectComponent>('subsectionSelect');

  ngOnInit(): void {
    this.sheetUnsavedSource = this.unsavedChangesScope.registerSource(
      this.sheetFormValue,
      this.draftTrackingActive,
    );
    this.sectionUnsavedSource = this.unsavedChangesScope.registerSource(
      this.sectionFormValue,
      this.draftTrackingActive,
    );
    this.subsectionUnsavedSource = this.unsavedChangesScope.registerSource(
      this.subsectionFormValue,
      this.draftTrackingActive,
    );
    this.destroyRef.onDestroy(() => {
      this.sheetUnsavedSource?.unregister();
      this.sectionUnsavedSource?.unregister();
      this.subsectionUnsavedSource?.unregister();
    });
    this.loadStructure();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['language'] && !changes['language'].firstChange) {
      this.loadStructure();
      return;
    }
    if (
      (changes['selectedSubsectionId'] && !changes['selectedSubsectionId'].firstChange) ||
      (changes['preferredSheetKey'] && !changes['preferredSheetKey'].firstChange)
    ) {
      this.alignSelectionToCurrentInputs();
    }
  }

  onSheetChange(value: string): void {
    this.missingPreferredSheetKey.set(null);
    this.selectedSheetId.set(optionalString(value));
    this.selectedSectionId.set(null);
    this.selectedSubsectionIdChange.emit(null);
  }

  onSectionChange(value: string): void {
    this.selectedSectionId.set(optionalString(value));
    this.selectedSubsectionIdChange.emit(null);
  }

  onSubsectionChange(value: string): void {
    this.selectedSubsectionIdChange.emit(optionalString(value));
  }

  focusSubsection(): void {
    const subsection = this.subsectionSelect();
    const section = this.sectionSelect();
    const sheet = this.sheetSelect();
    const select = !subsection.effectiveDisabled()
      ? subsection
      : !section.effectiveDisabled()
        ? section
        : sheet;
    select.scrollIntoView({ behavior: 'smooth', block: 'center' });
    select.focus({ preventScroll: true });
  }

  controlInvalid(control: AbstractControl<unknown>): boolean {
    return control.invalid && control.touched;
  }

  controlMessage(control: AbstractControl<unknown>): string | null {
    return validationMessage(control, this.i18n);
  }

  createSheet(): void {
    if (this.sheetForm.invalid) {
      this.sheetForm.markAllAsTouched();
      return;
    }
    const value = this.sheetForm.getRawValue();
    this.creating.set(true);
    this.errorKey.set(null);
    this.workspaceService
      .createSheet(
        {
          key: value.key.trim(),
          translations: translationsFromForm(value),
        },
        this.language,
      )
      .pipe(
        switchMap((sheet) =>
          this.workspaceService
            .getStructure(this.language)
            .pipe(map((structure) => ({ structure, sheet }))),
        ),
        finalize(() => this.creating.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ structure, sheet }) => {
          this.structure.set(structure);
          this.selectedSheetId.set(sheet.id);
          this.selectedSectionId.set(null);
          this.missingPreferredSheetKey.set(null);
          this.selectedSubsectionIdChange.emit(null);
          this.sheetForm.reset();
          this.sheetUnsavedSource?.commit();
        },
        error: () => this.errorKey.set('adminMatrixStructure.createError'),
      });
  }

  createSection(): void {
    const sheetId = this.selectedSheetId();
    if (sheetId === null) return;
    if (this.sectionForm.invalid) {
      this.sectionForm.markAllAsTouched();
      return;
    }
    const value = this.sectionForm.getRawValue();
    this.creating.set(true);
    this.errorKey.set(null);
    this.workspaceService
      .createSection(sheetId, { translations: translationsFromForm(value) }, this.language)
      .pipe(
        switchMap((section) =>
          this.workspaceService
            .getStructure(this.language)
            .pipe(map((structure) => ({ structure, section }))),
        ),
        finalize(() => this.creating.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ structure, section }) => {
          this.structure.set(structure);
          this.selectedSectionId.set(section.id);
          this.selectedSubsectionIdChange.emit(null);
          this.sectionForm.reset();
          this.sectionUnsavedSource?.commit();
        },
        error: () => this.errorKey.set('adminMatrixStructure.createError'),
      });
  }

  createSubsection(): void {
    const sectionId = this.selectedSectionId();
    if (sectionId === null) return;
    if (this.subsectionForm.invalid) {
      this.subsectionForm.markAllAsTouched();
      return;
    }
    const value = this.subsectionForm.getRawValue();
    this.creating.set(true);
    this.errorKey.set(null);
    this.workspaceService
      .createSubsection(sectionId, { translations: translationsFromForm(value) }, this.language)
      .pipe(
        switchMap((subsection) =>
          this.workspaceService
            .getStructure(this.language)
            .pipe(map((structure) => ({ structure, subsection }))),
        ),
        finalize(() => this.creating.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ structure, subsection }) => {
          this.structure.set(structure);
          this.selectedSubsectionIdChange.emit(subsection.id);
          this.alignSelectionToSubsection(subsection.id);
          this.subsectionForm.reset();
          this.subsectionUnsavedSource?.commit();
        },
        error: () => this.errorKey.set('adminMatrixStructure.createError'),
      });
  }

  discardDrafts(): void {
    this.sheetForm.reset();
    this.sectionForm.reset();
    this.subsectionForm.reset();
    this.sheetUnsavedSource?.commit();
    this.sectionUnsavedSource?.commit();
    this.subsectionUnsavedSource?.commit();
  }

  private loadStructure(): void {
    this.loading.set(true);
    this.errorKey.set(null);
    this.workspaceService
      .getStructure(this.language)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (structure) => {
          this.structure.set(structure);
          this.alignSelectionToCurrentInputs();
        },
        error: () => this.errorKey.set('adminMatrixStructure.loadError'),
      });
  }

  private alignSelectionToCurrentInputs(): void {
    if (this.selectedSubsectionId !== null) {
      this.alignSelectionToSubsection(this.selectedSubsectionId);
      return;
    }
    this.alignSelectionToPreferredSheetKey();
  }

  private alignSelectionToSubsection(subsectionId: string | null): void {
    const path = subsectionId === null ? null : findSubsectionPath(this.structure(), subsectionId);
    this.selectedSheetId.set(path?.sheet.id ?? null);
    this.selectedSectionId.set(path?.section.id ?? null);
    this.missingPreferredSheetKey.set(null);
  }

  private alignSelectionToPreferredSheetKey(): void {
    const sheetKey = normalizeSheetKey(this.preferredSheetKey);
    if (sheetKey === null) {
      this.selectedSheetId.set(null);
      this.selectedSectionId.set(null);
      this.missingPreferredSheetKey.set(null);
      return;
    }
    const sheet = findSheetByKey(this.structure(), sheetKey);
    if (sheet === null) {
      this.selectedSheetId.set(null);
      this.selectedSectionId.set(null);
      this.missingPreferredSheetKey.set(sheetKey);
      const currentDraft = this.sheetForm.getRawValue();
      if (
        currentDraft.key.trim() === '' &&
        currentDraft.nameRu.trim() === '' &&
        currentDraft.nameEn.trim() === ''
      ) {
        this.sheetForm.reset({ key: sheetKey, nameRu: '', nameEn: '' });
        this.sheetUnsavedSource?.commit();
      }
      return;
    }
    this.selectedSheetId.set(sheet.id);
    this.selectedSectionId.set(null);
    this.missingPreferredSheetKey.set(null);
  }
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

function optionalString(value: string): string | null {
  return value === '' ? null : value;
}

function normalizeSheetKey(value: string | null): string | null {
  const normalized = value?.trim().toLowerCase() ?? '';
  if (normalized.length === 0) return null;
  return normalized;
}

function findSheetByKey(
  structure: AdminMatrixStructure,
  sheetKey: string,
): AdminMatrixStructureSheet | null {
  return structure.sheets.find((sheet) => normalizeSheetKey(sheet.key) === sheetKey) ?? null;
}

function findSubsectionPath(
  structure: AdminMatrixStructure,
  subsectionId: string,
): {
  sheet: AdminMatrixStructureSheet;
  section: AdminMatrixStructureSection;
  subsection: AdminMatrixStructureSubsection;
} | null {
  for (const sheet of structure.sheets) {
    for (const section of sheet.sections) {
      const subsection = section.subsections.find((item) => item.id === subsectionId);
      if (subsection !== undefined) {
        return { sheet, section, subsection };
      }
    }
  }
  return null;
}
