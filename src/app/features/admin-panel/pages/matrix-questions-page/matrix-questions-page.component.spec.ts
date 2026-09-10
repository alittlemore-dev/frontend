import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import {
  chooseSiteSelectOption,
  siteSelectOptionLabels,
  siteSelectTrigger,
} from '../../../../testing/site-select-testing';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { MatrixQuestionFormComponent } from '../../components/matrix-question-form/matrix-question-form.component';
import {
  AdminMatrixQuestionDetailDto,
  AdminMatrixQuestionWorkspace,
  AdminMatrixResource,
  AdminMatrixStructure,
  AdminMatrixWorkspaceFilterOptions,
  AdminReadonlyMatrixQuestionList,
  AdminReadonlyMatrixSheet,
} from '../../models/matrix-question-workspace.model';
import { MatrixQuestionWorkspaceService } from '../../services/matrix-question-workspace.service';
import { MatrixQuestionsPageComponent } from './matrix-questions-page.component';

const QUESTION_ID = '00000000000000000000000000000007';
const READY_QUESTION_ID = '00000000000000000000000000000008';
const SAVED_QUESTION_ID = '00000000000000000000000000000009';
const SHEET_ID = '00000000000000000000000000000001';
const SECTION_ID = '00000000000000000000000000000002';
const SUBSECTION_ID = '00000000000000000000000000000003';
const RESOURCE_ID = '00000000000000000000000000000004';

const workspace: AdminMatrixQuestionWorkspace = {
  totalCount: 2,
  totalPages: 1,
  summary: {
    total: 2,
    draft: 1,
    missingDraft: 1,
    dangerousPublished: 0,
    readyPublished: 1,
  },
  items: [
    {
      id: QUESTION_ID,
      slug: 'typing',
      question: 'What is typing?',
      sheetKey: 'python',
      sheet: 'Python',
      grade: 'Junior',
      interviewFrequency: 'often',
      section: 'Core',
      subsection: 'Syntax',
      publishStatus: 'Draft',
      publishedAt: null,
      missingFields: ['answerEn'],
    },
    {
      id: READY_QUESTION_ID,
      slug: 'ready-question',
      question: 'Ready question?',
      sheetKey: 'python',
      sheet: 'Python',
      grade: 'Middle',
      interviewFrequency: 'rarely',
      section: 'Core',
      subsection: 'Syntax',
      publishStatus: 'Published',
      publishedAt: '2026-01-02T00:00:00+00:00',
      missingFields: [],
    },
  ],
};

const options: AdminMatrixWorkspaceFilterOptions = {
  sheets: [
    {
      key: 'python',
      label: 'Python',
      sections: [
        {
          id: SECTION_ID,
          label: 'Core',
          subsections: [{ id: SUBSECTION_ID, label: 'Syntax' }],
        },
      ],
    },
    {
      key: 'sql',
      label: 'SQL',
      sections: [
        {
          id: 'section-sql',
          label: 'Queries',
          subsections: [{ id: 'subsection-select', label: 'Select' }],
        },
      ],
    },
  ],
  grades: ['Junior', 'Middle'],
  interviewFrequencies: ['often', 'rarely'],
  sections: ['Core', 'Queries'],
  subsections: ['Syntax', 'Select'],
  publishStatuses: ['Draft', 'Published'],
};

const savedQuestion: AdminMatrixQuestionDetailDto = {
  id: SAVED_QUESTION_ID,
  slug: 'new-question',
  question: 'New question?',
  answer: '',
  interviewAnswerExplanation: '',
  subsectionId: SUBSECTION_ID,
  sheetKey: 'python',
  sheet: '',
  grade: null,
  interviewFrequency: null,
  section: '',
  subsection: '',
  publishStatus: 'Draft',
  suggestedByUsername: 'owner',
  translations: {
    ru: {
      question: 'Новый вопрос?',
      answer: '',
      interviewAnswerExplanation: '',
    },
    en: {
      question: 'New question?',
      answer: '',
      interviewAnswerExplanation: '',
    },
  },
  resources: [],
};

const resource: AdminMatrixResource = {
  id: RESOURCE_ID,
  name: 'Python docs',
  url: 'https://docs.python.org',
  translations: {
    ru: { name: 'Документация Python' },
    en: { name: 'Python docs' },
  },
};

const previewSheetsByLanguage: Record<'ru' | 'en', AdminReadonlyMatrixSheet[]> = {
  ru: [
    { key: 'python', name: 'Питон' },
    { key: 'sql', name: 'SQL' },
  ],
  en: [
    { key: 'python', name: 'Python' },
    { key: 'sql', name: 'SQL' },
  ],
};
const matrixStructure: AdminMatrixStructure = {
  sheets: [
    {
      id: SHEET_ID,
      key: 'python',
      name: 'Питон',
      priority: 1,
      translations: { ru: { name: 'Питон' }, en: { name: 'Python' } },
      sections: [
        {
          id: SECTION_ID,
          name: 'Основы',
          priority: 1,
          translations: { ru: { name: 'Основы' }, en: { name: 'Core' } },
          subsections: [
            {
              id: SUBSECTION_ID,
              name: 'Стиль',
              priority: 1,
              translations: { ru: { name: 'Стиль' }, en: { name: 'Style' } },
            },
          ],
        },
      ],
    },
  ],
};
describe('MatrixQuestionsPageComponent', () => {
  let fixture: ComponentFixture<MatrixQuestionsPageComponent>;
  let service: jest.Mocked<MatrixQuestionWorkspaceService>;
  let router: Router;
  let notifications: { success: jest.Mock; error: jest.Mock };

  beforeEach(async () => {
    service = {
      listWorkspaceItems: jest.fn().mockReturnValue(of(workspace)),
      getFilterOptions: jest.fn().mockReturnValue(of(options)),
      listPreviewSheets: jest
        .fn()
        .mockImplementation((language: 'ru' | 'en') => of(previewSheetsByLanguage[language])),
      listPreviewQuestions: jest
        .fn()
        .mockImplementation((sheetKey: string, language: 'ru' | 'en') =>
          of(previewQuestionList(sheetKey, language)),
        ),
      deleteQuestion: jest.fn().mockReturnValue(of(void 0)),
      publishQuestion: jest.fn().mockReturnValue(of(void 0)),
      unpublishQuestion: jest.fn().mockReturnValue(of(void 0)),
      getStructure: jest.fn().mockReturnValue(of(matrixStructure)),
      createSheet: jest.fn(),
      createSection: jest.fn(),
      createSubsection: jest.fn(),
      getQuestion: jest.fn(),
      createQuestion: jest.fn().mockReturnValue(of(savedQuestion)),
      updateQuestion: jest.fn().mockReturnValue(of(savedQuestion)),
      searchResources: jest.fn().mockReturnValue(of([resource])),
    } as unknown as jest.Mocked<MatrixQuestionWorkspaceService>;
    notifications = { success: jest.fn(), error: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [MatrixQuestionsPageComponent],
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        { provide: MatrixQuestionWorkspaceService, useValue: service },
        { provide: NotificationService, useValue: notifications },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MatrixQuestionsPageComponent);
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
  });

  it('loads workspace counters and compact rows', () => {
    expect(service.getFilterOptions).toHaveBeenCalledWith('ru');
    expect(service.listWorkspaceItems).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Всего');
    expect(fixture.nativeElement.textContent).toContain('Опубликованы с блокерами');
    expect(fixture.nativeElement.textContent).toContain('What is typing?');
    expect(fixture.nativeElement.textContent).toContain('Часто');
    expect(fixture.nativeElement.textContent).toContain('Ответ EN');
  });

  it('links every question text to its admin edit page', () => {
    const links = Array.from(fixture.nativeElement.querySelectorAll('a')).map(
      (link) => (link as HTMLAnchorElement).getAttribute('href') ?? '',
    );

    expect(links).toContain(`/admin-panel/matrix-questions/${QUESTION_ID}`);
    expect(links).toContain(`/admin-panel/matrix-questions/${READY_QUESTION_ID}`);
    expect(links).not.toContain('/ru/competency-matrix/questions/ready-question');
  });

  it('applies and resets filters', () => {
    const search = fixture.nativeElement.querySelector(
      '[data-testid="matrix-workspace-search"]',
    ) as HTMLInputElement;
    search.value = 'typing';
    search.dispatchEvent(new Event('input'));
    chooseSiteSelectOption(fixture, '#matrix-workspace-interview-frequency', 'rarely');
    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-workspace-apply"]')
      ?.click();

    expect(lastWorkspaceFilters().searchQuery).toBe('typing');
    expect(lastWorkspaceFilters().interviewFrequencies).toEqual(['rarely']);

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-workspace-reset"]')
      ?.click();

    expect(lastWorkspaceFilters().searchQuery).toBeUndefined();
    expect(lastWorkspaceFilters().interviewFrequencies).toBeUndefined();
    expect(lastWorkspaceFilters().page).toBe(1);
  });

  it('applies compact themed date picker values as ISO matrix filters', () => {
    const publishedFrom = fixture.nativeElement.querySelector(
      '#matrix-workspace-from',
    ) as HTMLInputElement;
    const publishedTo = fixture.nativeElement.querySelector(
      '#matrix-workspace-to',
    ) as HTMLInputElement;

    expect(publishedFrom.type).toBe('text');
    expect(publishedFrom.classList).toContain('form-control-sm');
    expect(
      fixture.nativeElement.querySelectorAll('[data-testid="date-picker-toggle"]').length,
    ).toBe(2);
    publishedFrom.value = '15/03/2026';
    publishedFrom.dispatchEvent(new Event('input'));
    publishedTo.value = '20/03/2026';
    publishedTo.dispatchEvent(new Event('input'));
    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-workspace-apply"]')
      ?.click();

    expect(lastWorkspaceFilters().publishedFrom).toBe('2026-03-15');
    expect(lastWorkspaceFilters().publishedTo).toBe('2026-03-20');
  });

  it('does not apply matrix filters while a date picker contains invalid manual input', () => {
    const publishedFrom = fixture.nativeElement.querySelector(
      '#matrix-workspace-from',
    ) as HTMLInputElement;
    publishedFrom.value = '31.02.2026';
    publishedFrom.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    service.listWorkspaceItems.mockClear();

    fixture.componentInstance.applyFilters();
    fixture.detectChanges();

    expect(service.listWorkspaceItems).not.toHaveBeenCalled();
    expect(publishedFrom.getAttribute('aria-invalid')).toBe('true');
  });

  it('loads protected preview only after opening the preview tab and shows its language', () => {
    expect(service.listPreviewSheets).not.toHaveBeenCalled();

    openPreview();

    expect(service.listPreviewSheets).toHaveBeenCalledWith('ru');
    expect(service.listPreviewQuestions).toHaveBeenCalledWith('python', 'ru');
    expect(fixture.nativeElement.textContent).toContain('Язык предпросмотра');
    expect(fixture.nativeElement.textContent).toContain('Что такое typing?');
    expect(previewLanguageButton('ru').classList).toContain('active');
    expect(previewLanguageButton('ru').getAttribute('aria-pressed')).toBe('true');
    expect(fixture.nativeElement.querySelector('app-matrix-readonly-grouped-grid')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-matrix-readonly-grouped-list')).toBeNull();
  });

  it('reloads all preview data and labels in the selected preview language', () => {
    const i18n = TestBed.inject(I18nService);
    const ensureLanguageBundle = jest.spyOn(i18n, 'ensureLanguageBundle');
    openPreview();

    previewLanguageButton('en').click();
    fixture.detectChanges();

    expect(ensureLanguageBundle).toHaveBeenCalledWith('en');
    expect(service.listPreviewSheets).toHaveBeenLastCalledWith('en');
    expect(service.listPreviewQuestions).toHaveBeenLastCalledWith('python', 'en');
    expect(previewLanguageButton('en').classList).toContain('active');
    expect(fixture.nativeElement.textContent).toContain('Python');
    expect(fixture.nativeElement.textContent).toContain('Core');
    expect(fixture.nativeElement.textContent).toContain('Syntax');
    expect(fixture.nativeElement.textContent).toContain('What is typing?');
    expect(fixture.nativeElement.textContent).toContain('Section');
    expect(fixture.nativeElement.textContent).toContain('Subsection');
    expect(fixture.nativeElement.textContent).not.toContain('Что такое typing?');
  });

  it('preserves the selected sheet key while changing the preview language', () => {
    openPreview();
    previewSheetButton('SQL').click();
    fixture.detectChanges();

    expect(service.listPreviewQuestions).toHaveBeenLastCalledWith('sql', 'ru');
    expect(fixture.nativeElement.textContent).toContain('Что такое JOIN?');

    previewLanguageButton('en').click();
    fixture.detectChanges();

    expect(service.listPreviewQuestions).toHaveBeenLastCalledWith('sql', 'en');
    expect(fixture.componentInstance.selectedPreviewSheetKey()).toBe('sql');
    expect(fixture.nativeElement.textContent).toContain('What is JOIN?');
  });

  it('keeps the previous preview language and content when bundle loading fails', () => {
    const i18n = TestBed.inject(I18nService);
    jest
      .spyOn(i18n, 'ensureLanguageBundle')
      .mockReturnValue(throwError(() => new Error('bundle unavailable')));
    openPreview();

    previewLanguageButton('en').click();
    fixture.detectChanges();

    expect(previewLanguageButton('ru').classList).toContain('active');
    expect(fixture.nativeElement.textContent).toContain('Что такое typing?');
    expect(fixture.nativeElement.textContent).toContain('Не удалось загрузить язык предпросмотра.');
    expect(service.listPreviewSheets).not.toHaveBeenCalledWith('en');
  });

  it('keeps the previous preview language and content when localized data loading fails', () => {
    service.listPreviewQuestions.mockImplementation((sheetKey: string, language: 'ru' | 'en') =>
      language === 'en'
        ? throwError(() => new Error('preview unavailable'))
        : of(previewQuestionList(sheetKey, language)),
    );
    openPreview();

    previewLanguageButton('en').click();
    fixture.detectChanges();

    expect(service.listPreviewSheets).toHaveBeenLastCalledWith('en');
    expect(service.listPreviewQuestions).toHaveBeenLastCalledWith('python', 'en');
    expect(previewLanguageButton('ru').classList).toContain('active');
    expect(fixture.nativeElement.textContent).toContain('Питон');
    expect(fixture.nativeElement.textContent).toContain('Что такое typing?');
    expect(fixture.nativeElement.textContent).not.toContain('What is typing?');
    expect(fixture.nativeElement.textContent).toContain('Не удалось загрузить язык предпросмотра.');
  });

  it('opens the selected preview question in the admin editor', () => {
    openPreview();

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-desktop-table"] button')
      ?.click();

    expect(router.navigate).toHaveBeenCalledWith(['/admin-panel/matrix-questions', QUESTION_ID], {
      queryParamsHandling: 'preserve',
    });
  });

  it('disables and resets dependent section filters from selected sheet and section', () => {
    const section = siteSelectTrigger(fixture, '#matrix-workspace-section');
    const subsection = siteSelectTrigger(fixture, '#matrix-workspace-subsection');

    expect(section.disabled).toBe(true);
    expect(subsection.disabled).toBe(true);

    chooseSiteSelectOption(fixture, '#matrix-workspace-sheet', 'python');

    expect(section.disabled).toBe(false);
    expect(siteSelectOptionLabels(fixture, '#matrix-workspace-section')).toContain('Core');
    expect(siteSelectOptionLabels(fixture, '#matrix-workspace-section')).not.toContain('Queries');

    chooseSiteSelectOption(fixture, '#matrix-workspace-section', SECTION_ID);
    expect(subsection.disabled).toBe(false);
    expect(siteSelectOptionLabels(fixture, '#matrix-workspace-subsection')).toContain('Syntax');

    chooseSiteSelectOption(fixture, '#matrix-workspace-sheet', 'sql');

    expect(section.value).toBe('');
    expect(subsection.value).toBe('');
    expect(siteSelectOptionLabels(fixture, '#matrix-workspace-section')).toContain('Queries');
    expect(siteSelectOptionLabels(fixture, '#matrix-workspace-section')).not.toContain('Core');
  });

  it('marks required fields and clears red border after a required value is entered', () => {
    fixture.componentInstance.openCreate();
    fixture.detectChanges();

    const slug = fixture.nativeElement.querySelector('#matrix-form-slug') as HTMLInputElement;

    expect(fixture.nativeElement.textContent).toContain('Slug *');
    saveButton().click();
    fixture.detectChanges();
    expect(slug.classList).toContain('is-invalid');

    slug.value = 'draft-question';
    slug.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(slug.classList).not.toContain('is-invalid');
  });

  it('scrolls the create form when the wheel is used over modal chrome', () => {
    fixture.componentInstance.openCreate();
    fixture.detectChanges();
    const modal = fixture.nativeElement.querySelector<HTMLElement>('.modal')!;
    const modalBody = modal.querySelector<HTMLElement>('.modal-body')!;
    makeElementScrollable(modalBody, 1200, 400);
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 120 });

    modal.querySelector<HTMLElement>('.modal-header')!.dispatchEvent(event);

    expect(modalBody.scrollTop).toBe(120);
    expect(event.defaultPrevented).toBe(true);
  });

  it('keeps a changed create modal open when discarding is cancelled', () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    fixture.componentInstance.openCreate();
    fixture.detectChanges();
    setInput('#matrix-form-question-ru', 'Черновик');

    fixture.componentInstance.closeForm();
    fixture.detectChanges();

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.formMode()).toBe('create');
    expect(
      (fixture.nativeElement.querySelector('#matrix-form-question-ru') as HTMLInputElement).value,
    ).toBe('Черновик');
  });

  it('saves an incomplete draft with only the minimum required fields', () => {
    fixture.componentInstance.openCreate();
    fixture.detectChanges();
    showBothLocalizedFields();
    setInput('#matrix-form-slug', 'draft-question');
    selectQuestionSubsection(SUBSECTION_ID);
    setInput('#matrix-form-question-ru', 'Неполный вопрос?');
    setInput('#matrix-form-question-en', 'Incomplete question?');

    saveButton().click();

    const payload = service.createQuestion.mock.calls[0][0];
    expect(payload.subsectionId).toBe(SUBSECTION_ID);
    expect('sheetKey' in payload).toBe(false);
    expect(payload.grade).toBeNull();
    expect(payload.interviewFrequency).toBeNull();
    expect(payload.publishStatus).toBe('Draft');
    expect(payload.translations.ru.answer).toBe('');
    expect(payload.resources).toEqual([]);
  });

  it('saves the selected interview frequency from the admin form', () => {
    fixture.componentInstance.openCreate();
    fixture.detectChanges();
    showBothLocalizedFields();
    setInput('#matrix-form-slug', 'frequent-question');
    selectQuestionSubsection(SUBSECTION_ID);
    setInput('#matrix-form-question-ru', 'Частый вопрос?');
    setInput('#matrix-form-question-en', 'Frequent question?');
    chooseSiteSelectOption(fixture, '#matrix-form-interview-frequency', 'often');

    saveButton().click();

    expect(service.createQuestion.mock.calls[0][0].interviewFrequency).toBe('often');
  });

  it('warns and skips the publish API for incomplete workspace rows', () => {
    openRowActions(QUESTION_ID);
    fixture.nativeElement
      .querySelector<HTMLButtonElement>(`[data-testid="matrix-actions-${QUESTION_ID}-publish"]`)
      ?.click();

    expect(service.publishQuestion).not.toHaveBeenCalled();
    expect(notifications.error.mock.calls[0][0]).toContain('Ответ EN');
  });

  it('routes the row edit action to the matrix question detail page', () => {
    service.getQuestion.mockReturnValue(of(savedQuestion));

    openRowActions(QUESTION_ID);
    fixture.nativeElement
      .querySelector<HTMLButtonElement>(`[data-testid="matrix-actions-${QUESTION_ID}-edit"]`)
      ?.click();
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(['/admin-panel/matrix-questions', QUESTION_ID], {
      queryParamsHandling: 'preserve',
    });
    expect(service.getQuestion).not.toHaveBeenCalled();
  });

  it('adds, searches, edits context, and removes resources in the admin form', () => {
    fixture.componentInstance.openCreate();
    fixture.detectChanges();
    showBothLocalizedFields();

    setInput('[data-testid="matrix-resource-search"]', 'python');
    fixture.detectChanges();

    expect(service.searchResources).toHaveBeenCalledWith('python', 10, 'ru');
    fixture.nativeElement
      .querySelector<HTMLButtonElement>(`[data-testid="matrix-resource-attach-${RESOURCE_ID}"]`)
      ?.click();
    fixture.detectChanges();
    setTextarea('#matrixResourceContextRu0', 'Читать');
    setTextarea('#matrixResourceContextEn0', 'Read');

    setInput('[data-testid="matrix-resource-new-name-ru"]', 'Новый ресурс');
    setInput('[data-testid="matrix-resource-new-name-en"]', 'New resource');
    setInput('[data-testid="matrix-resource-new-url"]', 'https://example.com');
    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-resource-add-new"]')
      ?.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Новый ресурс');

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-resource-detach-1"]')
      ?.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Новый ресурс');

    setInput('#matrix-form-slug', 'draft-question');
    selectQuestionSubsection(SUBSECTION_ID);
    setInput('#matrix-form-question-ru', 'Вопрос?');
    setInput('#matrix-form-question-en', 'Question?');
    saveButton().click();

    expect(service.createQuestion.mock.calls[0][0].resources).toEqual([
      {
        resourceId: RESOURCE_ID,
        translations: { ru: { context: 'Читать' }, en: { context: 'Read' } },
      },
    ]);
  });

  it('renders structure picker instead of manual taxonomy text fields', () => {
    fixture.componentInstance.openCreate();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-matrix-structure-picker')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#matrix-form-sheet-key')).toBeNull();
    expect(fixture.nativeElement.querySelector('#matrix-form-sheet-ru')).toBeNull();
    expect(fixture.nativeElement.querySelector('#matrix-form-section-ru')).toBeNull();
    expect(fixture.nativeElement.querySelector('#matrix-form-subsection-ru')).toBeNull();
  });

  it('generates slug only from the explicit button action', () => {
    fixture.componentInstance.openCreate();
    fixture.detectChanges();
    showBothLocalizedFields();
    const slug = fixture.nativeElement.querySelector('#matrix-form-slug') as HTMLInputElement;
    const generateButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (button): button is HTMLButtonElement =>
        (button as HTMLButtonElement).textContent?.includes('Сгенерировать') ?? false,
    );

    expect(generateButton?.disabled).toBe(true);
    setInput('#matrix-form-question-en', 'What is dependency injection?');
    fixture.detectChanges();

    expect(slug.value).toBe('');
    expect(generateButton?.disabled).toBe(false);
    generateButton?.click();
    fixture.detectChanges();

    expect(slug.value).toBe('what-is-dependency-injection');
  });

  it('confirms deletes before calling the admin delete endpoint', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    openRowActions(QUESTION_ID);
    fixture.nativeElement
      .querySelector<HTMLButtonElement>(`[data-testid="matrix-actions-${QUESTION_ID}-delete"]`)
      ?.click();

    expect(window.confirm).toHaveBeenCalled();
    expect(service.deleteQuestion).toHaveBeenCalledWith(QUESTION_ID);
  });

  function lastWorkspaceFilters(): Parameters<
    MatrixQuestionWorkspaceService['listWorkspaceItems']
  >[0] {
    const filters = service.listWorkspaceItems.mock.calls.at(-1)?.[0];
    if (filters === undefined) {
      throw new Error('No workspace request');
    }
    return filters;
  }

  function openRowActions(id: string): void {
    fixture.nativeElement
      .querySelector<HTMLButtonElement>(`[data-testid="matrix-actions-${id}-toggle"]`)
      ?.click();
    fixture.detectChanges();
  }

  function openPreview(): void {
    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-workspace-preview-tab"]')
      ?.click();
    fixture.detectChanges();
  }

  function previewLanguageButton(language: 'ru' | 'en'): HTMLButtonElement {
    const button = fixture.nativeElement.querySelector<HTMLButtonElement>(
      `[data-testid="matrix-workspace-preview-language-${language}"]`,
    );
    if (button === null) {
      throw new Error(`No ${language} preview language button`);
    }
    return button;
  }

  function previewSheetButton(label: string): HTMLButtonElement {
    const button = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLButtonElement>(
        'app-matrix-readonly-sheet-tabs button',
      ),
    ).find((candidate) => candidate.textContent?.trim() === label);
    if (button === undefined) {
      throw new Error(`No ${label} preview sheet button`);
    }
    return button;
  }

  function selectQuestionSubsection(subsectionId: string): void {
    const form = fixture.debugElement.query(By.directive(MatrixQuestionFormComponent))
      .componentInstance as MatrixQuestionFormComponent;
    form.selectQuestionSubsection(subsectionId);
    fixture.detectChanges();
  }

  function showBothLocalizedFields(): void {
    const button = fixture.nativeElement.querySelector<HTMLButtonElement>(
      '[data-testid="matrix-form-display-mode-ru-en"]',
    );
    if (button === null) {
      throw new Error('No RU+EN display mode button');
    }
    button.click();
    fixture.detectChanges();
  }

  function setInput(selector: string, value: string): void {
    const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function setTextarea(selector: string, value: string): void {
    const textarea = fixture.nativeElement.querySelector(selector) as HTMLTextAreaElement;
    textarea.value = value;
    textarea.dispatchEvent(new Event('input'));
  }

  function saveButton(): HTMLButtonElement {
    const button = fixture.nativeElement.querySelector(
      '[data-testid="matrix-form-save"]',
    ) as HTMLButtonElement | null;
    if (button === null) {
      throw new Error('No matrix form save button');
    }
    return button;
  }
});

function previewQuestionList(
  sheetKey: string,
  language: 'ru' | 'en',
): AdminReadonlyMatrixQuestionList {
  const python = sheetKey === 'python';
  const slug = python ? 'typing' : 'sql-join';
  return {
    sheetKey,
    sheet: python ? (language === 'ru' ? 'Питон' : 'Python') : 'SQL',
    sections: [
      {
        section: python
          ? language === 'ru'
            ? 'Основы'
            : 'Core'
          : language === 'ru'
            ? 'Запросы'
            : 'Queries',
        subsections: [
          {
            subsection: python
              ? language === 'ru'
                ? 'Синтаксис'
                : 'Syntax'
              : language === 'ru'
                ? 'Соединения'
                : 'Joins',
            grades: [
              {
                grade: 'Junior',
                questions: [
                  {
                    slug,
                    question: python
                      ? language === 'ru'
                        ? 'Что такое typing?'
                        : 'What is typing?'
                      : language === 'ru'
                        ? 'Что такое JOIN?'
                        : 'What is JOIN?',
                    interviewFrequency: 'often',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    questionIdsBySlug: {
      [slug]: python ? QUESTION_ID : READY_QUESTION_ID,
    },
  };
}

function makeElementScrollable(
  element: HTMLElement,
  scrollHeight: number,
  clientHeight: number,
): void {
  Object.defineProperty(element, 'scrollHeight', { configurable: true, value: scrollHeight });
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: clientHeight });
  element.scrollTop = 0;
}
