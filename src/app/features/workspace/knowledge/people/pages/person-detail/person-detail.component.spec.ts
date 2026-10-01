import { NotificationService } from '@alittlemore.dev/design-system';
import { Component, input, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, Router, provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { RouterTestingHarness } from '@angular/router/testing';
import { unsavedChangesGuard } from '../../../../guards/unsaved-changes.guard';
import {
  MarkdownEditorComponent,
  MarkdownEditorImageCapability,
} from '../../../../../../core/editor/workspace-markdown-editor.component';

import { provideI18nTesting } from '../../../../../../testing/i18n-testing';
import { PersonDetail } from '../../models/people.model';
import { PeopleService } from '../../services/people.service';
import { KnowledgeEditorImagesService } from '../../../shared/knowledge-editor-images.service';
import { PersonDetailComponent } from './person-detail.component';

const PERSON: PersonDetail = {
  id: 'person-1',
  displayName: 'Иванов Иван',
  lastName: 'Иванов',
  firstName: 'Иван',
  middleName: '',
  email: '',
  phone: '',
  telegram: '@ivanov',
  birthday: { day: 29, month: 2, year: null },
  description: '<script>alert(1)</script>',
  notificationsEnabled: true,
  tags: [],
  relationships: [],
  relatedDates: [
    {
      id: 'date-1',
      displayName: 'Годовщина',
      date: { day: 29, month: 2, year: null },
    },
  ],
  photo: null,
  attachments: [],
  createdAt: '2026-01-01T00:00:00+00:00',
  updatedAt: '2026-01-01T00:00:00+00:00',
};

describe('PersonDetailComponent', () => {
  let fixture: ComponentFixture<PersonDetailComponent>;
  let peopleService: Record<string, jest.Mock>;
  let notifications: { success: jest.Mock; error: jest.Mock };
  let knowledgeEditorImages: { bind: jest.Mock };
  let router: Router;

  beforeEach(async () => {
    peopleService = {
      getPerson: jest.fn().mockReturnValue(of(PERSON)),
      listTags: jest.fn().mockReturnValue(of([])),
      listRelationshipTypes: jest.fn().mockReturnValue(of([])),
      listPeople: jest.fn().mockReturnValue(of({ totalCount: 0, totalPages: 1, people: [] })),
      updatePerson: jest.fn().mockReturnValue(of(PERSON)),
      deletePerson: jest.fn().mockReturnValue(of(void 0)),
      getFileContent: jest.fn(),
      replacePhoto: jest.fn(),
      deletePhoto: jest.fn(),
      uploadAttachment: jest.fn(),
      renameAttachment: jest.fn(),
      deleteAttachment: jest.fn(),
      createTag: jest.fn(),
      updateTag: jest.fn(),
      deleteTag: jest.fn(),
      createRelationshipType: jest.fn(),
      updateRelationshipType: jest.fn(),
      deleteRelationshipType: jest.fn(),
    };
    notifications = { success: jest.fn(), error: jest.fn() };
    knowledgeEditorImages = {
      bind: jest.fn(
        (binding: {
          uploaded: (file: PersonDetail['attachments'][number]) => void;
        }): MarkdownEditorImageCapability => ({
          acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
          upload: (file) => {
            const uploaded = {
              id: 'editor-image-1',
              itemId: 'person-1',
              kind: 'attachment' as const,
              processing: 'normalizedRasterImage' as const,
              mimeType: 'image/webp',
              sizeBytes: 7,
              name: file.name,
              originalName: file.name,
              contentPath: '/api/knowledge/files/editor-image-1/content',
              createdAt: PERSON.createdAt,
              updatedAt: PERSON.updatedAt,
            };
            binding.uploaded(uploaded);
            return of({
              markdownUrl: '/api/knowledge/files/editor-image-1/content#fileId=editor-image-1',
            });
          },
          loadPreview: () => of(new Blob(['private'], { type: 'image/webp' })),
        }),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [PersonDetailComponent],
      providers: [
        provideRouter([]),
        provideI18nTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: 'person-1' })),
          },
        },
        { provide: PeopleService, useValue: peopleService },
        { provide: KnowledgeEditorImagesService, useValue: knowledgeEditorImages },
        { provide: NotificationService, useValue: notifications },
      ],
    })
      .overrideComponent(PersonDetailComponent, {
        remove: { imports: [MarkdownEditorComponent] },
        add: { imports: [MarkdownEditorStubComponent] },
      })
      .compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(PersonDetailComponent);
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector(
      '[data-testid="relationship-dialog"]',
    ) as HTMLDialogElement;
    dialog.showModal = () => dialog.setAttribute('open', '');
    dialog.close = () => {
      dialog.removeAttribute('open');
      dialog.dispatchEvent(new Event('close'));
    };
  });

  it('reloads a reused card on relationship navigation and protects its unsaved draft', async () => {
    fixture.destroy();
    TestBed.resetTestingModule();
    const secondPerson = {
      ...PERSON,
      id: 'person-2',
      firstName: 'Пётр',
      displayName: 'Иванов Пётр',
    };
    peopleService.getPerson.mockImplementation((id: string) =>
      of(id === PERSON.id ? PERSON : secondPerson),
    );
    await TestBed.configureTestingModule({
      imports: [PersonDetailComponent],
      providers: [
        provideRouter([
          {
            path: 'personal-workspace/knowledge/people/:id',
            component: PersonDetailComponent,
            canDeactivate: [unsavedChangesGuard],
          },
        ]),
        provideI18nTesting(),
        { provide: PeopleService, useValue: peopleService },
        { provide: KnowledgeEditorImagesService, useValue: knowledgeEditorImages },
        { provide: NotificationService, useValue: notifications },
      ],
    })
      .overrideComponent(PersonDetailComponent, {
        remove: { imports: [MarkdownEditorComponent] },
        add: { imports: [MarkdownEditorStubComponent] },
      })
      .compileComponents();
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl(
      '/personal-workspace/knowledge/people/person-1',
      PersonDetailComponent,
    );
    component.setDescription('Unsaved first card');
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    try {
      expect(
        await TestBed.inject(Router).navigateByUrl('/personal-workspace/knowledge/people/person-2'),
      ).toBe(false);
      expect(component.person()?.id).toBe(PERSON.id);
      confirm.mockReturnValue(true);
      const pendingSave = new Subject<PersonDetail>();
      peopleService.updatePerson.mockReturnValue(pendingSave.asObservable());
      component.savePerson();
      const reused = await harness.navigateByUrl(
        '/personal-workspace/knowledge/people/person-2',
        PersonDetailComponent,
      );
      pendingSave.next(PERSON);
      pendingSave.complete();
      expect(reused).toBe(component);
      expect(component.person()?.id).toBe(secondPerson.id);
      expect(component.personForm.controls.firstName.value).toBe('Пётр');
      expect(knowledgeEditorImages.bind).toHaveBeenLastCalledWith(
        expect.objectContaining({ itemId: secondPerson.id }),
      );
      peopleService.updatePerson.mockReturnValue(of(secondPerson));
      component.savePerson();
      expect(peopleService.updatePerson).toHaveBeenLastCalledWith(
        secondPerson.id,
        expect.objectContaining({ firstName: 'Пётр', description: PERSON.description }),
      );
    } finally {
      confirm.mockRestore();
    }
  });

  it('saves numeric years and clearing through the native number input', () => {
    const component = fixture.componentInstance;
    for (const year of [2024, 2020, null, 2024]) {
      const input = fixture.nativeElement.querySelector('#birthday-year') as HTMLInputElement;
      input.value = year === null ? '' : String(year);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      fixture.detectChanges();
      peopleService.updatePerson.mockReturnValue(
        of({ ...PERSON, birthday: { day: 29, month: 2, year } }),
      );
      component.savePerson();
      fixture.detectChanges();
      expect(peopleService.updatePerson).toHaveBeenLastCalledWith(
        PERSON.id,
        expect.objectContaining({ birthday: { day: 29, month: 2, year } }),
      );
      expect(component.personForm.controls.birthday.valid).toBe(true);
      expect(
        (fixture.nativeElement.querySelector('#birthday-year') as HTMLInputElement).value,
      ).toBe(year === null ? '' : String(year));
    }
  });

  afterEach(() => fixture.destroy());

  it('loads a yearless leap-day birthday and binds People image uploads', () => {
    expect(fixture.componentInstance.personForm.controls.birthday.getRawValue()).toEqual({
      day: '29',
      month: '2',
      year: null,
    });
    const editor = fixture.debugElement.query(By.directive(MarkdownEditorStubComponent))
      .componentInstance as MarkdownEditorStubComponent;
    expect(editor.imageCapability()).not.toBeNull();
  });

  it('keeps an uploaded editor image as an ordinary attachment after its Markdown is removed', () => {
    const editor = fixture.debugElement.query(By.directive(MarkdownEditorStubComponent))
      .componentInstance as MarkdownEditorStubComponent;
    const capability = editor.imageCapability();
    fixture.componentInstance.setDescription('Unsaved before upload');

    capability?.upload(new File(['image'], 'private.png', { type: 'image/png' })).subscribe();
    editor.valueChange.emit('');
    fixture.detectChanges();

    expect(fixture.componentInstance.person()?.attachments).toContainEqual(
      expect.objectContaining({ id: 'editor-image-1', processing: 'normalizedRasterImage' }),
    );
    expect(fixture.componentInstance.personForm.controls.description.value).toBe('');
    expect(peopleService.deleteAttachment).not.toHaveBeenCalled();
  });

  it('blocks Save until attachment-first image completion has inserted Markdown', () => {
    const saveResponse = new Subject<PersonDetail>();
    peopleService['updatePerson'].mockReturnValue(saveResponse);
    const editor = fixture.debugElement.query(By.directive(MarkdownEditorStubComponent))
      .componentInstance as MarkdownEditorStubComponent;
    const binding = knowledgeEditorImages.bind.mock.calls[0]![0] as {
      uploaded: (file: PersonDetail['attachments'][number]) => void;
    };
    const uploaded = {
      id: 'editor-image-race',
      itemId: 'person-1',
      kind: 'attachment' as const,
      processing: 'normalizedRasterImage' as const,
      mimeType: 'image/webp',
      sizeBytes: 7,
      name: 'race.png',
      originalName: 'race.png',
      contentPath: '/api/knowledge/files/editor-image-race/content',
      createdAt: PERSON.createdAt,
      updatedAt: PERSON.updatedAt,
    };
    const markdown = `![race.png](${uploaded.contentPath}#fileId=${uploaded.id})`;
    const attachmentCompletion = new Subject<void>();
    const markdownCompletion = new Subject<string>();
    attachmentCompletion.subscribe(() => binding.uploaded(uploaded));
    markdownCompletion.subscribe((value) => editor.valueChange.emit(value));

    editor.imageUploadPendingChange.emit(true);
    fixture.detectChanges();
    expect(
      (
        fixture.nativeElement.querySelector(
          '[data-testid="person-detail-save"]',
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fixture.componentInstance.savePerson();
    expect(peopleService.updatePerson).not.toHaveBeenCalled();

    attachmentCompletion.next();
    expect(fixture.componentInstance.editorImagePending()).toBe(true);
    markdownCompletion.next(markdown);
    expect(fixture.componentInstance.editorImagePending()).toBe(true);
    expect(peopleService.updatePerson).not.toHaveBeenCalled();

    editor.imageUploadPendingChange.emit(false);
    fixture.detectChanges();
    const capabilityBeforeSave = editor.imageCapability();
    fixture.componentInstance.savePerson();
    fixture.detectChanges();

    expect(peopleService.updatePerson).toHaveBeenCalledWith(
      'person-1',
      expect.objectContaining({ description: markdown }),
    );
    expect(editor.imageCapability()).toBe(capabilityBeforeSave);
    expect(editor.uploadInteractionsDisabled()).toBe(true);

    saveResponse.next({ ...PERSON, description: markdown, attachments: [uploaded] });
    fixture.detectChanges();
    expect(fixture.componentInstance.personForm.controls.description.value).toBe(markdown);
    expect(editor.uploadInteractionsDisabled()).toBe(false);
  });

  it('refreshes capability-backed preview state when a referenced attachment is deleted', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    peopleService.deleteAttachment.mockReturnValue(of(void 0));
    const editor = fixture.debugElement.query(By.directive(MarkdownEditorStubComponent))
      .componentInstance as MarkdownEditorStubComponent;
    editor
      .imageCapability()
      ?.upload(new File(['image'], 'delete-me.png', { type: 'image/png' }))
      .subscribe();
    fixture.detectChanges();
    const initialRevision = editor.imagePreviewRevision();
    const attachment = fixture.componentInstance.person()!.attachments[0]!;

    fixture.componentInstance.deleteAttachment(attachment);
    fixture.detectChanges();

    expect(fixture.componentInstance.person()?.attachments).not.toContainEqual(attachment);
    expect(editor.imagePreviewRevision()).toBe(initialRevision + 1);
  });

  it('renders read-only memorable-date backlinks with localized dates', () => {
    const link = fixture.nativeElement.querySelector(
      'a[href="/personal-workspace/knowledge/dates/date-1"]',
    ) as HTMLAnchorElement | null;

    expect(link?.textContent).toContain('Годовщина');
    expect(fixture.nativeElement.textContent).toContain('29');
  });

  it('collapses long relationship and memorable-date lists and can reveal every item', () => {
    const relationshipType = {
      id: 'relationship-type-1',
      isSymmetric: true,
      forwardName: 'Знакомый',
      reverseName: 'Знакомый',
      createdAt: PERSON.createdAt,
      updatedAt: PERSON.updatedAt,
    };
    peopleService['getPerson'].mockReturnValue(
      of({
        ...PERSON,
        relationships: Array.from({ length: 11 }, (_, index) => ({
          id: `relationship-${index + 1}`,
          relatedPersonId: `related-person-${index + 1}`,
          relatedPersonDisplayName: `Человек ${index + 1}`,
          relationshipType,
          direction: 'forward' as const,
          label: relationshipType.forwardName,
          note: '',
          createdAt: PERSON.createdAt,
          updatedAt: PERSON.updatedAt,
        })),
        relatedDates: Array.from({ length: 11 }, (_, index) => ({
          id: `date-${index + 1}`,
          displayName: `Дата ${index + 1}`,
          date: { day: index + 1, month: 1, year: null },
        })),
      }),
    );

    fixture.componentInstance.loadPerson();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll('[data-testid^="person-relationship-row-"]'),
    ).toHaveLength(10);
    expect(
      fixture.nativeElement.querySelectorAll('[data-testid^="person-related-date-"]'),
    ).toHaveLength(10);

    const relationshipToggle = fixture.nativeElement.querySelector(
      '[data-testid="person-relationships-toggle"]',
    ) as HTMLButtonElement;
    const relatedDatesToggle = fixture.nativeElement.querySelector(
      '[data-testid="person-related-dates-toggle"]',
    ) as HTMLButtonElement;
    relationshipToggle.click();
    relatedDatesToggle.click();
    fixture.detectChanges();

    expect(relationshipToggle.getAttribute('aria-expanded')).toBe('true');
    expect(relatedDatesToggle.getAttribute('aria-expanded')).toBe('true');
    expect(
      fixture.nativeElement.querySelectorAll('[data-testid^="person-relationship-row-"]'),
    ).toHaveLength(11);
    expect(
      fixture.nativeElement.querySelectorAll('[data-testid^="person-related-date-"]'),
    ).toHaveLength(11);
  });

  it('uses bytes for a sub-kilobyte attachment instead of rounding it to zero megabytes', () => {
    expect(fixture.componentInstance.fileSize(512)).toContain('Б');
    expect(fixture.componentInstance.fileSize(512)).not.toContain('МБ');
  });

  it('loads and saves Telegram from the sticky form action footer', () => {
    const component = fixture.componentInstance;
    const telegramInput = fixture.nativeElement.querySelector(
      '#person-telegram',
    ) as HTMLInputElement | null;
    const footer = fixture.nativeElement.querySelector(
      '[data-testid="person-detail-action-footer"]',
    ) as HTMLElement | null;
    const save = fixture.nativeElement.querySelector(
      '[data-testid="person-detail-save"]',
    ) as HTMLButtonElement | null;

    expect(component.personForm.controls.telegram.value).toBe('@ivanov');
    expect(telegramInput?.value).toBe('@ivanov');
    expect(footer).not.toBeNull();
    expect(save).not.toBeNull();
    expect(footer?.contains(save)).toBe(true);

    if (telegramInput !== null) {
      telegramInput.value = ' @new_ivanov ';
      telegramInput.dispatchEvent(new Event('input'));
    }
    save?.click();

    expect(peopleService.updatePerson).toHaveBeenCalledWith(
      'person-1',
      expect.objectContaining({ telegram: '@new_ivanov' }),
    );

    component.personForm.controls.telegram.setValue('x'.repeat(256));
    save?.click();
    expect(peopleService.updatePerson).toHaveBeenCalledTimes(1);
    expect(notifications.error).toHaveBeenCalled();
  });

  it('deletes through the detail actions dropdown without a top save action', () => {
    const navigate = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    const deleteAction = fixture.nativeElement.querySelector(
      '[data-testid="people-detail-actions-delete"]',
    ) as HTMLButtonElement | null;
    expect(deleteAction).not.toBeNull();
    expect(
      fixture.nativeElement.querySelectorAll('[data-testid="person-detail-save"]'),
    ).toHaveLength(1);
    deleteAction?.click();

    expect(peopleService.deletePerson).toHaveBeenCalledWith('person-1');
    expect(navigate).toHaveBeenCalledWith(['/personal-workspace/knowledge/people'], {
      queryParamsHandling: 'preserve',
    });
  });

  it('opens relationship creation as an isolated modal draft and cancels it', () => {
    fixture.componentInstance.addRelationship();
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector(
      '[data-testid="relationship-dialog"]',
    ) as HTMLDialogElement;
    expect(dialog?.open).toBe(true);
    expect(
      fixture.nativeElement.querySelectorAll('[data-testid^="person-relationship-row-"]'),
    ).toHaveLength(0);
    expect(peopleService.updatePerson).not.toHaveBeenCalled();
    (dialog.querySelector('[data-testid="relationship-cancel"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(dialog.open).toBe(false);
    expect(fixture.componentInstance.relationshipForms.length).toBe(0);
  });

  it('applies relationships to the card draft, preserves names across searches and saves a batch', () => {
    const component = fixture.componentInstance;
    peopleService.listPeople.mockReturnValueOnce(
      of({ people: [{ ...PERSON, id: 'person-2', displayName: 'Alice' }] }),
    );
    component.addRelationship();
    component.applyRelationship();
    expect(component.relationshipForms.length).toBe(0);
    expect(notifications.error).toHaveBeenCalled();
    component.relationshipDraft.patchValue({
      relatedPersonId: 'person-2',
      relationshipTypeId: 'type-1',
      note: 'Friend',
    });
    component.applyRelationship();
    fixture.detectChanges();
    expect(peopleService.updatePerson).not.toHaveBeenCalled();
    expect(
      fixture.nativeElement.querySelector('a[href="/personal-workspace/knowledge/people/person-2"]')
        ?.textContent,
    ).toContain('Alice');
    component.searchPeople('Nobody');
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('a[href="/personal-workspace/knowledge/people/person-2"]')
        ?.textContent,
    ).toContain('Alice');
    const row = component.relationshipForms.at(0);
    component.editRelationship(row);
    component.relationshipDraft.controls.note.setValue('Updated');
    expect(row.controls.note.value).toBe('Friend');
    component.applyRelationship();
    component.savePerson();
    expect(peopleService.updatePerson).toHaveBeenLastCalledWith(
      PERSON.id,
      expect.objectContaining({
        relationshipChanges: {
          create: [
            {
              relatedPersonId: 'person-2',
              relationshipTypeId: 'type-1',
              direction: 'forward',
              note: 'Updated',
            },
          ],
          update: [],
          deleteIds: [],
        },
      }),
    );
  });

  it('guards modal cancel and Escape without changing a persisted relationship or the main draft', () => {
    const component = fixture.componentInstance;
    component.personForm.controls.description.setValue('Main draft');
    component.addRelationship();
    component.relationshipDraft.patchValue({
      relatedPersonId: 'person-2',
      relationshipTypeId: 'type-1',
      note: 'Stored',
    });
    component.applyRelationship();
    const row = component.relationshipForms.at(0);
    row.controls.persistedId.setValue('relation-1');
    component.editRelationship(row);
    component.relationshipDraft.controls.note.setValue('Unsaved');
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    const dialog = fixture.nativeElement.querySelector(
      '[data-testid="relationship-dialog"]',
    ) as HTMLDialogElement;
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(dialog.open).toBe(true);
    expect(row.controls.note.value).toBe('Stored');
    confirm.mockReturnValue(true);
    component.closeRelationshipDialog();
    expect(dialog.open).toBe(false);
    expect(component.personForm.controls.description.value).toBe('Main draft');
    component.editRelationship(row);
    component.relationshipDraft.controls.note.setValue('Applied');
    component.applyRelationship();
    component.savePerson();
    expect(peopleService.updatePerson).toHaveBeenLastCalledWith(
      PERSON.id,
      expect.objectContaining({
        relationshipChanges: {
          create: [],
          update: [
            {
              id: 'relation-1',
              relatedPersonId: 'person-2',
              relationshipTypeId: 'type-1',
              direction: 'forward',
              note: 'Applied',
            },
          ],
          deleteIds: [],
        },
      }),
    );
  });

  it('removes persisted relationships in the next card batch', () => {
    const component = fixture.componentInstance;
    component.addRelationship();
    component.relationshipDraft.patchValue({
      persistedId: 'relation-1',
      relatedPersonId: 'person-2',
      relationshipTypeId: 'type-1',
    });
    component.applyRelationship();
    component.removeRelationship(0);
    expect(peopleService.updatePerson).not.toHaveBeenCalled();
    component.savePerson();
    expect(peopleService.updatePerson).toHaveBeenLastCalledWith(
      PERSON.id,
      expect.objectContaining({
        relationshipChanges: { create: [], update: [], deleteIds: ['relation-1'] },
      }),
    );
  });

  it('blocks an invalid future birthday and sends explicit relationship batches', () => {
    const component = fixture.componentInstance;
    component.personForm.controls.birthday.setValue({
      day: '1',
      month: '1',
      year: 9999,
    });
    component.savePerson();
    expect(peopleService.updatePerson).not.toHaveBeenCalled();
    expect(notifications.error).toHaveBeenCalled();

    component.personForm.controls.birthday.setValue({
      day: '29',
      month: '2',
      year: null,
    });
    component.addRelationship();
    const relationship = component.relationshipDraft;
    relationship.setValue({
      persistedId: '',
      relatedPersonId: 'person-2',
      relationshipTypeId: 'type-1',
      direction: 'forward',
      note: 'Работали вместе',
    });
    component.applyRelationship();
    component.savePerson();

    expect(peopleService.updatePerson).toHaveBeenCalledWith(
      'person-1',
      expect.objectContaining({
        birthday: { day: 29, month: 2, year: null },
        relationshipChanges: {
          create: [
            {
              relatedPersonId: 'person-2',
              relationshipTypeId: 'type-1',
              direction: 'forward',
              note: 'Работали вместе',
            },
          ],
          update: [],
          deleteIds: [],
        },
      }),
    );
  });

  it('preserves list query state when navigating back', () => {
    const navigate = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.componentInstance.back();
    expect(navigate).toHaveBeenCalledWith(['/personal-workspace/knowledge/people'], {
      queryParamsHandling: 'preserve',
    });
  });

  it('keeps the latest relationship candidates and ignores an older error', () => {
    const olderResponse = new Subject<{
      totalCount: number;
      totalPages: number;
      people: PersonDetail[];
    }>();
    const latestResponse = new Subject<{
      totalCount: number;
      totalPages: number;
      people: PersonDetail[];
    }>();
    peopleService['listPeople']
      .mockReset()
      .mockReturnValueOnce(olderResponse)
      .mockReturnValueOnce(latestResponse);

    fixture.componentInstance.searchPeople('older');
    fixture.componentInstance.searchPeople('latest');
    latestResponse.next({
      totalCount: 1,
      totalPages: 1,
      people: [{ ...PERSON, id: 'latest-person', displayName: 'Latest Person' }],
    });
    olderResponse.next({
      totalCount: 1,
      totalPages: 1,
      people: [{ ...PERSON, id: 'older-person', displayName: 'Older Person' }],
    });
    olderResponse.error(new Error('stale request'));

    expect(fixture.componentInstance.personCandidateOptions()).toContainEqual({
      value: 'latest-person',
      label: 'Latest Person',
    });
    expect(fixture.componentInstance.personCandidateOptions()).not.toContainEqual({
      value: 'older-person',
      label: 'Older Person',
    });
    expect(notifications.error).not.toHaveBeenCalled();
  });

  it('ignores a stale photo response and revokes the current URL on destroy', () => {
    const firstPhoto = new Subject<Blob>();
    const secondPhoto = new Subject<Blob>();
    peopleService['getPerson'].mockReturnValue(
      of({
        ...PERSON,
        photo: {
          id: 'photo-1',
          itemId: 'person-1',
          kind: 'personPhoto',
          processing: 'normalizedRasterImage',
          mimeType: 'image/webp',
          sizeBytes: 10,
          name: 'photo.webp',
          originalName: 'photo.webp',
          contentPath: '/api/knowledge/files/photo-1/content',
          createdAt: PERSON.createdAt,
          updatedAt: PERSON.updatedAt,
        },
      }),
    );
    peopleService['getFileContent']
      .mockReturnValueOnce(firstPhoto)
      .mockReturnValueOnce(secondPhoto);
    const createObjectURL = jest.fn().mockReturnValue('blob:current-photo');
    const revokeObjectURL = jest.fn();
    Object.defineProperty(window.URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    });

    fixture.componentInstance.loadPerson();
    fixture.componentInstance.loadPerson();
    firstPhoto.next(new Blob(['stale']));
    expect(createObjectURL).not.toHaveBeenCalled();

    secondPhoto.next(new Blob(['current']));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    fixture.destroy();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:current-photo');
  });

  it('saves the birthday notification switch', () => {
    const component = fixture.componentInstance;
    component.personForm.controls.notificationsEnabled.setValue(false);
    component.savePerson();
    expect(peopleService.updatePerson).toHaveBeenCalledWith(
      'person-1',
      expect.objectContaining({ notificationsEnabled: false }),
    );
  });
});

@Component({
  selector: 'app-markdown-editor',
  standalone: true,
  template: '',
})
class MarkdownEditorStubComponent {
  readonly value = input.required<string>();
  readonly language = input.required<'ru' | 'en'>();
  readonly accessibleLabel = input.required<string>();
  readonly imageCapability = input.required<MarkdownEditorImageCapability | null>();
  readonly uploadInteractionsDisabled = input.required<boolean>();
  readonly imagePreviewRevision = input.required<number>();
  readonly valueChange = output<string>();
  readonly imageUploadPendingChange = output<boolean>();
}
