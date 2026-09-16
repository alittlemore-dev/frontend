import {
  NotificationService,
  ErrorMessageComponent,
  LoadingSpinnerComponent,
  SiteSelectComponent,
  SiteSelectOption,
  ControlValidationStateDirective,
} from '@alittlemore.dev/design-system';
import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiError } from '../../../../../../core/models/api-error.model';
import { I18nService } from '../../../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../../../core/i18n/translate.pipe';
import {
  MarkdownEditorComponent,
  MarkdownEditorImageCapability,
} from '../../../../../../core/editor/workspace-markdown-editor.component';

import { formatAnnualDate } from '../../../shared/annual-date';
import { formatFileSize } from '../../../shared/file-size';

import {
  DropdownAction,
  ActionsDropdownComponent,
} from '../../../../components/actions-dropdown/actions-dropdown.component';

import {
  UnsavedChangesService,
  UnsavedChangesSource,
} from '../../../../../../core/unsaved-changes/unsaved-changes.service';
import {
  VALIDATION_LIMITS,
  controlInvalid,
  emailValidator,
  trimRequired,
  validationMessage,
} from '../../../../utils/validation';
import {
  KnowledgeTag,
  PersonBirthday,
  PersonDetail,
  PersonRelationshipDirection,
  PersonRelationshipType,
  PersonSummary,
  PersonUpdatePayload,
  RelationshipTypePayload,
} from '../../models/people.model';
import { PeopleService } from '../../services/people.service';
import { KnowledgeEditorImagesService } from '../../../shared/knowledge-editor-images.service';
import { KnowledgeFile } from '../../../shared/knowledge-file.model';

interface PersonFormValue {
  lastName: string;
  firstName: string;
  middleName: string;
  email: string;
  phone: string;
  telegram: string;
  birthday: {
    day: string;
    month: string;
    year: string;
  };
  description: string;
}

interface RelationshipFormControls {
  persistedId: FormControl<string>;
  relatedPersonId: FormControl<string>;
  relationshipTypeId: FormControl<string>;
  direction: FormControl<PersonRelationshipDirection>;
  note: FormControl<string>;
}

type RelationshipFormGroup = FormGroup<RelationshipFormControls>;

const RELATIONSHIP_PREVIEW_LIMIT = 5;
const RELATED_DATE_PREVIEW_LIMIT = 10;

@Component({
  selector: 'app-person-detail',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    MarkdownEditorComponent,
    ErrorMessageComponent,
    LoadingSpinnerComponent,
    SiteSelectComponent,
    ActionsDropdownComponent,
    ControlValidationStateDirective,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './person-detail.component.html',
  styleUrl: './person-detail.component.scss',
})
export class PersonDetailComponent implements OnInit, OnDestroy {
  private readonly peopleService = inject(PeopleService);
  private readonly knowledgeEditorImages = inject(KnowledgeEditorImagesService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly document = inject(DOCUMENT);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly unsavedScope = inject(UnsavedChangesService).createScope(this.destroyRef);
  private readonly mainUnsavedSource: UnsavedChangesSource;
  private readonly tagDraftUnsavedSource: UnsavedChangesSource;
  private readonly typeDraftUnsavedSource: UnsavedChangesSource;
  private personId = '';
  private photoObjectUrl: string | null = null;
  private photoLoadGeneration = 0;
  private peopleSearchGeneration = 0;
  private readonly relationshipFormsVersion = signal(0);

  readonly loading = signal(true);
  readonly error = signal<ApiError | null>(null);
  readonly person = signal<PersonDetail | null>(null);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly submitted = signal(false);
  readonly tags = signal<readonly KnowledgeTag[]>([]);
  readonly relationshipTypes = signal<readonly PersonRelationshipType[]>([]);
  readonly personCandidates = signal<readonly PersonSummary[]>([]);
  readonly selectedTagIds = signal<readonly string[]>([]);
  readonly deletedRelationshipIds = signal<readonly string[]>([]);
  readonly formSnapshot = signal<PersonFormValue>(emptyPersonFormValue());
  readonly relationshipSnapshot = signal<readonly unknown[]>([]);
  readonly photoUrl = signal<string | null>(null);
  readonly photoUploading = signal(false);
  readonly photoError = signal<string | null>(null);
  readonly attachmentUploading = signal(false);
  readonly attachmentError = signal<string | null>(null);
  readonly editorImagePending = signal(false);
  readonly tagSearch = signal('');
  readonly tagDialogOpen = signal(false);
  readonly tagDraft = signal('');
  readonly tagEditingId = signal<string | null>(null);
  readonly tagSubmitting = signal(false);
  readonly typeDialogOpen = signal(false);
  readonly typeSubmitting = signal(false);
  readonly typeEditingId = signal<string | null>(null);
  readonly typeFormSnapshot = signal({
    isSymmetric: false,
    forwardName: '',
    reverseName: '',
  });
  readonly relationshipsExpanded = signal(false);
  readonly relatedDatesExpanded = signal(false);
  readonly editorImageCapability = signal<MarkdownEditorImageCapability | null>(null);
  readonly imagePreviewRevision = signal(0);

  readonly personForm = this.formBuilder.group({
    lastName: ['', [trimRequired, Validators.maxLength(VALIDATION_LIMITS.shortText)]],
    firstName: ['', [trimRequired, Validators.maxLength(VALIDATION_LIMITS.shortText)]],
    middleName: ['', Validators.maxLength(VALIDATION_LIMITS.shortText)],
    email: ['', [emailValidator, Validators.maxLength(VALIDATION_LIMITS.email)]],
    phone: ['', Validators.maxLength(64)],
    telegram: ['', Validators.maxLength(VALIDATION_LIMITS.shortText)],
    birthday: this.formBuilder.group(
      {
        day: [''],
        month: [''],
        year: [''],
      },
      { validators: birthdayValidator },
    ),
    description: ['', Validators.maxLength(100000)],
  });
  readonly relationshipForms = new FormArray<RelationshipFormGroup>([]);
  readonly relationshipTypeForm = this.formBuilder.group({
    isSymmetric: [false],
    forwardName: ['', [trimRequired, Validators.maxLength(VALIDATION_LIMITS.shortText)]],
    reverseName: ['', Validators.maxLength(VALIDATION_LIMITS.shortText)],
  });
  readonly mainSnapshot = computed(() => ({
    form: this.formSnapshot(),
    tagIds: this.selectedTagIds(),
    relationships: this.relationshipSnapshot(),
    deletedRelationshipIds: this.deletedRelationshipIds(),
  }));
  readonly relationshipCount = computed(() => {
    this.relationshipFormsVersion();
    return this.relationshipForms.length;
  });
  readonly visibleRelationshipForms = computed(() => {
    this.relationshipFormsVersion();
    return this.relationshipsExpanded()
      ? this.relationshipForms.controls
      : this.relationshipForms.controls.slice(0, RELATIONSHIP_PREVIEW_LIMIT);
  });
  readonly relationshipsCollapsible = computed(
    () => this.relationshipCount() > RELATIONSHIP_PREVIEW_LIMIT,
  );
  readonly visibleRelatedDates = computed(() => {
    const relatedDates = this.person()?.relatedDates ?? [];
    return this.relatedDatesExpanded()
      ? relatedDates
      : relatedDates.slice(0, RELATED_DATE_PREVIEW_LIMIT);
  });
  readonly relatedDatesCollapsible = computed(
    () => (this.person()?.relatedDates.length ?? 0) > RELATED_DATE_PREVIEW_LIMIT,
  );
  private readonly mainSourceActive = computed(() => this.person() !== null && !this.loading());
  readonly filteredTags = computed(() => {
    const query = this.tagSearch().trim().toLocaleLowerCase();
    return query === ''
      ? this.tags()
      : this.tags().filter((tag) => tag.name.toLocaleLowerCase().includes(query));
  });
  readonly dayOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    return [
      { value: '', label: this.i18n.translate('shared.notSet') },
      ...Array.from({ length: 31 }, (_, index) => ({
        value: String(index + 1),
        label: String(index + 1),
      })),
    ];
  });
  readonly monthOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    return [
      { value: '', label: this.i18n.translate('shared.notSet') },
      ...Array.from({ length: 12 }, (_, index) => ({
        value: String(index + 1),
        label: this.i18n.translate(`knowledgePeople.month.${index + 1}`),
      })),
    ];
  });
  readonly relationshipTypeOptions = computed<readonly SiteSelectOption[]>(() =>
    this.relationshipTypes().map((type) => ({
      value: type.id,
      label: type.isSymmetric ? type.forwardName : `${type.forwardName} / ${type.reverseName}`,
    })),
  );
  readonly personCandidateOptions = computed<readonly SiteSelectOption[]>(() => {
    const existing = new Map<string, string>();
    for (const relationship of this.person()?.relationships ?? []) {
      existing.set(relationship.relatedPersonId, relationship.relatedPersonDisplayName);
    }
    for (const person of this.personCandidates()) {
      if (person.id !== this.personId) {
        existing.set(person.id, person.displayName);
      }
    }
    return [...existing].map(([value, label]) => ({ value, label }));
  });
  readonly directionOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    return [
      {
        value: 'forward',
        label: this.i18n.translate('knowledgePeople.relationships.forward'),
      },
      {
        value: 'reverse',
        label: this.i18n.translate('knowledgePeople.relationships.reverse'),
      },
    ];
  });
  readonly editorLanguage = computed(() => {
    const language = this.i18n.language();
    if (language === null) {
      throw new Error('UI language must be initialized before People editor');
    }
    return language;
  });
  readonly validationLimits = VALIDATION_LIMITS;

  constructor() {
    this.mainUnsavedSource = this.unsavedScope.registerSource(
      this.mainSnapshot,
      this.mainSourceActive,
    );
    this.tagDraftUnsavedSource = this.unsavedScope.registerSource(
      this.tagDraft,
      this.tagDialogOpen,
    );
    this.typeDraftUnsavedSource = this.unsavedScope.registerSource(
      this.typeFormSnapshot,
      this.typeDialogOpen,
    );
    this.personForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.formSnapshot.set(this.personForm.getRawValue());
    });
    this.relationshipForms.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.relationshipSnapshot.set(this.relationshipForms.getRawValue()));
    this.relationshipTypeForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.typeFormSnapshot.set(this.relationshipTypeForm.getRawValue()));
  }

  ngOnInit(): void {
    this.personId = this.route.snapshot.paramMap.get('id') ?? '';
    if (this.personId !== '') {
      this.editorImageCapability.set(
        this.knowledgeEditorImages.bind({
          itemId: this.personId,
          attachments: () => this.person()?.attachments ?? [],
          uploaded: (file) => this.addEditorImageAttachment(file),
        }),
      );
    }
    this.loadPerson();
    this.loadTaxonomies();
    this.searchPeople('');
  }

  ngOnDestroy(): void {
    this.revokePhotoUrl();
  }

  loadPerson(): void {
    this.loading.set(true);
    this.error.set(null);
    this.peopleService
      .getPerson(this.personId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (person) => {
          this.person.set(person);
          this.refreshImagePreview();
          this.patchPerson(person);
          this.loading.set(false);
          this.loadPhoto(person.photo);
        },
        error: (error: ApiError) => {
          this.error.set(error);
          this.loading.set(false);
          this.notifications.error(this.i18n.translate('knowledgePeople.detailLoadError'));
        },
      });
  }

  loadTaxonomies(): void {
    this.peopleService
      .listTags('')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tags) => this.tags.set(tags),
        error: () =>
          this.notifications.error(this.i18n.translate('knowledgePeople.tags.loadError')),
      });
    this.peopleService
      .listRelationshipTypes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (types) => this.relationshipTypes.set(types),
        error: () =>
          this.notifications.error(
            this.i18n.translate('knowledgePeople.relationshipTypes.loadError'),
          ),
      });
  }

  searchPeople(query: string): void {
    const generation = ++this.peopleSearchGeneration;
    this.peopleService
      .listPeople({
        page: 1,
        pageSize: 100,
        sort: 'nameAsc',
        searchQuery: query,
        tagIds: [],
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          if (generation !== this.peopleSearchGeneration) {
            return;
          }
          this.personCandidates.set(page.people);
        },
        error: () => {
          if (generation !== this.peopleSearchGeneration) {
            return;
          }
          this.notifications.error(
            this.i18n.translate('knowledgePeople.relationships.peopleSearchError'),
          );
        },
      });
  }

  savePerson(): void {
    if (this.editorImagePending() || this.saving()) {
      return;
    }
    this.submitted.set(true);
    this.personForm.markAllAsTouched();
    this.relationshipForms.markAllAsTouched();
    if (this.personForm.invalid || this.relationshipForms.invalid) {
      if (this.relationshipForms.invalid) {
        this.relationshipsExpanded.set(true);
      }
      this.notifications.error(this.i18n.translate('knowledgePeople.validationError'));
      return;
    }
    this.saving.set(true);
    this.peopleService
      .updatePerson(this.personId, this.buildPayload())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (person) => {
          this.person.set(person);
          this.refreshImagePreview();
          this.patchPerson(person);
          this.saving.set(false);
          this.submitted.set(false);
          this.notifications.success(this.i18n.translate('knowledgePeople.saveSuccess'));
        },
        error: () => {
          this.saving.set(false);
          this.notifications.error(this.i18n.translate('knowledgePeople.saveError'));
        },
      });
  }

  deletePerson(): void {
    const person = this.person();
    const browserWindow = this.document.defaultView;
    if (
      person === null ||
      browserWindow === null ||
      !browserWindow.confirm(
        this.i18n.translate('knowledgePeople.deleteConfirm', { name: person.displayName }),
      )
    ) {
      return;
    }
    this.deleting.set(true);
    this.peopleService
      .deletePerson(person.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.mainUnsavedSource.commit();
          this.notifications.success(this.i18n.translate('knowledgePeople.deleteSuccess'));
          this.back();
        },
        error: () => {
          this.deleting.set(false);
          this.notifications.error(this.i18n.translate('knowledgePeople.deleteError'));
        },
      });
  }

  detailActions(): DropdownAction[] {
    return [
      {
        id: 'delete',
        label: this.i18n.translate('shared.delete'),
        destructive: true,
        disabled: this.saving() || this.deleting() || this.loading(),
      },
    ];
  }

  handleDetailAction(actionId: string): void {
    if (actionId === 'delete') {
      this.deletePerson();
      return;
    }
    throw new Error(`Unsupported People detail action: ${actionId}`);
  }

  back(): void {
    void this.router.navigate(['/personal-workspace/knowledge/people'], {
      queryParamsHandling: 'preserve',
    });
  }

  setDescription(value: string): void {
    this.personForm.controls.description.setValue(value);
    this.personForm.controls.description.markAsDirty();
  }

  toggleTag(tagId: string): void {
    this.selectedTagIds.update((ids) =>
      ids.includes(tagId) ? ids.filter((id) => id !== tagId) : [...ids, tagId],
    );
  }

  addRelationship(): void {
    this.relationshipForms.push(this.createRelationshipForm());
    this.relationshipFormsVersion.update((version) => version + 1);
    this.relationshipsExpanded.set(true);
  }

  removeRelationship(index: number): void {
    const persistedId = this.relationshipForms.at(index).controls.persistedId.value;
    if (persistedId !== '') {
      this.deletedRelationshipIds.update((ids) => [...new Set([...ids, persistedId])]);
    }
    this.relationshipForms.removeAt(index);
    this.relationshipFormsVersion.update((version) => version + 1);
    if (this.relationshipForms.length <= RELATIONSHIP_PREVIEW_LIMIT) {
      this.relationshipsExpanded.set(false);
    }
  }

  toggleRelationshipsExpanded(): void {
    this.relationshipsExpanded.update((expanded) => !expanded);
  }

  toggleRelatedDatesExpanded(): void {
    this.relatedDatesExpanded.update((expanded) => !expanded);
  }

  relationshipLabel(index: number): string {
    const row = this.relationshipForms.at(index).getRawValue();
    const type = this.relationshipTypes().find((value) => value.id === row.relationshipTypeId);
    if (type === undefined) {
      return this.i18n.translate('shared.notSet');
    }
    return row.direction === 'forward' ? type.forwardName : type.reverseName;
  }

  uploadPhoto(event: Event): void {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement) || input.files?.[0] === undefined) {
      return;
    }
    this.photoUploading.set(true);
    this.photoError.set(null);
    this.peopleService
      .replacePhoto(this.personId, input.files[0])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (photo) => {
          this.photoUploading.set(false);
          input.value = '';
          this.person.update((person) => (person === null ? null : { ...person, photo }));
          this.loadPhoto(photo);
          this.notifications.success(this.i18n.translate('knowledgePeople.photoSaveSuccess'));
        },
        error: () => {
          this.photoUploading.set(false);
          this.photoError.set(this.i18n.translate('knowledgePeople.photoSaveError'));
          this.notifications.error(this.i18n.translate('knowledgePeople.photoSaveError'));
        },
      });
  }

  deletePhoto(): void {
    const browserWindow = this.document.defaultView;
    if (
      browserWindow === null ||
      !browserWindow.confirm(this.i18n.translate('knowledgePeople.photoDeleteConfirm'))
    ) {
      return;
    }
    this.photoUploading.set(true);
    this.peopleService
      .deletePhoto(this.personId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.photoUploading.set(false);
          this.person.update((person) => (person === null ? null : { ...person, photo: null }));
          this.revokePhotoUrl();
          this.notifications.success(this.i18n.translate('knowledgePeople.photoDeleteSuccess'));
        },
        error: () => {
          this.photoUploading.set(false);
          this.notifications.error(this.i18n.translate('knowledgePeople.photoDeleteError'));
        },
      });
  }

  uploadAttachment(event: Event): void {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement) || input.files?.[0] === undefined) {
      return;
    }
    const file = input.files[0];
    this.attachmentUploading.set(true);
    this.attachmentError.set(null);
    this.peopleService
      .uploadAttachment(this.personId, file, file.name)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (attachment) => {
          input.value = '';
          this.attachmentUploading.set(false);
          this.person.update((person) =>
            person === null
              ? null
              : { ...person, attachments: [...person.attachments, attachment] },
          );
          this.refreshImagePreview();
          this.notifications.success(this.i18n.translate('knowledgePeople.attachmentSaveSuccess'));
        },
        error: () => {
          this.attachmentUploading.set(false);
          this.attachmentError.set(this.i18n.translate('knowledgePeople.attachmentSaveError'));
          this.notifications.error(this.i18n.translate('knowledgePeople.attachmentSaveError'));
        },
      });
  }

  renameAttachment(attachment: KnowledgeFile): void {
    const name = this.document.defaultView?.prompt(
      this.i18n.translate('knowledgePeople.attachmentRenamePrompt'),
      attachment.name,
    );
    if (name === undefined || name === null || name.trim() === '') {
      return;
    }
    this.peopleService
      .renameAttachment(this.personId, attachment.id, name.trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.person.update((person) =>
            person === null
              ? null
              : {
                  ...person,
                  attachments: person.attachments.map((file) =>
                    file.id === updated.id ? updated : file,
                  ),
                },
          );
          this.refreshImagePreview();
          this.notifications.success(
            this.i18n.translate('knowledgePeople.attachmentRenameSuccess'),
          );
        },
        error: () =>
          this.notifications.error(this.i18n.translate('knowledgePeople.attachmentRenameError')),
      });
  }

  deleteAttachment(attachment: KnowledgeFile): void {
    const browserWindow = this.document.defaultView;
    if (
      browserWindow === null ||
      !browserWindow.confirm(
        this.i18n.translate('knowledgePeople.attachmentDeleteConfirm', {
          name: attachment.name,
        }),
      )
    ) {
      return;
    }
    this.peopleService
      .deleteAttachment(this.personId, attachment.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.person.update((person) =>
            person === null
              ? null
              : {
                  ...person,
                  attachments: person.attachments.filter((file) => file.id !== attachment.id),
                },
          );
          this.refreshImagePreview();
          this.notifications.success(
            this.i18n.translate('knowledgePeople.attachmentDeleteSuccess'),
          );
        },
        error: () =>
          this.notifications.error(this.i18n.translate('knowledgePeople.attachmentDeleteError')),
      });
  }

  downloadAttachment(attachment: KnowledgeFile): void {
    const browserWindow = this.document.defaultView;
    if (browserWindow === null) {
      this.notifications.error(this.i18n.translate('knowledgePeople.attachmentDownloadError'));
      return;
    }
    this.peopleService
      .getFileContent(attachment.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const url = browserWindow.URL.createObjectURL(blob);
          const anchor = this.document.createElement('a');
          anchor.href = url;
          anchor.download = attachment.originalName;
          anchor.click();
          browserWindow.URL.revokeObjectURL(url);
        },
        error: () =>
          this.notifications.error(this.i18n.translate('knowledgePeople.attachmentDownloadError')),
      });
  }

  private addEditorImageAttachment(attachment: KnowledgeFile): void {
    let added = false;
    this.person.update((person) => {
      if (person === null || person.attachments.some((file) => file.id === attachment.id)) {
        return person;
      }
      added = true;
      return { ...person, attachments: [...person.attachments, attachment] };
    });
    if (added) {
      this.refreshImagePreview();
    }
  }

  private refreshImagePreview(): void {
    this.imagePreviewRevision.update((revision) => revision + 1);
  }

  openTagDialog(): void {
    this.tagDraft.set('');
    this.tagEditingId.set(null);
    this.tagDraftUnsavedSource.commit();
    this.tagDialogOpen.set(true);
  }

  closeTagDialog(): void {
    if (!this.tagSubmitting() && this.unsavedScope.confirmDiscardExcept([this.mainUnsavedSource])) {
      this.tagDialogOpen.set(false);
    }
  }

  editTag(tag: KnowledgeTag): void {
    this.tagEditingId.set(tag.id);
    this.tagDraft.set(tag.name);
    this.tagDraftUnsavedSource.commit();
  }

  saveTag(): void {
    const name = this.tagDraft().trim();
    if (name === '') {
      this.notifications.error(this.i18n.translate('knowledgePeople.tags.nameRequired'));
      return;
    }
    this.tagSubmitting.set(true);
    const request =
      this.tagEditingId() === null
        ? this.peopleService.createTag(name)
        : this.peopleService.updateTag(this.tagEditingId()!, name);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.tagSubmitting.set(false);
        this.tagDraft.set('');
        this.tagEditingId.set(null);
        this.tagDraftUnsavedSource.commit();
        this.notifications.success(this.i18n.translate('knowledgePeople.tags.saveSuccess'));
        this.loadTaxonomies();
      },
      error: () => {
        this.tagSubmitting.set(false);
        this.notifications.error(this.i18n.translate('knowledgePeople.tags.saveError'));
      },
    });
  }

  deleteTag(tag: KnowledgeTag): void {
    const browserWindow = this.document.defaultView;
    if (
      browserWindow === null ||
      !browserWindow.confirm(
        this.i18n.translate('knowledgePeople.tags.deleteConfirm', { name: tag.name }),
      )
    ) {
      return;
    }
    this.peopleService
      .deleteTag(tag.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.selectedTagIds.update((ids) => ids.filter((id) => id !== tag.id));
          this.notifications.success(this.i18n.translate('knowledgePeople.tags.deleteSuccess'));
          this.loadTaxonomies();
        },
        error: () =>
          this.notifications.error(this.i18n.translate('knowledgePeople.tags.deleteConflict')),
      });
  }

  openRelationshipTypeDialog(): void {
    this.typeEditingId.set(null);
    this.relationshipTypeForm.reset({
      isSymmetric: false,
      forwardName: '',
      reverseName: '',
    });
    this.typeFormSnapshot.set(this.relationshipTypeForm.getRawValue());
    this.typeDraftUnsavedSource.commit();
    this.typeDialogOpen.set(true);
  }

  closeRelationshipTypeDialog(): void {
    if (
      !this.typeSubmitting() &&
      this.unsavedScope.confirmDiscardExcept([this.mainUnsavedSource])
    ) {
      this.typeDialogOpen.set(false);
    }
  }

  editRelationshipType(type: PersonRelationshipType): void {
    this.typeEditingId.set(type.id);
    this.relationshipTypeForm.setValue({
      isSymmetric: type.isSymmetric,
      forwardName: type.forwardName,
      reverseName: type.isSymmetric ? '' : type.reverseName,
    });
    this.typeDraftUnsavedSource.commit();
  }

  saveRelationshipType(): void {
    this.relationshipTypeForm.markAllAsTouched();
    const value = this.relationshipTypeForm.getRawValue();
    if (
      this.relationshipTypeForm.invalid ||
      (!value.isSymmetric && value.reverseName.trim() === '')
    ) {
      this.notifications.error(this.i18n.translate('knowledgePeople.validationError'));
      return;
    }
    const payload: RelationshipTypePayload = {
      isSymmetric: value.isSymmetric,
      forwardName: value.forwardName.trim(),
      reverseName: value.isSymmetric ? '' : value.reverseName.trim(),
    };
    this.typeSubmitting.set(true);
    const request =
      this.typeEditingId() === null
        ? this.peopleService.createRelationshipType(payload)
        : this.peopleService.updateRelationshipType(this.typeEditingId()!, payload);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.typeSubmitting.set(false);
        this.relationshipTypeForm.reset({
          isSymmetric: false,
          forwardName: '',
          reverseName: '',
        });
        this.typeEditingId.set(null);
        this.typeDraftUnsavedSource.commit();
        this.notifications.success(
          this.i18n.translate('knowledgePeople.relationshipTypes.saveSuccess'),
        );
        this.loadTaxonomies();
      },
      error: () => {
        this.typeSubmitting.set(false);
        this.notifications.error(
          this.i18n.translate('knowledgePeople.relationshipTypes.saveError'),
        );
      },
    });
  }

  deleteRelationshipType(type: PersonRelationshipType): void {
    const browserWindow = this.document.defaultView;
    if (
      browserWindow === null ||
      !browserWindow.confirm(
        this.i18n.translate('knowledgePeople.relationshipTypes.deleteConfirm', {
          name: type.forwardName,
        }),
      )
    ) {
      return;
    }
    this.peopleService
      .deleteRelationshipType(type.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notifications.success(
            this.i18n.translate('knowledgePeople.relationshipTypes.deleteSuccess'),
          );
          this.loadTaxonomies();
        },
        error: () =>
          this.notifications.error(
            this.i18n.translate('knowledgePeople.relationshipTypes.deleteConflict'),
          ),
      });
  }

  fieldInvalid(field: 'lastName' | 'firstName' | 'email' | 'telegram'): boolean {
    return controlInvalid(this.personForm.controls[field], this.submitted());
  }

  fieldMessage(field: 'lastName' | 'firstName' | 'email' | 'telegram'): string | null {
    return validationMessage(this.personForm.controls[field], this.i18n);
  }

  birthdayInvalid(): boolean {
    return this.personForm.controls.birthday.invalid && this.submitted();
  }

  typeFieldInvalid(field: 'forwardName' | 'reverseName'): boolean {
    const control = this.relationshipTypeForm.controls[field];
    if (
      field === 'reverseName' &&
      !this.relationshipTypeForm.controls.isSymmetric.value &&
      control.value.trim() === ''
    ) {
      return control.touched;
    }
    return controlInvalid(control, false);
  }

  fileSize(sizeBytes: number): string {
    return formatFileSize(sizeBytes, this.i18n.dateLocale());
  }

  annualDateLabel(value: PersonBirthday): string {
    return formatAnnualDate(value, this.i18n.dateLocale());
  }

  onTagDraftInput(event: Event): void {
    const target = event.currentTarget;
    if (target instanceof HTMLInputElement) {
      this.tagDraft.set(target.value);
    }
  }

  onTagSearchInput(event: Event): void {
    const target = event.currentTarget;
    if (target instanceof HTMLInputElement) {
      this.tagSearch.set(target.value);
    }
  }

  private patchPerson(person: PersonDetail): void {
    this.personForm.setValue({
      lastName: person.lastName,
      firstName: person.firstName,
      middleName: person.middleName,
      email: person.email,
      phone: person.phone,
      telegram: person.telegram,
      birthday: {
        day: person.birthday === null ? '' : String(person.birthday.day),
        month: person.birthday === null ? '' : String(person.birthday.month),
        year:
          person.birthday === null || person.birthday.year === null
            ? ''
            : String(person.birthday.year),
      },
      description: person.description,
    });
    this.selectedTagIds.set(person.tags.map((tag) => tag.id));
    this.deletedRelationshipIds.set([]);
    this.relationshipsExpanded.set(false);
    this.relatedDatesExpanded.set(false);
    this.relationshipForms.clear();
    for (const relationship of person.relationships) {
      this.relationshipForms.push(
        this.createRelationshipForm({
          persistedId: relationship.id,
          relatedPersonId: relationship.relatedPersonId,
          relationshipTypeId: relationship.relationshipType.id,
          direction: relationship.direction,
          note: relationship.note,
        }),
      );
    }
    this.relationshipFormsVersion.update((version) => version + 1);
    this.formSnapshot.set(this.personForm.getRawValue());
    this.relationshipSnapshot.set(this.relationshipForms.getRawValue());
    this.mainUnsavedSource.commit();
  }

  private createRelationshipForm(
    value: {
      persistedId: string;
      relatedPersonId: string;
      relationshipTypeId: string;
      direction: PersonRelationshipDirection;
      note: string;
    } = {
      persistedId: '',
      relatedPersonId: '',
      relationshipTypeId: '',
      direction: 'forward',
      note: '',
    },
  ): RelationshipFormGroup {
    return new FormGroup<RelationshipFormControls>({
      persistedId: new FormControl(value.persistedId, { nonNullable: true }),
      relatedPersonId: new FormControl(value.relatedPersonId, {
        nonNullable: true,
        validators: Validators.required,
      }),
      relationshipTypeId: new FormControl(value.relationshipTypeId, {
        nonNullable: true,
        validators: Validators.required,
      }),
      direction: new FormControl(value.direction, {
        nonNullable: true,
        validators: Validators.required,
      }),
      note: new FormControl(value.note, {
        nonNullable: true,
        validators: Validators.maxLength(10000),
      }),
    });
  }

  private buildPayload(): PersonUpdatePayload {
    const value = this.personForm.getRawValue();
    const rows = this.relationshipForms.getRawValue();
    return {
      lastName: value.lastName.trim(),
      firstName: value.firstName.trim(),
      middleName: value.middleName.trim(),
      email: value.email.trim(),
      phone: value.phone.trim(),
      telegram: value.telegram.trim(),
      birthday:
        value.birthday.day === '' || value.birthday.month === ''
          ? null
          : {
              day: Number(value.birthday.day),
              month: Number(value.birthday.month),
              year: value.birthday.year === '' ? null : Number(value.birthday.year),
            },
      description: value.description,
      tagIds: this.selectedTagIds(),
      relationshipChanges: {
        create: rows
          .filter((row) => row.persistedId === '')
          .map((row) => ({
            relatedPersonId: row.relatedPersonId,
            relationshipTypeId: row.relationshipTypeId,
            direction: row.direction,
            note: row.note.trim(),
          })),
        update: rows
          .filter((row) => row.persistedId !== '')
          .map((row) => ({
            id: row.persistedId,
            relatedPersonId: row.relatedPersonId,
            relationshipTypeId: row.relationshipTypeId,
            direction: row.direction,
            note: row.note.trim(),
          })),
        deleteIds: this.deletedRelationshipIds(),
      },
    };
  }

  private loadPhoto(photo: KnowledgeFile | null): void {
    this.revokePhotoUrl();
    const generation = ++this.photoLoadGeneration;
    const browserUrl = this.document.defaultView?.URL;
    if (photo === null || browserUrl === undefined) {
      return;
    }
    this.peopleService
      .getFileContent(photo.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          if (generation !== this.photoLoadGeneration) {
            return;
          }
          this.revokeCurrentPhotoObjectUrl();
          this.photoObjectUrl = browserUrl.createObjectURL(blob);
          this.photoUrl.set(this.photoObjectUrl);
        },
        error: () => {
          this.photoError.set(this.i18n.translate('knowledgePeople.photoLoadError'));
        },
      });
  }

  private revokePhotoUrl(): void {
    this.photoLoadGeneration += 1;
    this.revokeCurrentPhotoObjectUrl();
  }

  private revokeCurrentPhotoObjectUrl(): void {
    if (this.photoObjectUrl !== null) {
      this.document.defaultView?.URL.revokeObjectURL(this.photoObjectUrl);
    }
    this.photoObjectUrl = null;
    this.photoUrl.set(null);
  }
}

function emptyPersonFormValue(): PersonFormValue {
  return {
    lastName: '',
    firstName: '',
    middleName: '',
    email: '',
    phone: '',
    telegram: '',
    birthday: { day: '', month: '', year: '' },
    description: '',
  };
}

function birthdayValidator(control: AbstractControl): ValidationErrors | null {
  const day = control.get('day')?.value;
  const month = control.get('month')?.value;
  const year = control.get('year')?.value;
  if (typeof day !== 'string' || typeof month !== 'string' || typeof year !== 'string') {
    return { birthday: true };
  }
  if (day === '' && month === '' && year === '') {
    return null;
  }
  if (day === '' || month === '') {
    return { birthday: true };
  }
  const numericDay = Number(day);
  const numericMonth = Number(month);
  const validationYear = year === '' ? 2000 : Number(year);
  if (
    !Number.isInteger(numericDay) ||
    !Number.isInteger(numericMonth) ||
    !Number.isInteger(validationYear) ||
    validationYear < 1 ||
    validationYear > 9999
  ) {
    return { birthday: true };
  }
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(validationYear, numericMonth - 1, numericDay);
  if (
    date.getUTCFullYear() !== validationYear ||
    date.getUTCMonth() !== numericMonth - 1 ||
    date.getUTCDate() !== numericDay
  ) {
    return { birthday: true };
  }
  if (year !== '') {
    const today = new Date();
    const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    if (date.getTime() > todayUtc) {
      return { birthdayFuture: true };
    }
  }
  return null;
}
