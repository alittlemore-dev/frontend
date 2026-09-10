import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { provideRouter } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { MatrixListComponent } from './matrix-list.component';
import { MatrixService } from '../../services/matrix.service';
import { ApiError } from '../../../../core/models/api-error.model';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import {
  MatrixQuestionDetail,
  MatrixQuestionList,
  MatrixSheet,
} from '../../models/matrix-question.model';
import { NotificationService } from '../../../../core/notifications/notification.service';
import {
  chooseSiteSelectOption,
  siteSelectOptionValues,
  siteSelectTrigger,
  siteSelectValue,
} from '../../../../testing/site-select-testing';

const mockSheets: MatrixSheet[] = [
  { key: 'javascript', name: 'JavaScript' },
  { key: 'python', name: 'Python' },
];

const mockQuestionList: MatrixQuestionList = {
  sheetKey: 'javascript',
  sheet: 'JavaScript',
  sections: [
    {
      section: 'Core',
      subsections: [
        {
          subsection: 'Syntax',
          grades: [
            {
              grade: 'Junior',
              questions: [
                {
                  slug: 'what-is-a-closure',
                  question: 'What is a closure?',
                  interviewFrequency: 'often',
                },
                {
                  slug: 'what-is-hoisting',
                  question: 'What is hoisting?',
                  interviewFrequency: null,
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const duplicateSubsectionQuestionList: MatrixQuestionList = {
  sheetKey: 'javascript',
  sheet: 'JavaScript',
  sections: [
    {
      section: 'Runtime',
      subsections: [
        {
          subsection: 'Basics',
          grades: [
            {
              grade: 'Junior',
              questions: [
                {
                  slug: 'how-does-the-event-loop-work',
                  question: 'How does the event loop work?',
                  interviewFrequency: 'rarely',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      section: 'Browser',
      subsections: [
        {
          subsection: 'Basics',
          grades: [
            {
              grade: 'Junior',
              questions: [
                {
                  slug: 'what-is-dom-event-delegation',
                  question: 'What is DOM event delegation?',
                  interviewFrequency: 'neverSeen',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const mockDetail: MatrixQuestionDetail = {
  slug: 'what-is-a-closure',
  question: 'What is a closure?',
  answer: 'A **closure** is a function.',
  interviewAnswerExplanation: 'Lexical scoping.',
  sheetKey: 'javascript',
  sheet: 'JavaScript',
  grade: 'Junior',
  interviewFrequency: 'often',
  section: 'Core',
  subsection: 'Syntax',
  publishStatus: 'Published',
  suggestedByUsername: 'anon',
  translations: {
    ru: {
      question: 'Что такое замыкание?',
      answer: 'Замыкание — это функция.',
      interviewAnswerExplanation: 'Лексическая область видимости.',
      sheet: 'JavaScript',
      section: 'Core',
      subsection: 'Syntax',
    },
    en: {
      question: 'What is a closure?',
      answer: 'A **closure** is a function.',
      interviewAnswerExplanation: 'Lexical scoping.',
      sheet: 'JavaScript',
      section: 'Core',
      subsection: 'Syntax',
    },
  },
  resources: [],
};

const mockError: ApiError = {
  code: 'server_error',
  type: 'server_error',
  message: 'Internal server error',
  location: null,
  attr: null,
};

describe('MatrixListComponent', () => {
  let fixture: ComponentFixture<MatrixListComponent>;
  let component: MatrixListComponent;
  let matrixService: {
    getPublicSheets: jest.Mock;
    getAdminSheets: jest.Mock;
    getPublicQuestions: jest.Mock;
    getAdminQuestions: jest.Mock;
    getPublicQuestionBySlug: jest.Mock;
    getAdminQuestion: jest.Mock;
    searchAdminResources: jest.Mock;
    createAdminQuestion: jest.Mock;
    updateAdminQuestion: jest.Mock;
    publishAdminQuestion: jest.Mock;
    unpublishAdminQuestion: jest.Mock;
    deleteAdminQuestion: jest.Mock;
    suggestQuestion: jest.Mock;
  };
  let notificationService: { success: jest.Mock; error: jest.Mock };

  beforeEach(async () => {
    matrixService = {
      getPublicSheets: jest.fn().mockReturnValue(of(mockSheets)),
      getAdminSheets: jest.fn().mockReturnValue(of(mockSheets)),
      getPublicQuestions: jest.fn().mockReturnValue(of(mockQuestionList)),
      getAdminQuestions: jest.fn().mockReturnValue(of(mockQuestionList)),
      getPublicQuestionBySlug: jest.fn().mockReturnValue(of(mockDetail)),
      getAdminQuestion: jest.fn().mockReturnValue(of(mockDetail)),
      searchAdminResources: jest.fn().mockReturnValue(of([])),
      createAdminQuestion: jest.fn().mockReturnValue(of(mockDetail)),
      updateAdminQuestion: jest.fn().mockReturnValue(of(mockDetail)),
      publishAdminQuestion: jest.fn().mockReturnValue(of(undefined)),
      unpublishAdminQuestion: jest.fn().mockReturnValue(of(undefined)),
      deleteAdminQuestion: jest.fn().mockReturnValue(of(undefined)),
      suggestQuestion: jest.fn().mockReturnValue(of(undefined)),
    };

    notificationService = {
      success: jest.fn(),
      error: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [MatrixListComponent],
      providers: [
        { provide: MatrixService, useValue: matrixService },
        { provide: NotificationService, useValue: notificationService },
        provideI18nTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MatrixListComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  it('should show loading spinner while loading', () => {
    // Initialize first, then override with our desired state
    fixture.detectChanges();
    component.loading.set(true);
    component.error.set(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-loading-spinner')).toBeTruthy();
  });

  it('should not show spinner when not loading', () => {
    fixture.detectChanges();
    component.loading.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-loading-spinner')).toBeFalsy();
  });

  it('should show error message when error is set', () => {
    fixture.detectChanges();
    component.loading.set(false);
    component.error.set(mockError);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-error-message')).toBeTruthy();
  });

  it('should show empty state when no questions match filter', () => {
    fixture.detectChanges();
    component.loading.set(false);
    component.error.set(null);
    component.questions.set({ sheetKey: 'javascript', sheet: 'JavaScript', sections: [] });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
  });

  it('should load sheets on init and auto-select first sheet', () => {
    fixture.detectChanges();
    expect(matrixService.getPublicSheets).toHaveBeenCalledWith('ru');
    expect(component.selectedSheet()).toEqual(mockSheets[0]);
  });

  it('does not call admin sheet endpoints on public routes', () => {
    fixture.detectChanges();

    expect(matrixService.getPublicSheets).toHaveBeenCalledWith('ru');
    expect(matrixService.getAdminSheets).not.toHaveBeenCalled();
  });

  it('should restore sheet from localStorage on init', () => {
    localStorage.setItem('chosenSheet', 'python');
    // Create a new component instance so ngOnInit reads localStorage
    fixture = TestBed.createComponent(MatrixListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    const tabs = fixture.nativeElement.querySelectorAll('app-matrix-readonly-sheet-tabs button');
    const pythonTab = Array.from(tabs).find(
      (btn: unknown) => (btn as HTMLElement).textContent?.trim() === 'Python',
    ) as HTMLElement | undefined;
    expect(pythonTab).toBeTruthy();
    expect(pythonTab!.getAttribute('aria-selected')).toBe('true');
  });

  it('should store sheet to localStorage when sheet is selected', () => {
    fixture.detectChanges();
    component.selectSheet('python');
    expect(localStorage.getItem('chosenSheet')).toBe('python');
  });

  it('does not use localStorage when a server document has no defaultView', async () => {
    const serverDocument = document.implementation.createHTMLDocument('server');
    Object.defineProperty(serverDocument, 'defaultView', {
      configurable: true,
      value: null,
    });
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('localStorage is not available on the server');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('localStorage is not available on the server');
    });
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [MatrixListComponent],
      providers: [
        { provide: MatrixService, useValue: matrixService },
        { provide: NotificationService, useValue: notificationService },
        {
          provide: DOCUMENT,
          useValue: serverDocument,
        },
        provideI18nTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    const serverFixture = TestBed.createComponent(MatrixListComponent);
    const serverComponent = serverFixture.componentInstance;
    serverFixture.detectChanges();

    expect(serverComponent.selectedSheet()).toEqual(mockSheets[0]);
    serverComponent.selectSheet('python');
    expect(serverComponent.selectedSheet()).toEqual(mockSheets[1]);
  });

  it('should load questions for selected sheet', () => {
    fixture.detectChanges();
    component.selectSheet('python');
    expect(matrixService.getPublicQuestions).toHaveBeenLastCalledWith('python', 'ru');
  });

  it('should render grid layout by default', () => {
    component.loading.set(false);
    component.error.set(null);
    component.questions.set(mockQuestionList);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-matrix-readonly-grouped-grid')).toBeTruthy();
  });

  it('should render Russian page title', () => {
    fixture.detectChanges();
    const title = fixture.nativeElement.querySelector('h1') as HTMLElement;
    expect(title.textContent?.trim()).toBe('Матрица компетенций');
  });

  it('uses fullscreen modal dialogs on narrow public screens', () => {
    component.detailVisible.set(true);
    component.suggestionVisible.set(true);
    fixture.detectChanges();

    const dialogs = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLElement>('.modal-dialog'),
    );

    expect(dialogs.length).toBe(2);
    expect(dialogs.every((dialog) => dialog.classList.contains('modal-fullscreen-sm-down'))).toBe(
      true,
    );
  });

  it('should not show published/all filter for users without content access', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#onlyPublishedToggle')).toBeNull();
  });

  it('does not show published/all filter on public routes', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#onlyPublishedToggle')).toBeNull();
  });

  it('does not render the admin add-question form on public routes', () => {
    fixture.detectChanges();

    const addButton = fixture.nativeElement.querySelector(
      '[data-testid="matrix-filter-add-question"]',
    );

    expect(addButton).toBeNull();
    expect(fixture.nativeElement.querySelector('app-matrix-question-form')).toBeNull();
  });

  it('should filter questions by search term, removing empty groups', () => {
    component.questions.set(mockQuestionList);
    component.search.set('closure');
    const filtered = component.filteredQuestions();
    expect(filtered).not.toBeNull();
    const allQuestions = filtered!.sections.flatMap((s) =>
      s.subsections.flatMap((sub) => sub.grades.flatMap((g) => g.questions)),
    );
    expect(allQuestions.length).toBe(1);
    expect(allQuestions[0].question).toBe('What is a closure?');
  });

  it('filters table layout search when subsections have duplicate names', () => {
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      matrixService.getPublicQuestions.mockReturnValue(of(duplicateSubsectionQuestionList));
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector<HTMLInputElement>('input[type="text"]')!;
      input.value = 'delegation';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const grid = fixture.nativeElement.querySelector(
        'app-matrix-readonly-grouped-grid',
      ) as HTMLElement;
      expect(grid.textContent).toContain('Browser');
      expect(grid.textContent).toContain('What is DOM event delegation?');
      expect(grid.textContent).not.toContain('Runtime');
      expect(grid.textContent).not.toContain('How does the event loop work?');
      expect(
        [...consoleWarn.mock.calls, ...consoleError.mock.calls].flat().join(' '),
      ).not.toContain('NG0955');
    } finally {
      consoleWarn.mockRestore();
      consoleError.mockRestore();
    }
  });

  it('should remove empty grade groups when filtering', () => {
    component.questions.set(mockQuestionList);
    component.search.set('nonexistent');
    const filtered = component.filteredQuestions();
    expect(filtered!.sections.length).toBe(0);
  });

  it('should handle empty sheet list gracefully', () => {
    matrixService.getPublicSheets.mockReturnValue(of([]));
    fixture = TestBed.createComponent(MatrixListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-loading-spinner')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('app-matrix-readonly-sheet-tabs')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
  });

  it('should show error when getSheets fails', () => {
    matrixService.getPublicSheets.mockReturnValue(throwError(() => mockError));
    // Create new component instance so ngOnInit runs with new mock
    fixture = TestBed.createComponent(MatrixListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-error-message')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-loading-spinner')).toBeFalsy();
  });

  it('should open detail modal when openDetail is called', () => {
    fixture.detectChanges();
    component.loading.set(false);
    component.error.set(null);
    component.questions.set(mockQuestionList);
    fixture.detectChanges();
    component.openDetail('what-is-a-closure');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-matrix-question-detail')).toBeTruthy();
  });

  it('opens public detail modals through the slug endpoint used by question pages', () => {
    fixture.detectChanges();

    component.openDetail('what-is-a-closure');

    expect(matrixService.getPublicQuestionBySlug).toHaveBeenCalledWith('what-is-a-closure', 'ru');
    expect(matrixService.getAdminQuestion).not.toHaveBeenCalled();
  });

  it('renders the public question page link in the detail modal header', () => {
    fixture.detectChanges();
    component.openDetail('what-is-a-closure');
    fixture.detectChanges();

    const modal = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    const header = modal.querySelector('.modal-header') as HTMLElement | null;
    const link = header?.querySelector(
      'a[href="/ru/competency-matrix/questions/what-is-a-closure"]',
    ) as HTMLAnchorElement | null;

    expect(modal.querySelector('.modal-title')).toBeNull();
    expect(link?.textContent).toContain('К вопросу');
    expect(
      modal.querySelector(
        '.question-detail a[href="/ru/competency-matrix/questions/what-is-a-closure"]',
      ),
    ).toBeNull();
  });

  it('should set detailLoading when loading a question', () => {
    const subject = new Subject();
    matrixService.getPublicQuestionBySlug.mockReturnValue(subject.asObservable());
    fixture.detectChanges();
    component.openDetail('what-is-a-closure');
    fixture.detectChanges();
    const modal = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(modal).toBeTruthy();
    expect(modal.querySelector('app-loading-spinner')).toBeTruthy();
  });

  it('should set selectedQuestion after detail loads', () => {
    fixture.detectChanges();
    component.openDetail('what-is-a-closure');
    fixture.detectChanges();
    const modal = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(modal).toBeTruthy();
    expect(modal.querySelector('app-loading-spinner')).toBeFalsy();
    expect(modal.querySelector('app-matrix-question-detail .question-detail')).toBeTruthy();
  });

  it('should set detailError when detail load fails', () => {
    matrixService.getPublicQuestionBySlug.mockReturnValue(throwError(() => mockError));
    fixture.detectChanges();
    component.openDetail('what-is-a-closure');
    fixture.detectChanges();
    const modal = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(modal).toBeTruthy();
    expect(modal.querySelector('app-error-message')).toBeTruthy();
    expect(modal.querySelector('app-loading-spinner')).toBeFalsy();
  });

  it('should hide modal and clear question when closeDetail is called', () => {
    fixture.detectChanges();
    component.openDetail('what-is-a-closure');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeTruthy();
    component.closeDetail();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeFalsy();
  });

  it('shows quota notification when anonymous suggestion is rate limited', () => {
    const quotaError: ApiError = {
      code: 'too_many_requests',
      type: 'too_many_requests',
      message: 'Question suggestion daily quota exceeded',
      status: 429,
      location: null,
      attr: null,
    };
    matrixService.suggestQuestion.mockReturnValue(throwError(() => quotaError));

    fixture.detectChanges();
    component.openQuestionSuggestion();
    component.setQuestionSuggestion('What is PEP 8?');
    component.sendQuestionSuggestion();

    expect(matrixService.suggestQuestion).toHaveBeenCalledWith('What is PEP 8?', 'javascript');
    expect(notificationService.error).toHaveBeenCalledWith(
      'Лимит предложений на сегодня исчерпан.',
    );
  });

  it('keeps duplicate suggestion open with localized inline feedback until edited', () => {
    const duplicateError: ApiError = {
      code: 'client_error',
      type: 'conflict',
      message: 'Question already exists in the competency matrix or suggestion queue',
      status: 409,
      location: null,
      attr: null,
    };
    matrixService.suggestQuestion.mockReturnValue(throwError(() => duplicateError));

    fixture.detectChanges();
    component.openQuestionSuggestion();
    component.setQuestionSuggestion('What is PEP 8?');
    component.sendQuestionSuggestion();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector<HTMLInputElement>(
      '#matrix-question-suggestion',
    );
    const feedback = fixture.nativeElement.querySelector<HTMLElement>(
      '[data-testid="matrix-question-suggestion-duplicate"]',
    );
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeTruthy();
    expect(input?.value).toBe('What is PEP 8?');
    expect(input?.getAttribute('aria-invalid')).toBe('true');
    expect(feedback?.textContent).toContain(
      'Такой вопрос уже есть в матрице или ожидает рассмотрения.',
    );
    expect(notificationService.error).toHaveBeenCalledWith(
      'Такой вопрос уже есть в матрице или ожидает рассмотрения.',
    );

    component.setQuestionSuggestion('How does mypy help?');
    fixture.detectChanges();

    expect(input?.getAttribute('aria-invalid')).toBe('false');
    expect(
      fixture.nativeElement.querySelector('[data-testid="matrix-question-suggestion-duplicate"]'),
    ).toBeNull();
  });

  it('renders question suggestion as a one-line input', () => {
    fixture.detectChanges();
    component.openQuestionSuggestion();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector<HTMLInputElement>(
      '#matrix-question-suggestion',
    );

    expect(input).toBeTruthy();
    expect(input?.tagName).toBe('INPUT');
    expect(input?.type).toBe('text');
    expect(fixture.nativeElement.querySelector('textarea#matrix-question-suggestion')).toBeNull();
  });

  it('renders suggestion sheet selector initialized with the current sheet only', () => {
    fixture.detectChanges();
    component.openQuestionSuggestion();
    fixture.detectChanges();

    const select = siteSelectTrigger(fixture, '#matrix-question-suggestion-sheet');

    expect(select.getAttribute('aria-required')).toBe('true');
    expect(siteSelectValue(fixture, '#matrix-question-suggestion-sheet')).toBe('javascript');
    expect(siteSelectOptionValues(fixture, '#matrix-question-suggestion-sheet')).toEqual([
      'javascript',
      'python',
    ]);
    expect(fixture.nativeElement.querySelector('#matrix-question-suggestion-grade')).toBeNull();
    expect(fixture.nativeElement.querySelector('#matrix-question-suggestion-section')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('#matrix-question-suggestion-subsection'),
    ).toBeNull();
  });

  it('sends suggestion with the selected sheet key', () => {
    fixture.detectChanges();
    component.openQuestionSuggestion();
    fixture.detectChanges();

    chooseSiteSelectOption(fixture, '#matrix-question-suggestion-sheet', 'python');
    component.setQuestionSuggestion('What is PEP 8?');

    component.sendQuestionSuggestion();

    expect(matrixService.suggestQuestion).toHaveBeenCalledWith('What is PEP 8?', 'python');
  });

  it('disables suggestions when no public sheet is available', () => {
    matrixService.getPublicSheets.mockReturnValue(of([]));
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector<HTMLButtonElement>(
      '[data-testid="matrix-filter-suggest-question"]',
    );
    expect(button?.disabled).toBe(true);

    component.openQuestionSuggestion();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(notificationService.error).toHaveBeenCalledWith(
      'Нет публичных листов, для которых можно предложить вопрос.',
    );
  });

  it('does not submit a suggestion without a selected public sheet', () => {
    fixture.detectChanges();
    component.openQuestionSuggestion();
    component.setQuestionSuggestion('What is PEP 8?');
    component.setQuestionSuggestionSheet('');
    fixture.detectChanges();

    const submit = fixture.nativeElement.querySelector<HTMLButtonElement>(
      '[data-testid="matrix-question-suggestion-submit"]',
    );
    expect(submit?.disabled).toBe(true);

    component.sendQuestionSuggestion();

    expect(matrixService.suggestQuestion).not.toHaveBeenCalled();
    expect(notificationService.error).toHaveBeenCalledWith('Выберите публичный лист для вопроса.');
  });

  it('normalizes multiline pasted suggestion text before sending it', () => {
    fixture.detectChanges();
    component.openQuestionSuggestion();
    component.setQuestionSuggestion('What is PEP 8?\nHow should it be used?');

    component.sendQuestionSuggestion();

    expect(matrixService.suggestQuestion).toHaveBeenCalledWith(
      'What is PEP 8? How should it be used?',
      'javascript',
    );
  });
});
