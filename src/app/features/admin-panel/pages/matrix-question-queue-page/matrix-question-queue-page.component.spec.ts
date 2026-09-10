import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  ActivatedRoute,
  Router,
  convertToParamMap,
  provideRouter,
  type ParamMap,
} from '@angular/router';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { ApiError } from '../../../../core/models/api-error.model';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { chooseSiteSelectOption } from '../../../../testing/site-select-testing';
import {
  AdminMatrixQuestionPayload,
  AdminMatrixStructure,
} from '../../models/matrix-question-workspace.model';
import {
  QueuedMatrixImportPreview,
  QueuedMatrixQuestion,
} from '../../models/matrix-question-queue.model';
import { MatrixQuestionWorkspaceService } from '../../services/matrix-question-workspace.service';
import { MatrixQuestionQueueService } from '../../services/matrix-question-queue.service';
import { MatrixQuestionQueuePageComponent } from './matrix-question-queue-page.component';

const QUESTION_ID = '00000000000000000000000000000007';
const CREATED_QUESTION_ID = '00000000000000000000000000000017';
const IMPORTED_QUESTION_ID = '00000000000000000000000000000008';
const MISSING_SHEET_QUESTION_ID = '00000000000000000000000000000009';
const UNASSIGNED_QUESTION_ID = '00000000000000000000000000000010';
const PYTHON_MIDDLE_QUESTION_ID = '00000000000000000000000000000011';
const SHEET_ID = '00000000000000000000000000000001';
const SECTION_ID = '00000000000000000000000000000002';
const SUBSECTION_ID = '00000000000000000000000000000003';

const queuedQuestion: QueuedMatrixQuestion = {
  id: QUESTION_ID,
  question: 'What is PEP 8?',
  grade: 'Junior',
  sheet: 'python',
  section: 'Core',
  subsection: 'Style',
  suggestedByUsername: 'anon',
  createdAt: '2026-06-07T12:00:00+00:00',
  claim: null,
};

const claimedQuestion: QueuedMatrixQuestion = {
  ...queuedQuestion,
  claim: {
    id: 'claim-1',
    agentClientId: 'agent-1',
    agentClientName: 'desktop-codex',
    claimedAt: '2026-07-14T12:00:00+00:00',
    expiresAt: '2026-07-14T14:00:00+00:00',
  },
};

const claimedMiddleQuestion: QueuedMatrixQuestion = {
  ...claimedQuestion,
  id: IMPORTED_QUESTION_ID,
  question: 'Claimed middle question',
};

const importedQuestion: QueuedMatrixQuestion = {
  ...queuedQuestion,
  id: IMPORTED_QUESTION_ID,
  question: 'What is Black?',
};

const queuedQuestionWithMissingSheet: QueuedMatrixQuestion = {
  ...queuedQuestion,
  id: MISSING_SHEET_QUESTION_ID,
  question: 'What is SQL?',
  sheet: 'sql',
};

const unassignedQuestion: QueuedMatrixQuestion = {
  ...queuedQuestion,
  id: UNASSIGNED_QUESTION_ID,
  question: 'What is an index?',
  grade: null,
  sheet: null,
  section: null,
  subsection: null,
  suggestedByUsername: 'alice',
};

const pythonMiddleQuestion: QueuedMatrixQuestion = {
  ...queuedQuestion,
  id: PYTHON_MIDDLE_QUESTION_ID,
  question: 'What is Black?',
  grade: 'Middle',
  section: 'Tooling',
  subsection: 'Formatters',
  suggestedByUsername: 'alice',
};

const importPreview: QueuedMatrixImportPreview = {
  rows: [
    {
      rowNumber: 1,
      question: 'What is PEP 8?',
      sheet: 'python',
      grade: 'Junior',
      canImport: true,
      selectedByDefault: true,
      issues: [],
    },
    {
      rowNumber: 2,
      question: 'What is PEP 8?',
      sheet: 'python',
      grade: 'Junior',
      canImport: true,
      selectedByDefault: false,
      issues: [
        {
          code: 'duplicateInFile',
          severity: 'warning',
          relatedRowNumbers: [1],
        },
      ],
    },
    {
      rowNumber: 3,
      question: '',
      sheet: 'python',
      grade: 'Lead',
      canImport: false,
      selectedByDefault: false,
      issues: [
        {
          code: 'questionBlank',
          severity: 'error',
          relatedRowNumbers: [],
        },
      ],
    },
  ],
};

const matrixStructure: AdminMatrixStructure = {
  sheets: [
    {
      id: SHEET_ID,
      key: 'python',
      name: 'Python',
      priority: 1,
      translations: { ru: { name: 'Питон' }, en: { name: 'Python' } },
      sections: [
        {
          id: SECTION_ID,
          name: 'Core',
          priority: 1,
          translations: { ru: { name: 'Основы' }, en: { name: 'Core' } },
          subsections: [
            {
              id: SUBSECTION_ID,
              name: 'Style',
              priority: 1,
              translations: { ru: { name: 'Стиль' }, en: { name: 'Style' } },
            },
          ],
        },
      ],
    },
  ],
};

const INVALID_SHORT_TEXT = 'x'.repeat(256);

describe('MatrixQuestionQueuePageComponent', () => {
  let fixture: ComponentFixture<MatrixQuestionQueuePageComponent>;
  let component: MatrixQuestionQueuePageComponent;
  let queueService: {
    listQueuedQuestions: jest.Mock;
    createQueuedQuestion: jest.Mock;
    previewQueuedQuestions: jest.Mock;
    importQueuedQuestions: jest.Mock;
    rejectQueuedQuestion: jest.Mock;
    createQuestionFromQueue: jest.Mock;
    releaseAgentClaim: jest.Mock;
  };
  let workspaceService: jest.Mocked<MatrixQuestionWorkspaceService>;
  let notificationService: { success: jest.Mock; error: jest.Mock };
  let router: Router;
  let routeQueryParamMap: BehaviorSubject<ParamMap>;

  beforeEach(async () => {
    queueService = {
      listQueuedQuestions: jest
        .fn()
        .mockReturnValue(of([queuedQuestion, queuedQuestionWithMissingSheet])),
      createQueuedQuestion: jest.fn().mockReturnValue(of(queuedQuestion)),
      previewQueuedQuestions: jest.fn().mockReturnValue(of(importPreview)),
      importQueuedQuestions: jest.fn().mockReturnValue(of([queuedQuestion, importedQuestion])),
      rejectQueuedQuestion: jest.fn().mockReturnValue(of(undefined)),
      createQuestionFromQueue: jest
        .fn()
        .mockReturnValue(of({ id: CREATED_QUESTION_ID, slug: 'pep-8' })),
      releaseAgentClaim: jest.fn().mockReturnValue(of(undefined)),
    };
    workspaceService = {
      getStructure: jest.fn().mockReturnValue(of(matrixStructure)),
      createSheet: jest.fn(),
      createSection: jest.fn(),
      createSubsection: jest.fn(),
      searchResources: jest.fn().mockReturnValue(of([])),
    } as unknown as jest.Mocked<MatrixQuestionWorkspaceService>;
    notificationService = {
      success: jest.fn(),
      error: jest.fn(),
    };
    routeQueryParamMap = new BehaviorSubject(convertToParamMap({}));
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    await TestBed.configureTestingModule({
      imports: [MatrixQuestionQueuePageComponent],
      providers: [
        { provide: MatrixQuestionQueueService, useValue: queueService },
        { provide: MatrixQuestionWorkspaceService, useValue: workspaceService },
        { provide: NotificationService, useValue: notificationService },
        provideI18nTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: routeQueryParamMap.asObservable() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MatrixQuestionQueuePageComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
  });

  it('renders queued questions from service', () => {
    expect(queueService.listQueuedQuestions).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('What is PEP 8?');
    expect(fixture.nativeElement.textContent).toContain('Кто предложил: Анонимный');
  });

  it('renders queued timestamps in the selected language and preserves the ISO value', () => {
    const timestamp = fixture.nativeElement.querySelector<HTMLTimeElement>(
      '[data-testid="matrix-queue-created-at"]',
    );

    expect(timestamp?.dateTime).toBe(queuedQuestion.createdAt);
    expect(timestamp?.textContent?.trim()).toBe(
      formatExpectedDateTime(queuedQuestion.createdAt, 'ru-RU'),
    );
    expect(fixture.nativeElement.textContent).not.toContain(queuedQuestion.createdAt);

    TestBed.inject(I18nService).switchLanguage('en').subscribe();
    fixture.detectChanges();

    expect(timestamp?.textContent?.trim()).toBe(
      formatExpectedDateTime(queuedQuestion.createdAt, 'en-US'),
    );
  });

  it('renders a real suggester username without localization', () => {
    queueService.listQueuedQuestions.mockReturnValue(
      of([{ ...queuedQuestion, suggestedByUsername: 'alice' }]),
    );

    component.loadQueue();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Кто предложил: alice');
  });

  it('groups the created time, suggester, and structure as compact metadata', () => {
    const metadata = fixture.nativeElement.querySelector<HTMLElement>(
      `[data-testid="matrix-queue-metadata-${QUESTION_ID}"]`,
    );

    expect(metadata?.textContent).toContain('Создан:');
    expect(metadata?.textContent).toContain('Кто предложил: Анонимный');
    expect(metadata?.textContent).toContain('Структура: Junior / python / Core / Style');
  });

  it('exposes queue rejection as a contextual minus action', () => {
    const reject = fixture.nativeElement.querySelector<HTMLButtonElement>(
      `[data-testid="matrix-queue-reject-${QUESTION_ID}"]`,
    );

    expect(reject?.textContent?.trim()).toBe('−');
    expect(reject?.getAttribute('aria-label')).toBe('Отклонить вопрос «What is PEP 8?»');
    expect(reject?.getAttribute('title')).toBe('Отклонить вопрос «What is PEP 8?»');
  });

  it('filters the queue with AND semantics without reloading or changing FIFO order', () => {
    loadQueueWithQuestions([
      queuedQuestion,
      claimedMiddleQuestion,
      queuedQuestionWithMissingSheet,
      unassignedQuestion,
      pythonMiddleQuestion,
    ]);
    const loadCalls = queueService.listQueuedQuestions.mock.calls.length;

    expectStatistic('matrix-queue-stat-total', '5');
    expectStatistic('matrix-queue-stat-shown', '5');
    expectStatistic('matrix-queue-stat-available', '4');
    expectStatistic('matrix-queue-stat-claimed', '1');

    setSelectValue('[data-testid="matrix-queue-filter-sheet"]', 'python');
    expect(visibleQuestionIds()).toEqual([
      QUESTION_ID,
      IMPORTED_QUESTION_ID,
      PYTHON_MIDDLE_QUESTION_ID,
    ]);
    expectStatistic('matrix-queue-stat-shown', '3');
    expectStatistic('matrix-queue-stat-available', '2');
    expectStatistic('matrix-queue-stat-claimed', '1');

    setSelectValue('[data-testid="matrix-queue-filter-availability"]', 'available');
    setSelectValue('[data-testid="matrix-queue-filter-grade"]', 'Middle');
    setInputValue('[data-testid="matrix-queue-filter-search"]', 'BLACK');

    expect(visibleQuestionIds()).toEqual([PYTHON_MIDDLE_QUESTION_ID]);
    expectStatistic('matrix-queue-stat-total', '5');
    expectStatistic('matrix-queue-stat-shown', '1');
    expectStatistic('matrix-queue-stat-available', '1');
    expectStatistic('matrix-queue-stat-claimed', '0');
    expect(queueService.listQueuedQuestions).toHaveBeenCalledTimes(loadCalls);
  });

  it('searches visible metadata case-insensitively and filters unset facets', () => {
    loadQueueWithQuestions([queuedQuestion, unassignedQuestion]);

    setInputValue('[data-testid="matrix-queue-filter-search"]', 'ALICE');
    expect(visibleQuestionIds()).toEqual([UNASSIGNED_QUESTION_ID]);

    setInputValue('[data-testid="matrix-queue-filter-search"]', '');
    setSelectValue('[data-testid="matrix-queue-filter-sheet"]', 'notSet');
    setSelectValue('[data-testid="matrix-queue-filter-grade"]', 'notSet');

    expect(visibleQuestionIds()).toEqual([UNASSIGNED_QUESTION_ID]);
  });

  it('shows a filtered empty state and resets all filters', () => {
    setInputValue('[data-testid="matrix-queue-filter-search"]', 'no matching question');

    expect(visibleQuestionIds()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('По выбранным фильтрам вопросов нет.');

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-queue-filter-reset-empty"]')!
      .click();
    fixture.detectChanges();

    expect(visibleQuestionIds()).toEqual([QUESTION_ID, MISSING_SHEET_QUESTION_ID]);
  });

  it('restores filters from URL and writes normalized changes back', fakeAsync(() => {
    loadQueueWithQuestions([queuedQuestion, queuedQuestionWithMissingSheet, unassignedQuestion]);

    routeQueryParamMap.next(
      convertToParamMap({ sheet: 'sql', availability: 'available', q: 'what' }),
    );
    fixture.detectChanges();

    expect(inputValue('[data-testid="matrix-queue-filter-search"]')).toBe('what');
    expect(select('[data-testid="matrix-queue-filter-sheet"]').value).toBe('sql');
    expect(select('[data-testid="matrix-queue-filter-availability"]').value).toBe('available');
    expect(visibleQuestionIds()).toEqual([MISSING_SHEET_QUESTION_ID]);

    jest.mocked(router.navigate).mockClear();
    setSelectValue('[data-testid="matrix-queue-filter-grade"]', 'Junior');
    tick(200);

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: {
          q: 'what',
          sheet: 'sql',
          grade: 'Junior',
          availability: 'available',
        },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      }),
    );
  }));

  it('ignores and removes invalid finite URL filters', () => {
    jest.mocked(router.navigate).mockClear();

    routeQueryParamMap.next(convertToParamMap({ grade: 'Lead', availability: 'busy' }));
    fixture.detectChanges();

    expect(select('[data-testid="matrix-queue-filter-grade"]').value).toBe('');
    expect(select('[data-testid="matrix-queue-filter-availability"]').value).toBe('');
    expect(router.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { q: null, sheet: null, grade: null, availability: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      }),
    );
  });

  it('canonicalizes duplicated scalar queue filters', () => {
    jest.mocked(router.navigate).mockClear();

    routeQueryParamMap.next(convertToParamMap({ q: ['one', 'two'], sheet: ['python', 'sql'] }));
    fixture.detectChanges();

    expect(inputValue('[data-testid="matrix-queue-filter-search"]')).toBe('');
    expect(select('[data-testid="matrix-queue-filter-sheet"]').value).toBe('');
    expect(router.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { q: null, sheet: null, grade: null, availability: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      }),
    );
  });

  it('shows an active agent claim and blocks create and reject actions', () => {
    queueService.listQueuedQuestions.mockReturnValue(of([claimedQuestion]));
    component.loadQueue();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('desktop-codex');
    expect(fixture.nativeElement.textContent).toContain('Вопрос занят AI-агентом');
    expect(
      fixture.nativeElement.querySelector<HTMLButtonElement>(
        `[data-testid="matrix-queue-question-${QUESTION_ID}"]`,
      )?.disabled,
    ).toBe(true);
    expect(
      fixture.nativeElement.querySelector<HTMLButtonElement>(
        `[data-testid="matrix-queue-reject-${QUESTION_ID}"]`,
      )?.disabled,
    ).toBe(true);
  });

  it('lets a content manager explicitly release an agent claim', () => {
    queueService.listQueuedQuestions.mockReturnValue(of([claimedQuestion]));
    component.loadQueue();
    fixture.detectChanges();

    fixture.nativeElement
      .querySelector<HTMLButtonElement>(`[data-testid="matrix-queue-release-${QUESTION_ID}"]`)!
      .click();
    fixture.detectChanges();

    expect(queueService.releaseAgentClaim).toHaveBeenCalledWith(QUESTION_ID);
    expect(component.questions()[0].claim).toBeNull();
    expect(notificationService.success).toHaveBeenCalledWith('Блокировка агента снята.');
  });

  it('reloads the queue and explains a claim race returned as 409', () => {
    queueService.rejectQueuedQuestion.mockReturnValueOnce(
      throwError(
        () =>
          ({
            code: 'conflict',
            type: 'ConflictHTTPException',
            message: 'claimed',
            status: 409,
            location: null,
            attr: null,
          }) satisfies ApiError,
      ),
    );

    component.rejectQuestion(queuedQuestion);

    expect(queueService.listQueuedQuestions).toHaveBeenCalledTimes(2);
    expect(notificationService.error).toHaveBeenCalledWith(
      'Вопрос уже занят AI-агентом. Очередь обновлена.',
    );
  });

  it('renders manual add button next to refresh button', () => {
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLButtonElement>(
        'h2 + div button, .d-flex > button',
      ),
    ).map((button) => button.textContent?.trim());

    expect(buttons).toContain('Добавить в очередь');
    expect(buttons).toContain('Обновить');
  });

  it('opens manual queue add modal with a one-line question input', () => {
    openAddModal();

    const input = fixture.nativeElement.querySelector<HTMLInputElement>(
      '#matrix-queue-manual-question',
    );

    expect(input).toBeTruthy();
    expect(input?.tagName).toBe('INPUT');
    expect(input?.type).toBe('text');
    expect(fixture.nativeElement.querySelector('textarea#matrix-queue-manual-question')).toBeNull();
  });

  it('switches queue add modal between manual input and import upload', () => {
    openAddModal();

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-queue-import-mode"]')!
      .click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#matrix-queue-manual-question')).toBeNull();
    expect(
      fixture.nativeElement.querySelector<HTMLInputElement>(
        '[data-testid="matrix-queue-import-file-input"]',
      ),
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector<HTMLElement>(
        '[data-testid="matrix-queue-import-drop-zone"]',
      ),
    ).toBeTruthy();

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-queue-manual-mode"]')!
      .click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#matrix-queue-manual-question')).toBeTruthy();
  });

  it('keeps manual queue submit available and shows feedback for blank input', () => {
    openAddModal();

    const submitButton = fixture.nativeElement.querySelector<HTMLButtonElement>(
      '[data-testid="matrix-queue-manual-submit"]',
    );

    expect(submitButton?.disabled).toBe(false);
    submitButton?.click();
    fixture.detectChanges();

    expect(queueService.createQueuedQuestion).not.toHaveBeenCalled();
    expectInvalidControl('#matrix-queue-manual-question', 'Заполните поле.');
  });

  it('normalizes multiline manual question text before adding it to the queue', () => {
    openAddModal();
    const input = fixture.nativeElement.querySelector<HTMLInputElement>(
      '#matrix-queue-manual-question',
    )!;
    const pasteEvent = new Event('paste') as ClipboardEvent;
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: {
        getData: (format: string) =>
          format === 'text' ? 'What is PEP 8?\nHow should it be used?' : '',
      },
    });
    input.dispatchEvent(pasteEvent);
    fixture.detectChanges();

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-queue-manual-submit"]')!
      .click();

    expect(queueService.createQueuedQuestion).toHaveBeenCalledWith(
      'What is PEP 8? How should it be used?',
    );
  });

  it('blocks too-long manual queue questions', () => {
    openAddModal();
    component.setManualAddQuestion(INVALID_SHORT_TEXT);
    fixture.detectChanges();

    component.createQueuedQuestion();
    fixture.detectChanges();

    expect(queueService.createQueuedQuestion).not.toHaveBeenCalled();
    expectInvalidControl('#matrix-queue-manual-question', 'Максимум 255 символов.');
  });

  it('closes manual queue modal and reloads queue after successful add', () => {
    openAddModal();
    const input = fixture.nativeElement.querySelector<HTMLInputElement>(
      '#matrix-queue-manual-question',
    )!;
    input.value = 'What is PEP 8?';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-queue-manual-submit"]')!
      .click();
    fixture.detectChanges();

    expect(notificationService.success).toHaveBeenCalledWith('Вопрос добавлен в очередь.');
    expect(queueService.listQueuedQuestions).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector('#matrix-queue-manual-question')).toBeNull();
  });

  it('keeps manual queue modal open and notifies when add fails', () => {
    const error: ApiError = {
      code: 'bad_request',
      type: 'bad_request',
      message: 'Failed',
      status: 400,
      location: null,
      attr: null,
    };
    queueService.createQueuedQuestion.mockReturnValue(throwError(() => error));
    openAddModal();
    const input = fixture.nativeElement.querySelector<HTMLInputElement>(
      '#matrix-queue-manual-question',
    )!;
    input.value = 'What is PEP 8?';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-queue-manual-submit"]')!
      .click();
    fixture.detectChanges();

    expect(notificationService.error).toHaveBeenCalledWith('Не удалось добавить вопрос в очередь.');
    expect(fixture.nativeElement.querySelector('#matrix-queue-manual-question')).toBeTruthy();
  });

  it('keeps a changed manual draft when closing is cancelled', () => {
    openAddModal();
    component.setManualAddQuestion('Unsaved question');
    fixture.detectChanges();
    jest.mocked(window.confirm).mockReturnValue(false);

    component.closeManualAdd();
    fixture.detectChanges();

    expect(window.confirm).toHaveBeenCalledWith(
      'Есть несохранённые изменения. Если продолжить, они будут потеряны. Продолжить?',
    );
    expect(component.manualAddVisible()).toBe(true);
    expect(component.manualAddQuestion()).toBe('Unsaved question');
  });

  it('closes a clean manual form without confirmation', () => {
    openAddModal();
    jest.mocked(window.confirm).mockClear();

    component.closeManualAdd();

    expect(window.confirm).not.toHaveBeenCalled();
    expect(component.manualAddVisible()).toBe(false);
  });

  it('protects a manual draft while import mode is visible', () => {
    openAddModal();
    component.setManualAddQuestion('Unsaved manual question');
    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-queue-import-mode"]')!
      .click();
    fixture.detectChanges();
    jest.mocked(window.confirm).mockReturnValue(false);

    component.closeManualAdd();

    expect(window.confirm).toHaveBeenCalled();
    expect(component.manualAddVisible()).toBe(true);
    expect(component.manualAddQuestion()).toBe('Unsaved manual question');
  });

  it('keeps import submit available and shows feedback until a file is selected', () => {
    openImportMode();

    const submitButton = fixture.nativeElement.querySelector<HTMLButtonElement>(
      '[data-testid="matrix-queue-import-submit"]',
    );

    expect(submitButton?.disabled).toBe(false);
    submitButton?.click();
    fixture.detectChanges();

    expect(queueService.importQueuedQuestions).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Выберите один файл.');
  });

  it('explains text and table import formats in import mode', () => {
    openImportMode();

    const text = fixture.nativeElement.textContent;

    expect(text).toContain('TXT: один вопрос на строку.');
    expect(text).toContain('CSV, XLSX и XLSM: колонки question, sheet, grade');
  });

  it('selects one import file from file input', () => {
    openImportMode();
    chooseImportFile(new File(['question'], 'questions.txt', { type: 'text/plain' }));

    expect(fixture.nativeElement.textContent).toContain('Выбран файл: questions.txt');
  });

  it('selects one import file from drop zone', () => {
    openImportMode();
    dropImportFiles([new File(['question'], 'questions.csv', { type: 'text/csv' })]);

    expect(fixture.nativeElement.textContent).toContain('Выбран файл: questions.csv');
  });

  it('shows feedback and keeps import submit retryable when more than one file is dropped', () => {
    openImportMode();
    dropImportFiles([
      new File(['first'], 'first.txt', { type: 'text/plain' }),
      new File(['second'], 'second.txt', { type: 'text/plain' }),
    ]);

    const submitButton = fixture.nativeElement.querySelector<HTMLButtonElement>(
      '[data-testid="matrix-queue-import-submit"]',
    );

    expect(fixture.nativeElement.textContent).toContain('Выберите один файл.');
    expect(submitButton?.disabled).toBe(false);
  });

  it('previews import rows with recommended selection and validation states', () => {
    openImportMode();
    const file = new File(['question'], 'questions.txt', { type: 'text/plain' });
    chooseImportFile(file);

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-queue-import-submit"]')!
      .click();
    fixture.detectChanges();

    expect(queueService.previewQueuedQuestions).toHaveBeenCalledWith(file);
    expect(
      fixture.nativeElement.querySelector<HTMLInputElement>(
        '[data-testid="matrix-queue-import-row-1"]',
      )?.checked,
    ).toBe(true);
    expect(
      fixture.nativeElement.querySelector<HTMLInputElement>(
        '[data-testid="matrix-queue-import-row-2"]',
      )?.checked,
    ).toBe(false);
    expect(
      fixture.nativeElement.querySelector<HTMLInputElement>(
        '[data-testid="matrix-queue-import-row-3"]',
      )?.disabled,
    ).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Повтор строки 1 в выбранном файле.');
    expect(fixture.nativeElement.textContent).toContain('Вопрос не должен быть пустым.');
  });

  it('keeps the preview table within the modal and wraps long question text', () => {
    const longQuestion = 'unbroken-question-text-'.repeat(20);
    queueService.previewQueuedQuestions.mockReturnValue(
      of({
        rows: [
          {
            ...importPreview.rows[0],
            question: longQuestion,
          },
        ],
      }),
    );

    openImportPreview();

    const table = fixture.nativeElement.querySelector<HTMLElement>(
      '[data-testid="matrix-queue-import-preview-table"]',
    )!;
    const questionCell = fixture.nativeElement.querySelector<HTMLElement>(
      '[data-testid="matrix-queue-import-question-1"]',
    )!;

    expect(questionCell.textContent).toContain(longQuestion);
    expect(table.closest('.table-responsive')).toBeNull();
    expect(table.querySelectorAll('col')).toHaveLength(6);
  });

  it('allows selecting a duplicate before confirming import', () => {
    openImportPreview();

    fixture.nativeElement
      .querySelector<HTMLInputElement>('[data-testid="matrix-queue-import-row-2"]')!
      .click();
    fixture.detectChanges();

    expect(component.selectedImportRowNumbers()).toEqual(new Set([1, 2]));
  });

  it('closes import modal, reloads queue, and shows imported count after confirmation', () => {
    const file = openImportPreview();

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-queue-import-confirm"]')!
      .click();
    fixture.detectChanges();

    expect(queueService.importQueuedQuestions).toHaveBeenCalledWith(file, [1]);
    expect(notificationService.success).toHaveBeenCalledWith('Импортировано вопросов: 2.');
    expect(queueService.listQueuedQuestions).toHaveBeenCalledTimes(2);
    expect(
      fixture.nativeElement.querySelector('[data-testid="matrix-queue-import-file-input"]'),
    ).toBeNull();
  });

  it('keeps preview and selection available when confirmation fails', () => {
    const error: ApiError = {
      code: 'bad_request',
      type: 'bad_request',
      message: 'Failed',
      status: 400,
      location: 'body',
      attr: 'selectedRowNumbers',
    };
    queueService.importQueuedQuestions.mockReturnValue(throwError(() => error));
    openImportPreview();

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-queue-import-confirm"]')!
      .click();
    fixture.detectChanges();

    expect(notificationService.error).toHaveBeenCalledWith('Не удалось импортировать вопросы.');
    expect(component.importPreview()).toEqual(importPreview);
    expect(component.selectedImportRowNumbers()).toEqual(new Set([1]));
    expect(
      fixture.nativeElement.querySelector<HTMLInputElement>(
        '[data-testid="matrix-queue-import-row-1"]',
      )?.checked,
    ).toBe(true);
  });

  it('resets preview and selection when another file is chosen', () => {
    openImportPreview();

    chooseImportFile(new File(['another'], 'another.txt', { type: 'text/plain' }));

    expect(component.importPreview()).toBeNull();
    expect(component.selectedImportRowNumbers()).toEqual(new Set());
    expect(fixture.nativeElement.textContent).toContain('Выбран файл: another.txt');
    expect(
      fixture.nativeElement.querySelector('[data-testid="matrix-queue-import-drop-zone"]'),
    ).toBeTruthy();
  });

  it('preserves an import draft when replacing its file is cancelled', () => {
    const originalFile = openImportPreview();
    jest.mocked(window.confirm).mockReturnValue(false);

    chooseImportFile(new File(['another'], 'another.txt', { type: 'text/plain' }));

    expect(window.confirm).toHaveBeenCalled();
    expect(component.selectedImportFile()).toBe(originalFile);
    expect(component.importPreview()).toEqual(importPreview);
    expect(component.selectedImportRowNumbers()).toEqual(new Set([1]));
  });

  it('preserves an import draft when switching to manual mode is cancelled', () => {
    const file = openImportPreview();
    jest.mocked(window.confirm).mockReturnValue(false);

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-queue-manual-mode"]')!
      .click();
    fixture.detectChanges();

    expect(window.confirm).toHaveBeenCalled();
    expect(component.addMode()).toBe('import');
    expect(component.selectedImportFile()).toBe(file);
    expect(component.importPreview()).toEqual(importPreview);
  });

  it('keeps import modal open and renders backend nested errors when import fails', () => {
    const error: ApiError = {
      code: 'bad_request',
      type: 'bad_request',
      message: 'Question queue import file is invalid.',
      status: 400,
      location: null,
      attr: null,
      nested_errors: [
        {
          code: 'bad_request',
          type: 'bad_request',
          message: 'Row 2: question must not be empty.',
          status: 400,
          location: 'body',
          attr: 'file.row.2',
        },
      ],
    };
    queueService.previewQueuedQuestions.mockReturnValue(throwError(() => error));
    openImportMode();
    chooseImportFile(new File(['question'], 'questions.txt', { type: 'text/plain' }));

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-queue-import-submit"]')!
      .click();
    fixture.detectChanges();

    expect(notificationService.error).toHaveBeenCalledWith('Не удалось импортировать вопросы.');
    expect(
      fixture.nativeElement.querySelector('[data-testid="matrix-queue-import-file-input"]'),
    ).toBeTruthy();
    expect(fixture.nativeElement.textContent).not.toContain(
      'Question queue import file is invalid.',
    );
    expect(fixture.nativeElement.textContent).toContain(
      'file / row 2: Row 2: question must not be empty.',
    );
  });

  it('opens a shared create modal from a full-width queued question card', () => {
    expect(fixture.nativeElement.querySelector('.col-xl-5')).toBeNull();
    expect(fixture.nativeElement.querySelector('.col-xl-7')).toBeNull();

    openCreateModalFromQueue();

    expect(fixture.nativeElement.querySelector('.modal-xl')).toBeTruthy();
    expect(inputValue('#matrix-form-slug')).toBe(`queued-question-${QUESTION_ID}`);
    expect(inputValue('#matrix-form-question-ru')).toBe('What is PEP 8?');
    expect(fixture.nativeElement.querySelector('#matrix-form-question-en')).toBeNull();
    expect(
      fixture.nativeElement
        .querySelector('[data-testid="matrix-form-display-mode-ru"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('true');

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-form-display-mode-ru-en"]')
      ?.click();
    fixture.detectChanges();

    expect(inputValue('#matrix-form-question-en')).toBe('What is PEP 8?');
    expect(select('[data-testid="matrix-structure-sheet"]').value).toBe(SHEET_ID);
  });

  it('scrolls the queued question form when the wheel is used over modal chrome', () => {
    openCreateModalFromQueue();
    const modal = fixture.nativeElement.querySelector<HTMLElement>('.modal')!;
    const modalBody = modal.querySelector<HTMLElement>('.modal-body')!;
    makeElementScrollable(modalBody, 1200, 400);
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 120 });

    modal.querySelector<HTMLElement>('.modal-header')!.dispatchEvent(event);

    expect(modalBody.scrollTop).toBe(120);
    expect(event.defaultPrevented).toBe(true);
  });

  it('renders queue-only actions through the shared form footer', () => {
    openCreateModalFromQueue();

    const createAndEdit = fixture.nativeElement.querySelector<HTMLButtonElement>(
      '[data-testid="matrix-queue-create-and-edit"]',
    );
    const createAndNext = fixture.nativeElement.querySelector<HTMLButtonElement>(
      '[data-testid="matrix-form-save"]',
    );
    const footerButtonLabels = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLButtonElement>(
        '[data-testid="matrix-form-action-footer"] button',
      ),
    ).map((button) => button.textContent?.trim());

    expect(buttonText('[data-testid="matrix-queue-reject-and-next"]')).toBe('Отклонить и далее');
    expect(buttonText('[data-testid="matrix-queue-skip"]')).toBe('Пропустить');
    expect(buttonText('[data-testid="matrix-queue-create-and-edit"]')).toBe('Создать и перейти');
    expect(buttonText('[data-testid="matrix-form-save"]')).toBe('Создать и к следующему');
    expect(createAndEdit?.parentElement).toBe(createAndNext?.parentElement);
    expect(footerButtonLabels).not.toContain('Отмена');
  });

  it('highlights a missing queued sheet key in the shared create modal', () => {
    openCreateModalFromQueue(MISSING_SHEET_QUESTION_ID);

    expect(fixture.nativeElement.querySelector('.modal-xl')).toBeTruthy();
    expect(select('[data-testid="matrix-structure-sheet"]').value).toBe('');
    expect(fixture.nativeElement.textContent).toContain(
      'Лист с ключом sql не найден. Создайте лист и заполните названия RU/EN.',
    );
    expect(inputValue('[data-testid="matrix-structure-sheet-key"]')).toBe('sql');
    expect(inputValue('[data-testid="matrix-structure-sheet-ru"]')).toBe('');
    expect(inputValue('[data-testid="matrix-structure-sheet-en"]')).toBe('');
  });

  it('marks selected queue question while its create modal is open', () => {
    openCreateModalFromQueue();

    const selectedButton = fixture.nativeElement.querySelector<HTMLButtonElement>(
      `[data-testid="matrix-queue-question-${QUESTION_ID}"]`,
    );

    expect(selectedButton).toBeTruthy();
    expect(selectedButton?.classList).toContain('list-group-item-success');
    expect(selectedButton?.classList).not.toContain('active');
    expect(selectedButton?.classList).not.toContain('list-group-item-primary');
  });

  it('confirms and removes a rejected question from the loaded queue', () => {
    component.rejectQuestion(queuedQuestion);

    expect(window.confirm).toHaveBeenCalledWith('Отклонить этот вопрос из очереди?');
    expect(queueService.rejectQueuedQuestion).toHaveBeenCalledWith(QUESTION_ID);
    expect(notificationService.success).toHaveBeenCalledWith('Вопрос отклонён.');
    expect(component.questions().map((question) => question.id)).toEqual([
      MISSING_SHEET_QUESTION_ID,
    ]);
  });

  it('keeps a queued question when rejection confirmation is cancelled', () => {
    jest.mocked(window.confirm).mockReturnValue(false);

    component.rejectQuestion(queuedQuestion);

    expect(queueService.rejectQueuedQuestion).not.toHaveBeenCalled();
    expect(component.questions()).toEqual([queuedQuestion, queuedQuestionWithMissingSheet]);
  });

  it('creates matrix question from selected queue entry', () => {
    openCreateModalFromQueue();

    component.createQuestion(minimumQuestionPayload());

    expect(queueService.createQuestionFromQueue).toHaveBeenCalledWith(
      QUESTION_ID,
      expect.objectContaining({
        slug: 'pep-8',
        subsectionId: SUBSECTION_ID,
        grade: null,
        interviewFrequency: null,
        publishStatus: 'Draft',
        resources: [],
      }),
      'ru',
    );
    expect(component.questions().map((question) => question.id)).toEqual([
      MISSING_SHEET_QUESTION_ID,
    ]);
    expect(component.selectedQuestion()?.id).toBe(MISSING_SHEET_QUESTION_ID);
  });

  it('creates a queued question and opens its admin editor', () => {
    openCreateModalFromQueue();
    fillValidCreateForm();
    jest.mocked(window.confirm).mockClear();

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-queue-create-and-edit"]')!
      .click();
    fixture.detectChanges();

    expect(queueService.createQuestionFromQueue).toHaveBeenCalledWith(
      QUESTION_ID,
      expect.objectContaining({ subsectionId: SUBSECTION_ID }),
      'ru',
    );
    expect(component.questions().map((question) => question.id)).toEqual([
      MISSING_SHEET_QUESTION_ID,
    ]);
    expect(component.selectedQuestion()).toBeNull();
    expect(component.unsavedChangesScope.hasChanges()).toBe(false);
    expect(window.confirm).not.toHaveBeenCalled();
    expect(notificationService.success).toHaveBeenCalledWith('Вопрос создан.');
    expect(router.navigate).toHaveBeenCalledWith(
      ['/admin-panel/matrix-questions', CREATED_QUESTION_ID],
      {
        queryParams: { returnTo: 'queue' },
        queryParamsHandling: 'merge',
      },
    );
  });

  it('does not retain create-and-edit intent after invalid submission', () => {
    openCreateModalFromQueue();

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-queue-create-and-edit"]')!
      .click();
    fixture.detectChanges();

    expect(queueService.createQuestionFromQueue).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();

    fillValidCreateForm();
    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-form-save"]')!
      .click();
    fixture.detectChanges();

    expect(queueService.createQuestionFromQueue).toHaveBeenCalledTimes(1);
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.selectedQuestion()?.id).toBe(MISSING_SHEET_QUESTION_ID);
  });

  it('keeps create modal open and does not navigate when create-and-edit fails', () => {
    const error: ApiError = {
      code: 'bad_request',
      type: 'bad_request',
      message: 'Failed',
      status: 400,
      location: 'body',
      attr: 'payload.slug',
    };
    queueService.createQuestionFromQueue.mockReturnValue(throwError(() => error));
    openCreateModalFromQueue();
    fillValidCreateForm();

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-queue-create-and-edit"]')!
      .click();
    fixture.detectChanges();

    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.selectedQuestion()?.id).toBe(QUESTION_ID);
    expect(component.questions()).toEqual([queuedQuestion, queuedQuestionWithMissingSheet]);
    expect(fixture.nativeElement.textContent).toContain('payload / slug: Failed');
  });

  it('closes the create modal after creating the last visible queue entry', () => {
    openCreateModalFromQueue(MISSING_SHEET_QUESTION_ID);

    component.createQuestion(minimumQuestionPayload());

    expect(component.selectedQuestion()).toBeNull();
    expect(component.questions().map((question) => question.id)).toEqual([QUESTION_ID]);
  });

  it('rejects the selected entry and opens the next FIFO question', () => {
    openCreateModalFromQueue();

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-queue-reject-and-next"]')!
      .click();
    fixture.detectChanges();

    expect(queueService.rejectQueuedQuestion).toHaveBeenCalledWith(QUESTION_ID);
    expect(component.questions().map((question) => question.id)).toEqual([
      MISSING_SHEET_QUESTION_ID,
    ]);
    expect(component.selectedQuestion()?.id).toBe(MISSING_SHEET_QUESTION_ID);
  });

  it('skips to the next FIFO question without changing the queue', () => {
    openCreateModalFromQueue();

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-queue-skip"]')!
      .click();
    fixture.detectChanges();

    expect(queueService.createQuestionFromQueue).not.toHaveBeenCalled();
    expect(queueService.rejectQueuedQuestion).not.toHaveBeenCalled();
    expect(component.questions()).toEqual([queuedQuestion, queuedQuestionWithMissingSheet]);
    expect(component.selectedQuestion()?.id).toBe(MISSING_SHEET_QUESTION_ID);
    expect(inputValue('#matrix-form-question-ru')).toBe('What is SQL?');
    expect(select('[data-testid="matrix-structure-sheet"]').value).toBe('');
  });

  it('advances only to the next available question matching the active filters', () => {
    loadQueueWithQuestions([queuedQuestion, queuedQuestionWithMissingSheet, pythonMiddleQuestion]);
    setSelectValue('[data-testid="matrix-queue-filter-sheet"]', 'python');
    openCreateModalFromQueue();

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-queue-skip"]')!
      .click();
    fixture.detectChanges();

    expect(component.selectedQuestion()?.id).toBe(PYTHON_MIDDLE_QUESTION_ID);
    expect(inputValue('#matrix-form-question-ru')).toBe('What is Black?');
  });

  it('keeps nonmatching questions hidden after creating the last filtered question', () => {
    loadQueueWithQuestions([queuedQuestion, queuedQuestionWithMissingSheet]);
    setSelectValue('[data-testid="matrix-queue-filter-sheet"]', 'python');
    openCreateModalFromQueue();

    component.createQuestion(minimumQuestionPayload());
    fixture.detectChanges();

    expect(component.selectedQuestion()).toBeNull();
    expect(component.questions().map((question) => question.id)).toEqual([
      MISSING_SHEET_QUESTION_ID,
    ]);
    expect(visibleQuestionIds()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('По выбранным фильтрам вопросов нет.');
  });

  it('skips over claimed rows when advancing without changing the queue', () => {
    loadQueueWithClaimedMiddle();
    openCreateModalFromQueue();

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-queue-skip"]')!
      .click();
    fixture.detectChanges();

    expect(component.questions()).toEqual([
      queuedQuestion,
      claimedMiddleQuestion,
      queuedQuestionWithMissingSheet,
    ]);
    expect(component.selectedQuestion()?.id).toBe(MISSING_SHEET_QUESTION_ID);
  });

  it('skips over claimed rows after creating a question', () => {
    loadQueueWithClaimedMiddle();
    openCreateModalFromQueue();

    component.createQuestion(minimumQuestionPayload());

    expect(component.selectedQuestion()?.id).toBe(MISSING_SHEET_QUESTION_ID);
    expect(component.questions()).toEqual([claimedMiddleQuestion, queuedQuestionWithMissingSheet]);
  });

  it('skips over claimed rows after rejecting a question', () => {
    loadQueueWithClaimedMiddle();
    openCreateModalFromQueue();

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-queue-reject-and-next"]')!
      .click();
    fixture.detectChanges();

    expect(component.selectedQuestion()?.id).toBe(MISSING_SHEET_QUESTION_ID);
    expect(component.questions()).toEqual([claimedMiddleQuestion, queuedQuestionWithMissingSheet]);
  });

  it('closes the modal when only claimed rows remain after the current question', () => {
    queueService.listQueuedQuestions.mockReturnValue(of([queuedQuestion, claimedMiddleQuestion]));
    component.loadQueue();
    fixture.detectChanges();
    openCreateModalFromQueue();

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-queue-skip"]')!
      .click();
    fixture.detectChanges();

    expect(component.selectedQuestion()).toBeNull();
    expect(component.questions()).toEqual([queuedQuestion, claimedMiddleQuestion]);
  });

  it('keeps the selected question and its draft when skip is cancelled', () => {
    openCreateModalFromQueue();
    setInputValue('#matrix-form-question-ru', 'Unsaved matrix question');
    jest.mocked(window.confirm).mockReturnValue(false);

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-queue-skip"]')!
      .click();
    fixture.detectChanges();

    expect(window.confirm).toHaveBeenCalled();
    expect(component.selectedQuestion()?.id).toBe(QUESTION_ID);
    expect(inputValue('#matrix-form-question-ru')).toBe('Unsaved matrix question');
  });

  it('discards unfinished nested drafts before advancing to the next question', () => {
    openCreateModalFromQueue();
    setInputValue('[data-testid="matrix-resource-new-name-ru"]', 'Черновик ресурса');
    jest.mocked(window.confirm).mockReturnValue(true);

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-queue-skip"]')!
      .click();
    fixture.detectChanges();

    expect(component.selectedQuestion()?.id).toBe(MISSING_SHEET_QUESTION_ID);
    expect(inputValue('[data-testid="matrix-resource-new-name-ru"]')).toBe('');
    expect(component.unsavedChangesScope.hasChanges()).toBe(false);
  });

  it('keeps a changed create form open when closing is cancelled', () => {
    openCreateModalFromQueue();
    setInputValue('#matrix-form-question-ru', 'Unsaved matrix question');
    jest.mocked(window.confirm).mockReturnValue(false);

    component.closeCreateModal();
    fixture.detectChanges();

    expect(window.confirm).toHaveBeenCalled();
    expect(component.selectedQuestion()?.id).toBe(QUESTION_ID);
    expect(inputValue('#matrix-form-question-ru')).toBe('Unsaved matrix question');
  });

  it('closes the modal when the last visible queue entry is skipped', () => {
    openCreateModalFromQueue(MISSING_SHEET_QUESTION_ID);

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-queue-skip"]')!
      .click();
    fixture.detectChanges();

    expect(component.selectedQuestion()).toBeNull();
    expect(component.questions()).toEqual([queuedQuestion, queuedQuestionWithMissingSheet]);
  });

  it('blocks modal actions and closing while a queue create is pending', () => {
    const createResult = new Subject<{ id: string; slug: string }>();
    queueService.createQuestionFromQueue.mockReturnValue(createResult);
    openCreateModalFromQueue();

    component.createQuestion(minimumQuestionPayload());
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector<HTMLButtonElement>(
        '[data-testid="matrix-queue-reject-and-next"]',
      )?.disabled,
    ).toBe(true);
    expect(
      fixture.nativeElement.querySelector<HTMLButtonElement>('[data-testid="matrix-queue-skip"]')
        ?.disabled,
    ).toBe(true);
    expect(
      fixture.nativeElement.querySelector<HTMLButtonElement>(
        '[data-testid="matrix-queue-create-and-edit"]',
      )?.disabled,
    ).toBe(true);
    expect(
      fixture.nativeElement.querySelector<HTMLButtonElement>('[data-testid="matrix-form-save"]')
        ?.disabled,
    ).toBe(true);

    component.closeCreateModal();

    expect(component.selectedQuestion()?.id).toBe(QUESTION_ID);
  });

  it('blocks modal actions and keeps the current entry while rejection is pending', () => {
    const rejectResult = new Subject<void>();
    queueService.rejectQueuedQuestion.mockReturnValue(rejectResult);
    openCreateModalFromQueue();

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-queue-reject-and-next"]')!
      .click();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector<HTMLButtonElement>(
        '[data-testid="matrix-queue-reject-and-next"]',
      )?.disabled,
    ).toBe(true);
    expect(
      fixture.nativeElement.querySelector<HTMLButtonElement>('[data-testid="matrix-queue-skip"]')
        ?.disabled,
    ).toBe(true);
    expect(
      fixture.nativeElement.querySelector<HTMLButtonElement>(
        '[data-testid="matrix-queue-create-and-edit"]',
      )?.disabled,
    ).toBe(true);

    component.closeCreateModal();

    expect(component.selectedQuestion()?.id).toBe(QUESTION_ID);
    expect(component.questions()).toEqual([queuedQuestion, queuedQuestionWithMissingSheet]);
  });

  it('keeps the current entry and form open when rejection fails', () => {
    queueService.rejectQueuedQuestion.mockReturnValue(
      throwError(() => ({ message: 'Failed' }) as ApiError),
    );
    openCreateModalFromQueue();

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-queue-reject-and-next"]')!
      .click();
    fixture.detectChanges();

    expect(notificationService.error).toHaveBeenCalledWith('Не удалось отклонить вопрос.');
    expect(component.selectedQuestion()?.id).toBe(QUESTION_ID);
    expect(component.questions()).toEqual([queuedQuestion, queuedQuestionWithMissingSheet]);
  });

  it('keeps create modal open and shows feedback when queue item creation fails', () => {
    const error: ApiError = {
      code: 'bad_request',
      type: 'bad_request',
      message: 'Failed',
      status: 400,
      location: 'body',
      attr: 'payload.slug',
    };
    queueService.createQuestionFromQueue.mockReturnValue(throwError(() => error));
    openCreateModalFromQueue();

    component.createQuestion(minimumQuestionPayload());
    fixture.detectChanges();

    expect(notificationService.error).toHaveBeenCalledWith('Не удалось создать вопрос из очереди.');
    expect(fixture.nativeElement.querySelector('.modal-xl')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('payload / slug: Failed');
    expect(component.selectedQuestion()?.id).toBe(QUESTION_ID);
    expect(component.questions()).toEqual([queuedQuestion, queuedQuestionWithMissingSheet]);
  });

  function openAddModal(): void {
    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-queue-open-manual-add"]')!
      .click();
    fixture.detectChanges();
  }

  function openImportMode(): void {
    openAddModal();
    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-queue-import-mode"]')!
      .click();
    fixture.detectChanges();
  }

  function openImportPreview(): File {
    openImportMode();
    const file = new File(['question'], 'questions.txt', { type: 'text/plain' });
    chooseImportFile(file);
    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-queue-import-submit"]')!
      .click();
    fixture.detectChanges();
    return file;
  }

  function chooseImportFile(file: File): void {
    const input = fixture.nativeElement.querySelector<HTMLInputElement>(
      '[data-testid="matrix-queue-import-file-input"]',
    )!;
    Object.defineProperty(input, 'files', {
      value: [file],
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  function dropImportFiles(files: File[]): void {
    const dropZone = fixture.nativeElement.querySelector<HTMLElement>(
      '[data-testid="matrix-queue-import-drop-zone"]',
    )!;
    const event = new Event('drop', { bubbles: true }) as DragEvent;
    Object.defineProperty(event, 'dataTransfer', {
      value: { files },
    });
    dropZone.dispatchEvent(event);
    fixture.detectChanges();
  }

  function openCreateModalFromQueue(questionId = QUESTION_ID): void {
    fixture.nativeElement
      .querySelector<HTMLButtonElement>(`[data-testid="matrix-queue-question-${questionId}"]`)!
      .click();
    fixture.detectChanges();
  }

  function loadQueueWithClaimedMiddle(): void {
    loadQueueWithQuestions([queuedQuestion, claimedMiddleQuestion, queuedQuestionWithMissingSheet]);
  }

  function loadQueueWithQuestions(questions: QueuedMatrixQuestion[]): void {
    queueService.listQueuedQuestions.mockReturnValue(of(questions));
    component.loadQueue();
    fixture.detectChanges();
  }

  function visibleQuestionIds(): string[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll<HTMLButtonElement>(
        '[data-testid^="matrix-queue-question-"]',
      ),
    ).map((button) => button.dataset['testid']!.replace('matrix-queue-question-', ''));
  }

  function setSelectValue(selector: string, value: string): void {
    chooseSiteSelectOption(fixture, selector, value);
  }

  function expectStatistic(testId: string, expectedValue: string): void {
    const element = fixture.nativeElement.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    expect(element?.textContent).toContain(expectedValue);
  }

  function minimumQuestionPayload(): AdminMatrixQuestionPayload {
    return {
      slug: 'pep-8',
      subsectionId: SUBSECTION_ID,
      grade: null,
      interviewFrequency: null,
      publishStatus: 'Draft',
      translations: {
        ru: {
          question: 'Что такое PEP 8?',
          answer: '',
          interviewAnswerExplanation: '',
        },
        en: {
          question: 'What is PEP 8?',
          answer: '',
          interviewAnswerExplanation: '',
        },
      },
      resources: [],
    };
  }

  function fillValidCreateForm(): void {
    chooseSiteSelectOption(fixture, '[data-testid="matrix-structure-section"]', SECTION_ID);
    chooseSiteSelectOption(fixture, '[data-testid="matrix-structure-subsection"]', SUBSECTION_ID);
  }

  function inputValue(selector: string): string {
    const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement | null;
    if (input === null) {
      throw new Error(`Missing queue form input: ${selector}`);
    }
    return input.value;
  }

  function setInputValue(selector: string, value: string): void {
    const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement | null;
    if (input === null) {
      throw new Error(`Missing queue form input: ${selector}`);
    }
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function buttonText(selector: string): string | undefined {
    return fixture.nativeElement.querySelector<HTMLButtonElement>(selector)?.textContent?.trim();
  }

  function select(selector: string): HTMLButtonElement {
    const element = fixture.nativeElement.querySelector(selector) as HTMLButtonElement | null;
    if (element === null) {
      throw new Error(`Missing queue form select: ${selector}`);
    }
    return element;
  }

  function expectInvalidControl(selector: string, expectedMessage: string): void {
    const element = fixture.nativeElement.querySelector(selector) as HTMLElement | null;
    expect(element).not.toBeNull();
    expect(element?.classList).toContain('is-invalid');
    expect(element?.getAttribute('aria-invalid')).toBe('true');
    expect(fixture.nativeElement.textContent).toContain(expectedMessage);
  }
});

function formatExpectedDateTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
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
