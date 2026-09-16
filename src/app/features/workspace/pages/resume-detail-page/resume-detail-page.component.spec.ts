import { NotificationService } from '@alittlemore.dev/design-system';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../../../core/models/api-error.model';
import { I18nService } from '../../../../core/i18n/i18n.service';

import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { chooseSiteSelectOption, siteSelectValue } from '@alittlemore.dev/design-system/testing';
import { Resume, ResumePayload } from '../../models/resume-workspace.model';
import { ResumeWorkspaceService } from '../../services/resume-workspace.service';
import { UnsavedChangesService } from '../../../../core/unsaved-changes/unsaved-changes.service';
import { ResumeDetailPageComponent } from './resume-detail-page.component';

type ResumeValidationCaseSetup =
  'education' | 'language' | 'certification' | 'additionalSection' | 'additionalItem';

type ResumeEditorTab =
  | 'profile'
  | 'summary'
  | 'skills'
  | 'experience'
  | 'education'
  | 'languages'
  | 'certifications'
  | 'additional';

interface ResumeFieldValidationCase {
  description: string;
  tab: ResumeEditorTab;
  elementId: string;
  invalidValue: string;
  expectedIssue: string;
  setup?: ResumeValidationCaseSetup;
}

const INVALID_SHORT_TEXT = 'x'.repeat(256);
const INVALID_LONG_TEXT = 'x'.repeat(10001);
const INVALID_DATE_TEXT = 'x'.repeat(33);
const INVALID_URL = 'ftp://example.com';
const RESUME_ID = '00000000000000000000000000000007';

describe('ResumeDetailPageComponent', () => {
  let fixture: ComponentFixture<ResumeDetailPageComponent>;
  let service: {
    getResume: jest.Mock;
    updateResume: jest.Mock;
    deleteResume: jest.Mock;
    exportResume: jest.Mock;
  };
  let router: Router;
  let i18n: I18nService;
  let notifications: {
    success: jest.Mock;
    error: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      getResume: jest.fn().mockReturnValue(of(resume())),
      updateResume: jest.fn().mockReturnValue(of(resume({ title: 'Updated resume' }))),
      deleteResume: jest.fn().mockReturnValue(of(undefined)),
      exportResume: jest
        .fn()
        .mockReturnValue(of(new Blob(['resume'], { type: 'application/pdf' }))),
    };
    notifications = {
      success: jest.fn(),
      error: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ResumeDetailPageComponent],
      providers: [
        provideRouter([]),
        provideI18nTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'id' ? RESUME_ID : null),
              },
            },
          },
        },
        { provide: ResumeWorkspaceService, useValue: service },
        { provide: NotificationService, useValue: notifications },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    i18n = TestBed.inject(I18nService);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    Object.defineProperty(window.URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn().mockReturnValue('blob:resume-export'),
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      configurable: true,
      value: jest.fn(),
    });
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    fixture = TestBed.createComponent(ResumeDetailPageComponent);
    fixture.detectChanges();
  });

  it('loads detail into the edit form', () => {
    expect(service.getResume).toHaveBeenCalledWith(RESUME_ID);
    expect(inputValue('resume-title')).toBe('Backend resume');
    expect(inputValue('resume-language')).toBe('ru');
    expect(inputValue('resume-profile-full-name')).toBe('Candidate Name');
    fixture.componentInstance.setActiveTab('summary');
    fixture.detectChanges();
    expect(inputValue('resume-summary')).toBe('Сильный backend опыт.');
    expect(fixture.nativeElement.textContent).toContain('Профиль');
    expect(fixture.nativeElement.textContent).toContain('Навыки');
  });

  it('edits and saves an explicit update payload', () => {
    setInputValue('resume-title', 'Target backend resume');
    setInputValue('resume-language', 'en');
    fixture.componentInstance.setActiveTab('summary');
    fixture.detectChanges();
    setInputValue('resume-summary', 'Updated summary');

    fixture.componentInstance.saveResume();

    expect(service.updateResume).toHaveBeenCalledWith(
      RESUME_ID,
      expect.objectContaining({
        title: 'Target backend resume',
        language: 'en',
        content: expect.objectContaining({
          summary: {
            text: 'Updated summary',
          },
          education: [],
          languages: [],
          certifications: [],
          additionalSections: [],
        }),
      }) satisfies ResumePayload,
    );
    expect(notifications.success).toHaveBeenCalledWith('Резюме сохранено.');
  });

  it('tracks the complete editor against the loaded and saved resume', () => {
    const unsavedChanges = TestBed.inject(UnsavedChangesService);
    expect(unsavedChanges.hasChanges()).toBe(false);

    fixture.componentInstance.addSkillGroup();
    expect(unsavedChanges.hasChanges()).toBe(true);

    fixture.componentInstance.removeSkillGroup(fixture.componentInstance.skills.length - 1);
    expect(unsavedChanges.hasChanges()).toBe(false);

    setInputValue('resume-title', 'Updated resume');
    fixture.componentInstance.saveResume();
    expect(unsavedChanges.hasChanges()).toBe(false);
  });

  it('does not commit draft changes after a failed save or export', () => {
    const unsavedChanges = TestBed.inject(UnsavedChangesService);
    service.updateResume.mockReturnValueOnce(throwError(() => apiError()));
    setInputValue('resume-title', 'Unsaved title');

    fixture.componentInstance.saveResume();
    expect(unsavedChanges.hasChanges()).toBe(true);

    fixture.componentInstance.openExportModal();
    fixture.componentInstance.selectExportFormat('pdf');
    fixture.componentInstance.exportResume();
    expect(unsavedChanges.hasChanges()).toBe(true);
  });

  it('commits the editor before navigating after deletion', () => {
    const unsavedChanges = TestBed.inject(UnsavedChangesService);
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    setInputValue('resume-title', 'Discarded by delete');

    fixture.componentInstance.deleteResume();

    expect(unsavedChanges.hasChanges()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/personal-workspace/resumes'], {
      queryParamsHandling: 'preserve',
      replaceUrl: true,
    });
  });

  it('renders preview from unsaved form state', () => {
    fixture.componentInstance.setActiveTab('summary');
    fixture.detectChanges();
    setInputValue('resume-summary', 'Несохраненная сводка');

    fixture.componentInstance.showPreview();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="resume-preview"]')).not.toBe(null);
    expect(fixture.nativeElement.textContent).toContain('Несохраненная сводка');
  });

  it('keeps preview language tied to the resume language, not UI language', () => {
    fixture.componentInstance.showPreview();
    i18n.switchLanguage('en').subscribe();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Backend инженер');
    expect(fixture.nativeElement.textContent).toContain('Сильный backend опыт.');
    expect(fixture.nativeElement.textContent).toContain('Саммари');
    expect(fixture.nativeElement.textContent).not.toContain('Strong backend experience.');
    expect(fixture.nativeElement.textContent).not.toContain('Summary');
  });

  it('renders the back action with a left arrow icon', () => {
    const backButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Назад'),
    ) as HTMLButtonElement | undefined;

    expect(backButton?.querySelector('svg')).not.toBeNull();
  });

  it('renders save, export, and delete as accessible icon buttons', () => {
    const saveButton = buttonByLabel('Сохранить');
    const exportButton = buttonByLabel('Экспорт');
    const deleteButton = buttonByLabel('Удалить');

    expect(saveButton.querySelector('svg')).not.toBeNull();
    expect(exportButton.querySelector('svg')).not.toBeNull();
    expect(deleteButton.querySelector('svg')).not.toBeNull();
    expect(textNodeContent(saveButton)).toBe('');
    expect(textNodeContent(exportButton)).toBe('');
    expect(textNodeContent(deleteButton)).toBe('');
  });

  it('renders resume editor tabs without horizontal scrolling classes', () => {
    const tabs = fixture.nativeElement.querySelector('.nav-tabs') as HTMLElement | null;

    expect(tabs).not.toBeNull();
    expect(tabs?.classList.contains('flex-wrap')).toBe(true);
    expect(tabs?.classList.contains('flex-nowrap')).toBe(false);
    expect(tabs?.classList.contains('overflow-auto')).toBe(false);
  });

  it('renders the resume language control as a compact dropdown', () => {
    const languageField = fixture.nativeElement.querySelector(
      '.resume-language-field',
    ) as HTMLElement | null;
    const languageSelect = elementByTestId<HTMLButtonElement>('resume-language');
    const languageSelectHost = languageSelect.closest('ds-site-select');

    expect(languageField?.classList.contains('col-md-auto')).toBe(true);
    expect(languageSelect.classList.contains('form-select-sm')).toBe(false);
    expect(languageSelectHost?.classList.contains('resume-language-select')).toBe(true);
  });

  it('renders top-level repeatable add actions after their lists', () => {
    const cases = [
      { tab: 'skills', label: 'Добавить группу навыков' },
      { tab: 'experience', label: 'Добавить компанию' },
      { tab: 'education', label: 'Добавить образование' },
      { tab: 'languages', label: 'Добавить язык' },
      { tab: 'certifications', label: 'Добавить сертификат' },
      { tab: 'additional', label: 'Добавить раздел' },
    ] as const;

    for (const item of cases) {
      fixture.componentInstance.setActiveTab(item.tab);
      fixture.detectChanges();

      const list = fixture.nativeElement.querySelector('.resume-entry-list') as HTMLElement | null;
      const addButton = buttonByLabel(item.label);

      expect(list).not.toBeNull();
      expect(textNodeContent(addButton)).toBe('+');
      expect(list?.compareDocumentPosition(addButton)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    }
  });

  it('renders experience repeatable actions as accessible symbol buttons', () => {
    fixture.componentInstance.setActiveTab('experience');
    fixture.detectChanges();

    const addCompanyButton = buttonByLabel('Добавить компанию');
    const removeCompanyButton = buttonByLabel('Удалить компанию');
    const addProjectButton = buttonByLabel('Добавить проект');
    const removeProjectButton = buttonByLabel('Удалить проект');

    expect(textNodeContent(addCompanyButton)).toBe('+');
    expect(textNodeContent(removeCompanyButton)).toBe('−');
    expect(textNodeContent(addProjectButton)).toBe('+');
    expect(textNodeContent(removeProjectButton)).toBe('−');
    expect(fixture.nativeElement.textContent).toContain('Компания 1');
  });

  it('loads list values into individual controls instead of newline textareas', () => {
    fixture.componentInstance.setActiveTab('skills');
    fixture.detectChanges();

    expect(inputValue('resume-skill-0-item-0')).toBe('Python');
    expect(inputValue('resume-skill-0-item-1')).toBe('SQLAlchemy');
    expect(fixture.nativeElement.querySelector('#resume-skill-0-items')).toBeNull();

    fixture.componentInstance.setActiveTab('experience');
    fixture.detectChanges();

    expect(elementValueById('resume-experience-0-highlight-0')).toBe('Ускорил сервис');
    expect(elementValueById('resume-experience-0-technology-0')).toBe('Python');
    expect(elementValueById('resume-experience-0-project-0-highlight-0')).toBe(
      'Статическая CSR SPA',
    );
    expect(elementValueById('resume-experience-0-project-0-technology-0')).toBe('Litestar');
    expect(fixture.nativeElement.querySelector('#resume-experience-0-highlights')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('#resume-experience-0-project-0-technologies'),
    ).toBeNull();
  });

  it('renders free-text multiline fields full-width while list fields use inputs', () => {
    fixture.componentInstance.setActiveTab('experience');
    fixture.detectChanges();

    const companySummary = elementById<HTMLTextAreaElement>('resume-experience-0-summary');
    const companyHighlights = elementById<HTMLInputElement>('resume-experience-0-highlight-0');
    const companyTechnologies = elementById<HTMLInputElement>('resume-experience-0-technology-0');
    const projectName = elementById<HTMLInputElement>('resume-experience-0-project-0-name');
    const projectRole = elementById<HTMLInputElement>('resume-experience-0-project-0-role');
    const projectDescription = elementById<HTMLTextAreaElement>(
      'resume-experience-0-project-0-description',
    );
    const projectHighlights = elementById<HTMLInputElement>(
      'resume-experience-0-project-0-highlight-0',
    );
    const projectTechnologies = elementById<HTMLInputElement>(
      'resume-experience-0-project-0-technology-0',
    );

    expect(fieldColumn(companySummary).classList.contains('col-12')).toBe(true);
    expect(fieldColumn(companyHighlights).classList.contains('col-12')).toBe(true);
    expect(fieldColumn(companyTechnologies).classList.contains('col-12')).toBe(true);
    expect(fieldColumn(projectDescription).classList.contains('col-12')).toBe(true);
    expect(fieldColumn(projectHighlights).classList.contains('col-12')).toBe(true);
    expect(fieldColumn(projectTechnologies).classList.contains('col-12')).toBe(true);
    expect(companyHighlights.tagName).toBe('INPUT');
    expect(fieldColumn(projectName).classList.contains('col-md-6')).toBe(true);
    expect(fieldColumn(projectRole).classList.contains('col-md-6')).toBe(true);
    expect(projectHighlights.tagName).toBe('INPUT');
  });

  it('renders skills and technologies as inline list inputs', () => {
    fixture.componentInstance.setActiveTab('skills');
    fixture.detectChanges();

    const skillItem = elementById<HTMLInputElement>('resume-skill-0-item-0');
    const skillAddButton = elementByTestId<HTMLButtonElement>('resume-skill-0-add-item');
    const skillRemoveButton = elementByTestId<HTMLButtonElement>('resume-skill-0-remove-item-0');

    expect(skillItem.closest('.resume-inline-list')).not.toBeNull();
    expect(skillAddButton.closest('.resume-inline-list')).not.toBeNull();
    expect(skillRemoveButton.closest('.resume-inline-list-item')).toBe(skillItem.parentElement);

    fixture.componentInstance.setActiveTab('experience');
    fixture.detectChanges();

    const experienceTechnology = elementById<HTMLInputElement>('resume-experience-0-technology-0');
    const experienceTechnologyAddButton = elementByTestId<HTMLButtonElement>(
      'resume-experience-0-add-technology',
    );
    const projectTechnology = elementById<HTMLInputElement>(
      'resume-experience-0-project-0-technology-0',
    );
    const projectTechnologyRemoveButton = elementByTestId<HTMLButtonElement>(
      'resume-experience-0-project-0-remove-technology-0',
    );

    expect(experienceTechnology.closest('.resume-inline-list')).not.toBeNull();
    expect(experienceTechnologyAddButton.closest('.resume-inline-list')).not.toBeNull();
    expect(projectTechnology.closest('.resume-inline-list')).not.toBeNull();
    expect(projectTechnologyRemoveButton.closest('.resume-inline-list-item')).toBe(
      projectTechnology.parentElement,
    );
  });

  it('renders inline inputs compactly without inline width styles', () => {
    fixture.componentInstance.setActiveTab('skills');
    fixture.detectChanges();
    setInputValue('resume-skill-0-item-0', 'gRPC');

    const skillItem = elementById<HTMLInputElement>('resume-skill-0-item-0');
    const skillItemShell = skillItem.closest('.resume-inline-list-item') as HTMLElement | null;

    expect(skillItemShell).not.toBeNull();
    expect(skillItemShell?.classList).toContain('resume-inline-list-item');
    expect(skillItemShell?.getAttribute('style')).toBeNull();

    fixture.componentInstance.setActiveTab('experience');
    fixture.detectChanges();
    setElementValueById('resume-experience-0-technology-0', 'event-driven architecture');

    const technology = elementById<HTMLInputElement>('resume-experience-0-technology-0');
    const technologyShell = technology.closest('.resume-inline-list-item') as HTMLElement | null;

    expect(technologyShell).not.toBeNull();
    expect(technologyShell?.classList).toContain('resume-inline-list-item');
    expect(technologyShell?.getAttribute('style')).toBeNull();
  });

  it('renders additional item add action after the section fields', () => {
    fixture.componentInstance.setActiveTab('additional');
    fixture.componentInstance.addAdditionalSection();
    fixture.detectChanges();

    const sectionTitle = fixture.nativeElement.querySelector(
      '#resume-additional-section-0-title',
    ) as HTMLElement | null;
    const addItemButton = buttonByLabel('Добавить пункт раздела');

    expect(textNodeContent(addItemButton)).toBe('+');
    expect(sectionTitle?.compareDocumentPosition(addItemButton)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('adds the first additional item when a section is added', () => {
    fixture.componentInstance.setActiveTab('additional');
    fixture.componentInstance.addAdditionalSection();
    fixture.detectChanges();

    expect(
      elementById<HTMLInputElement>('resume-additional-section-0-item-0-title'),
    ).not.toBeNull();
  });

  it('renders required field markers with the danger text color', () => {
    fixture.detectChanges();

    const markers = Array.from(
      fixture.nativeElement.querySelectorAll('.required-marker'),
    ) as HTMLElement[];

    expect(markers.length).toBeGreaterThan(0);
    for (const marker of markers) {
      expect(marker.classList).toContain('text-danger');
    }
  });

  it('opens and closes the export modal', () => {
    buttonByLabel('Экспорт').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Формат');
    expect(fixture.nativeElement.textContent).toContain('Выберите формат');
    expect(siteSelectValue(fixture, '[data-testid="resume-export-format"]')).toBe('');
    expect(elementByTestId<HTMLButtonElement>('resume-export-submit').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('.resume-export-modal .btn-warning')).toBeNull();

    buttonByLabel('Закрыть').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('scrolls the export form body when the wheel is used over its header', () => {
    buttonByLabel('Экспорт').click();
    fixture.detectChanges();
    const modalBody = elementByTestId<HTMLElement>('resume-export-modal-body');
    makeElementScrollable(modalBody, 600, 160);
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 80 });

    fixture.nativeElement
      .querySelector<HTMLElement>('.resume-export-modal header')!
      .dispatchEvent(event);

    expect(modalBody.scrollTop).toBe(80);
    expect(event.defaultPrevented).toBe(true);
  });

  it('exports unsaved form edits in the selected format', () => {
    fixture.componentInstance.setActiveTab('summary');
    fixture.detectChanges();
    setInputValue('resume-summary', 'Unsaved export summary');

    buttonByLabel('Экспорт').click();
    fixture.detectChanges();
    setInputValue('resume-export-format', 'docx');
    elementByTestId<HTMLButtonElement>('resume-export-submit').click();
    fixture.detectChanges();

    expect(service.exportResume).toHaveBeenCalledWith(
      RESUME_ID,
      'docx',
      expect.objectContaining({
        content: expect.objectContaining({
          summary: {
            text: 'Unsaved export summary',
          },
        }),
      }),
    );
    expect(window.URL.createObjectURL).toHaveBeenCalled();
    expect(notifications.success).toHaveBeenCalledWith('Резюме экспортировано.');
  });

  it('blocks export when the current form is invalid', () => {
    setInputValue('resume-title', '');

    buttonByLabel('Экспорт').click();
    fixture.detectChanges();
    setInputValue('resume-export-format', 'pdf');
    elementByTestId<HTMLButtonElement>('resume-export-submit').click();
    fixture.detectChanges();

    expect(service.exportResume).not.toHaveBeenCalled();
  });

  it.each<ResumeFieldValidationCase>([
    {
      description: 'title',
      tab: 'profile',
      elementId: 'resume-title',
      invalidValue: INVALID_SHORT_TEXT,
      expectedIssue: 'Название — Максимум 255 символов.',
    },
    {
      description: 'language',
      tab: 'profile',
      elementId: 'resume-language',
      invalidValue: '',
      expectedIssue: 'Язык резюме — Заполните поле.',
    },
    {
      description: 'profile full name',
      tab: 'profile',
      elementId: 'resume-profile-full-name',
      invalidValue: '   ',
      expectedIssue: 'Профиль / Имя — Заполните поле.',
    },
    {
      description: 'profile full name length',
      tab: 'profile',
      elementId: 'resume-profile-full-name',
      invalidValue: INVALID_SHORT_TEXT,
      expectedIssue: 'Профиль / Имя — Максимум 255 символов.',
    },
    {
      description: 'profile email',
      tab: 'profile',
      elementId: 'resume-profile-email',
      invalidValue: 'not-an-email',
      expectedIssue: 'Профиль / Email — Укажите корректный email.',
    },
    {
      description: 'profile role',
      tab: 'profile',
      elementId: 'resume-profile-role',
      invalidValue: '   ',
      expectedIssue: 'Профиль / Роль — Заполните поле.',
    },
    {
      description: 'profile role length',
      tab: 'profile',
      elementId: 'resume-profile-role',
      invalidValue: INVALID_SHORT_TEXT,
      expectedIssue: 'Профиль / Роль — Максимум 255 символов.',
    },
    {
      description: 'profile location',
      tab: 'profile',
      elementId: 'resume-profile-location',
      invalidValue: INVALID_SHORT_TEXT,
      expectedIssue: 'Профиль / Локация — Максимум 255 символов.',
    },
    {
      description: 'profile phone',
      tab: 'profile',
      elementId: 'resume-profile-phone',
      invalidValue: INVALID_SHORT_TEXT,
      expectedIssue: 'Профиль / Телефон — Максимум 255 символов.',
    },
    {
      description: 'profile website URL',
      tab: 'profile',
      elementId: 'resume-profile-website',
      invalidValue: INVALID_URL,
      expectedIssue: 'Профиль / Сайт — Укажите ссылку с http или https.',
    },
    {
      description: 'profile LinkedIn URL',
      tab: 'profile',
      elementId: 'resume-profile-linkedin',
      invalidValue: INVALID_URL,
      expectedIssue: 'Профиль / LinkedIn — Укажите ссылку с http или https.',
    },
    {
      description: 'profile GitHub URL',
      tab: 'profile',
      elementId: 'resume-profile-github',
      invalidValue: INVALID_URL,
      expectedIssue: 'Профиль / GitHub — Укажите ссылку с http или https.',
    },
    {
      description: 'profile Telegram',
      tab: 'profile',
      elementId: 'resume-profile-telegram',
      invalidValue: INVALID_SHORT_TEXT,
      expectedIssue: 'Профиль / Telegram — Максимум 255 символов.',
    },
    {
      description: 'summary text',
      tab: 'summary',
      elementId: 'resume-summary',
      invalidValue: INVALID_LONG_TEXT,
      expectedIssue: 'Саммари / Саммари — Максимум 10000 символов.',
    },
    {
      description: 'skill category',
      tab: 'skills',
      elementId: 'resume-skill-0-category',
      invalidValue: '   ',
      expectedIssue: 'Навыки / Группа навыков 1 / Категория — Заполните поле.',
    },
    {
      description: 'skill category length',
      tab: 'skills',
      elementId: 'resume-skill-0-category',
      invalidValue: INVALID_SHORT_TEXT,
      expectedIssue: 'Навыки / Группа навыков 1 / Категория — Максимум 255 символов.',
    },
    {
      description: 'skill item',
      tab: 'skills',
      elementId: 'resume-skill-0-item-0',
      invalidValue: '   ',
      expectedIssue: 'Навыки / Группа навыков 1 / Пункт 1 — Заполните поле.',
    },
    {
      description: 'skill item length',
      tab: 'skills',
      elementId: 'resume-skill-0-item-0',
      invalidValue: INVALID_SHORT_TEXT,
      expectedIssue: 'Навыки / Группа навыков 1 / Пункт 1 — Максимум 255 символов.',
    },
    {
      description: 'experience company',
      tab: 'experience',
      elementId: 'resume-experience-0-company',
      invalidValue: '   ',
      expectedIssue: 'Опыт / Компания 1 / Компания — Заполните поле.',
    },
    {
      description: 'experience company length',
      tab: 'experience',
      elementId: 'resume-experience-0-company',
      invalidValue: INVALID_SHORT_TEXT,
      expectedIssue: 'Опыт / Компания 1 / Компания — Максимум 255 символов.',
    },
    {
      description: 'experience position',
      tab: 'experience',
      elementId: 'resume-experience-0-position',
      invalidValue: '   ',
      expectedIssue: 'Опыт / Компания 1 / Позиция — Заполните поле.',
    },
    {
      description: 'experience position length',
      tab: 'experience',
      elementId: 'resume-experience-0-position',
      invalidValue: INVALID_SHORT_TEXT,
      expectedIssue: 'Опыт / Компания 1 / Позиция — Максимум 255 символов.',
    },
    {
      description: 'experience location',
      tab: 'experience',
      elementId: 'resume-experience-0-location',
      invalidValue: INVALID_SHORT_TEXT,
      expectedIssue: 'Опыт / Компания 1 / Локация — Максимум 255 символов.',
    },
    {
      description: 'experience start date',
      tab: 'experience',
      elementId: 'resume-experience-0-start-date',
      invalidValue: '',
      expectedIssue: 'Опыт / Компания 1 / Начало — Заполните поле.',
    },
    {
      description: 'experience start date length',
      tab: 'experience',
      elementId: 'resume-experience-0-start-date',
      invalidValue: INVALID_DATE_TEXT,
      expectedIssue: 'Опыт / Компания 1 / Начало — Максимум 32 символов.',
    },
    {
      description: 'experience end date',
      tab: 'experience',
      elementId: 'resume-experience-0-end-date',
      invalidValue: INVALID_DATE_TEXT,
      expectedIssue: 'Опыт / Компания 1 / Окончание — Максимум 32 символов.',
    },
    {
      description: 'experience summary',
      tab: 'experience',
      elementId: 'resume-experience-0-summary',
      invalidValue: INVALID_LONG_TEXT,
      expectedIssue: 'Опыт / Компания 1 / Саммари — Максимум 10000 символов.',
    },
    {
      description: 'experience highlight',
      tab: 'experience',
      elementId: 'resume-experience-0-highlight-0',
      invalidValue: INVALID_SHORT_TEXT,
      expectedIssue: 'Опыт / Компания 1 / Достижения / Пункт 1 — Максимум 255 символов.',
    },
    {
      description: 'experience technology',
      tab: 'experience',
      elementId: 'resume-experience-0-technology-0',
      invalidValue: INVALID_SHORT_TEXT,
      expectedIssue: 'Опыт / Компания 1 / Технологии / Пункт 1 — Максимум 255 символов.',
    },
    {
      description: 'project name',
      tab: 'experience',
      elementId: 'resume-experience-0-project-0-name',
      invalidValue: '   ',
      expectedIssue: 'Опыт / Компания 1 / Проект 1 / Проект — Заполните поле.',
    },
    {
      description: 'project name length',
      tab: 'experience',
      elementId: 'resume-experience-0-project-0-name',
      invalidValue: INVALID_SHORT_TEXT,
      expectedIssue: 'Опыт / Компания 1 / Проект 1 / Проект — Максимум 255 символов.',
    },
    {
      description: 'project role',
      tab: 'experience',
      elementId: 'resume-experience-0-project-0-role',
      invalidValue: '   ',
      expectedIssue: 'Опыт / Компания 1 / Проект 1 / Роль — Заполните поле.',
    },
    {
      description: 'project role length',
      tab: 'experience',
      elementId: 'resume-experience-0-project-0-role',
      invalidValue: INVALID_SHORT_TEXT,
      expectedIssue: 'Опыт / Компания 1 / Проект 1 / Роль — Максимум 255 символов.',
    },
    {
      description: 'project description',
      tab: 'experience',
      elementId: 'resume-experience-0-project-0-description',
      invalidValue: INVALID_LONG_TEXT,
      expectedIssue: 'Опыт / Компания 1 / Проект 1 / Описание — Максимум 10000 символов.',
    },
    {
      description: 'project highlight',
      tab: 'experience',
      elementId: 'resume-experience-0-project-0-highlight-0',
      invalidValue: INVALID_SHORT_TEXT,
      expectedIssue: 'Опыт / Компания 1 / Проект 1 / Достижения / Пункт 1 — Максимум 255 символов.',
    },
    {
      description: 'project technology',
      tab: 'experience',
      elementId: 'resume-experience-0-project-0-technology-0',
      invalidValue: INVALID_SHORT_TEXT,
      expectedIssue: 'Опыт / Компания 1 / Проект 1 / Технологии / Пункт 1 — Максимум 255 символов.',
    },
    {
      description: 'project URL',
      tab: 'experience',
      elementId: 'resume-experience-0-project-0-url',
      invalidValue: INVALID_URL,
      expectedIssue: 'Опыт / Компания 1 / Проект 1 / Ссылка — Укажите ссылку с http или https.',
    },
    {
      description: 'education institution',
      tab: 'education',
      setup: 'education',
      elementId: 'resume-education-0-institution',
      invalidValue: '   ',
      expectedIssue: 'Образование / Образование 1 / Учебное заведение — Заполните поле.',
    },
    {
      description: 'education institution length',
      tab: 'education',
      setup: 'education',
      elementId: 'resume-education-0-institution',
      invalidValue: INVALID_SHORT_TEXT,
      expectedIssue: 'Образование / Образование 1 / Учебное заведение — Максимум 255 символов.',
    },
    {
      description: 'education degree',
      tab: 'education',
      setup: 'education',
      elementId: 'resume-education-0-degree',
      invalidValue: '   ',
      expectedIssue: 'Образование / Образование 1 / Степень — Заполните поле.',
    },
    {
      description: 'education degree length',
      tab: 'education',
      setup: 'education',
      elementId: 'resume-education-0-degree',
      invalidValue: INVALID_SHORT_TEXT,
      expectedIssue: 'Образование / Образование 1 / Степень — Максимум 255 символов.',
    },
    {
      description: 'education field',
      tab: 'education',
      setup: 'education',
      elementId: 'resume-education-0-field',
      invalidValue: '   ',
      expectedIssue: 'Образование / Образование 1 / Направление — Заполните поле.',
    },
    {
      description: 'education field length',
      tab: 'education',
      setup: 'education',
      elementId: 'resume-education-0-field',
      invalidValue: INVALID_SHORT_TEXT,
      expectedIssue: 'Образование / Образование 1 / Направление — Максимум 255 символов.',
    },
    {
      description: 'education location',
      tab: 'education',
      setup: 'education',
      elementId: 'resume-education-0-location',
      invalidValue: '   ',
      expectedIssue: 'Образование / Образование 1 / Локация — Заполните поле.',
    },
    {
      description: 'education location length',
      tab: 'education',
      setup: 'education',
      elementId: 'resume-education-0-location',
      invalidValue: INVALID_SHORT_TEXT,
      expectedIssue: 'Образование / Образование 1 / Локация — Максимум 255 символов.',
    },
    {
      description: 'education start date',
      tab: 'education',
      setup: 'education',
      elementId: 'resume-education-0-start-date',
      invalidValue: '',
      expectedIssue: 'Образование / Образование 1 / Начало — Заполните поле.',
    },
    {
      description: 'education start date length',
      tab: 'education',
      setup: 'education',
      elementId: 'resume-education-0-start-date',
      invalidValue: INVALID_DATE_TEXT,
      expectedIssue: 'Образование / Образование 1 / Начало — Максимум 32 символов.',
    },
    {
      description: 'education end date',
      tab: 'education',
      setup: 'education',
      elementId: 'resume-education-0-end-date',
      invalidValue: '',
      expectedIssue: 'Образование / Образование 1 / Окончание — Заполните поле.',
    },
    {
      description: 'education end date length',
      tab: 'education',
      setup: 'education',
      elementId: 'resume-education-0-end-date',
      invalidValue: INVALID_DATE_TEXT,
      expectedIssue: 'Образование / Образование 1 / Окончание — Максимум 32 символов.',
    },
    {
      description: 'education description',
      tab: 'education',
      setup: 'education',
      elementId: 'resume-education-0-description',
      invalidValue: INVALID_LONG_TEXT,
      expectedIssue: 'Образование / Образование 1 / Описание — Максимум 10000 символов.',
    },
    {
      description: 'language name',
      tab: 'languages',
      setup: 'language',
      elementId: 'resume-language-0-name',
      invalidValue: '   ',
      expectedIssue: 'Языки / Язык 1 / Язык — Заполните поле.',
    },
    {
      description: 'language name length',
      tab: 'languages',
      setup: 'language',
      elementId: 'resume-language-0-name',
      invalidValue: INVALID_SHORT_TEXT,
      expectedIssue: 'Языки / Язык 1 / Язык — Максимум 255 символов.',
    },
    {
      description: 'language proficiency',
      tab: 'languages',
      setup: 'language',
      elementId: 'resume-language-0-proficiency',
      invalidValue: '   ',
      expectedIssue: 'Языки / Язык 1 / Уровень — Заполните поле.',
    },
    {
      description: 'language proficiency length',
      tab: 'languages',
      setup: 'language',
      elementId: 'resume-language-0-proficiency',
      invalidValue: INVALID_SHORT_TEXT,
      expectedIssue: 'Языки / Язык 1 / Уровень — Максимум 255 символов.',
    },
    {
      description: 'certification name',
      tab: 'certifications',
      setup: 'certification',
      elementId: 'resume-certification-0-name',
      invalidValue: '   ',
      expectedIssue: 'Сертификаты / Сертификат 1 / Сертификат — Заполните поле.',
    },
    {
      description: 'certification name length',
      tab: 'certifications',
      setup: 'certification',
      elementId: 'resume-certification-0-name',
      invalidValue: INVALID_SHORT_TEXT,
      expectedIssue: 'Сертификаты / Сертификат 1 / Сертификат — Максимум 255 символов.',
    },
    {
      description: 'certification issuer',
      tab: 'certifications',
      setup: 'certification',
      elementId: 'resume-certification-0-issuer',
      invalidValue: INVALID_SHORT_TEXT,
      expectedIssue: 'Сертификаты / Сертификат 1 / Организация — Максимум 255 символов.',
    },
    {
      description: 'certification issued date',
      tab: 'certifications',
      setup: 'certification',
      elementId: 'resume-certification-0-issued-on',
      invalidValue: INVALID_DATE_TEXT,
      expectedIssue: 'Сертификаты / Сертификат 1 / Выдан — Максимум 32 символов.',
    },
    {
      description: 'certification expiration date',
      tab: 'certifications',
      setup: 'certification',
      elementId: 'resume-certification-0-expires-on',
      invalidValue: INVALID_DATE_TEXT,
      expectedIssue: 'Сертификаты / Сертификат 1 / Истекает — Максимум 32 символов.',
    },
    {
      description: 'certification credential URL',
      tab: 'certifications',
      setup: 'certification',
      elementId: 'resume-certification-0-credential-url',
      invalidValue: INVALID_URL,
      expectedIssue:
        'Сертификаты / Сертификат 1 / Ссылка на сертификат — Укажите ссылку с http или https.',
    },
    {
      description: 'additional section title',
      tab: 'additional',
      setup: 'additionalSection',
      elementId: 'resume-additional-section-0-title',
      invalidValue: '   ',
      expectedIssue: 'Дополнительно / Раздел 1 / Название раздела — Заполните поле.',
    },
    {
      description: 'additional section title length',
      tab: 'additional',
      setup: 'additionalSection',
      elementId: 'resume-additional-section-0-title',
      invalidValue: INVALID_SHORT_TEXT,
      expectedIssue: 'Дополнительно / Раздел 1 / Название раздела — Максимум 255 символов.',
    },
    {
      description: 'additional item title',
      tab: 'additional',
      setup: 'additionalItem',
      elementId: 'resume-additional-section-0-item-0-title',
      invalidValue: '   ',
      expectedIssue: 'Дополнительно / Раздел 1 / Пункт 1 / Название пункта — Заполните поле.',
    },
    {
      description: 'additional item title length',
      tab: 'additional',
      setup: 'additionalItem',
      elementId: 'resume-additional-section-0-item-0-title',
      invalidValue: INVALID_SHORT_TEXT,
      expectedIssue:
        'Дополнительно / Раздел 1 / Пункт 1 / Название пункта — Максимум 255 символов.',
    },
    {
      description: 'additional item URL',
      tab: 'additional',
      setup: 'additionalItem',
      elementId: 'resume-additional-section-0-item-0-url',
      invalidValue: INVALID_URL,
      expectedIssue:
        'Дополнительно / Раздел 1 / Пункт 1 / Ссылка — Укажите ссылку с http или https.',
    },
    {
      description: 'additional item description',
      tab: 'additional',
      setup: 'additionalItem',
      elementId: 'resume-additional-section-0-item-0-description',
      invalidValue: INVALID_LONG_TEXT,
      expectedIssue: 'Дополнительно / Раздел 1 / Пункт 1 / Описание — Максимум 10000 символов.',
    },
  ])('highlights and summarizes invalid resume field: $description', (field) => {
    fixture.componentInstance.setActiveTab(field.tab);
    prepareResumeFieldValidationCase(field.setup);
    fixture.detectChanges();
    setInvalidResumeField(field.elementId, field.invalidValue);

    fixture.componentInstance.saveResume();
    fixture.detectChanges();

    expect(service.updateResume).not.toHaveBeenCalled();
    expect(elementByTestId<HTMLElement>('resume-validation-summary').textContent).toContain(
      field.expectedIssue,
    );
    expect(elementById<HTMLInputElement>(field.elementId).classList).toContain('is-invalid');
  });

  it('shows validation feedback and opens the invalid tab when save is blocked', () => {
    setElementValueById('resume-profile-email', 'not-an-email');
    fixture.componentInstance.setActiveTab('summary');
    fixture.detectChanges();

    fixture.componentInstance.saveResume();
    fixture.detectChanges();

    expect(service.updateResume).not.toHaveBeenCalled();
    expect(notifications.error).toHaveBeenCalledWith(
      'Не сохранено. Первая ошибка: Профиль / Email — Укажите корректный email.',
    );
    expect(elementById<HTMLInputElement>('resume-profile-email').classList).toContain('is-invalid');
  });

  it('shows the exact hidden-tab field that blocks resume save', () => {
    fixture.componentInstance.setActiveTab('experience');
    fixture.detectChanges();
    setElementValueById('resume-experience-0-project-0-url', 'ftp://example.com');
    fixture.componentInstance.setActiveTab('profile');
    fixture.detectChanges();

    fixture.componentInstance.saveResume();
    fixture.detectChanges();

    expect(service.updateResume).not.toHaveBeenCalled();
    expect(notifications.error).toHaveBeenCalledWith(
      'Не сохранено. Первая ошибка: Опыт / Компания 1 / Проект 1 / Ссылка — Укажите ссылку с http или https.',
    );
    expect(elementByTestId<HTMLElement>('resume-validation-summary').textContent).toContain(
      'Опыт / Компания 1 / Проект 1 / Ссылка — Укажите ссылку с http или https.',
    );
    expect(elementById<HTMLInputElement>('resume-experience-0-project-0-url').classList).toContain(
      'is-invalid',
    );
  });

  it('highlights invalid additional section links when save is blocked', () => {
    fixture.componentInstance.setActiveTab('additional');
    fixture.componentInstance.addAdditionalSection();
    fixture.detectChanges();
    setElementValueById('resume-additional-section-0-title', 'Публикации');
    setElementValueById('resume-additional-section-0-item-0-title', 'Доклад');
    setElementValueById('resume-additional-section-0-item-0-url', 'ftp://example.com');
    fixture.componentInstance.setActiveTab('profile');
    fixture.detectChanges();

    fixture.componentInstance.saveResume();
    fixture.detectChanges();

    const issue = 'Дополнительно / Раздел 1 / Пункт 1 / Ссылка — Укажите ссылку с http или https.';
    expect(service.updateResume).not.toHaveBeenCalled();
    expect(notifications.error).toHaveBeenCalledWith(`Не сохранено. Первая ошибка: ${issue}`);
    expect(elementByTestId<HTMLElement>('resume-validation-summary').textContent).toContain(issue);
    expect(
      elementById<HTMLInputElement>('resume-additional-section-0-item-0-url').classList,
    ).toContain('is-invalid');
  });

  it('shows validation feedback when export is blocked by invalid form data', () => {
    setInputValue('resume-title', '');

    buttonByLabel('Экспорт').click();
    fixture.detectChanges();
    setInputValue('resume-export-format', 'pdf');
    elementByTestId<HTMLButtonElement>('resume-export-submit').click();
    fixture.detectChanges();

    expect(service.exportResume).not.toHaveBeenCalled();
    expect(notifications.error).toHaveBeenCalledWith(
      'Не сохранено. Первая ошибка: Название — Заполните поле.',
    );
  });

  it('blocks invalid title, email, URL, and long text before saving', () => {
    setInputValue('resume-title', '   ');

    fixture.componentInstance.saveResume();

    expect(service.updateResume).not.toHaveBeenCalled();

    setInputValue('resume-title', 'Backend resume');
    setElementValueById('resume-profile-email', 'not-an-email');

    fixture.componentInstance.saveResume();

    expect(service.updateResume).not.toHaveBeenCalled();

    setElementValueById('resume-profile-email', 'candidate@example.com');
    setElementValueById('resume-profile-website', 'ftp://example.com');

    fixture.componentInstance.saveResume();

    expect(service.updateResume).not.toHaveBeenCalled();

    setElementValueById('resume-profile-website', '');
    fixture.componentInstance.setActiveTab('summary');
    fixture.detectChanges();
    setInputValue('resume-summary', 'x'.repeat(10_001));

    fixture.componentInstance.saveResume();

    expect(service.updateResume).not.toHaveBeenCalled();
  });

  it('allows resume URLs up to the backend 2048 character limit', () => {
    const urlPrefix = 'https://example.com/';
    setElementValueById(
      'resume-profile-website',
      `${urlPrefix}${'a'.repeat(2048 - urlPrefix.length)}`,
    );

    fixture.componentInstance.saveResume();

    expect(service.updateResume).toHaveBeenCalledWith(
      RESUME_ID,
      expect.objectContaining({
        content: expect.objectContaining({
          profile: expect.objectContaining({
            websiteUrl: expect.stringMatching(/^https:\/\/example\.com\/a+$/),
          }),
        }),
      }),
    );
  });

  it('deletes the resume and returns to the list', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    fixture.componentInstance.deleteResume();

    expect(service.deleteResume).toHaveBeenCalledWith(RESUME_ID);
    expect(router.navigate).toHaveBeenCalledWith(['/personal-workspace/resumes'], {
      queryParamsHandling: 'preserve',
      replaceUrl: true,
    });
  });

  it('updates payload when skill list inputs are added and removed', () => {
    fixture.componentInstance.setActiveTab('skills');
    fixture.componentInstance.addSkillGroup();
    fixture.detectChanges();
    setInputValue('resume-skill-1-category', 'Платформа');
    elementByTestId<HTMLButtonElement>('resume-skill-1-add-item').click();
    fixture.detectChanges();
    setInputValue('resume-skill-1-item-0', ' Kubernetes ');
    elementByTestId<HTMLButtonElement>('resume-skill-1-add-item').click();
    fixture.detectChanges();
    setInputValue('resume-skill-1-item-1', '  ');
    elementByTestId<HTMLButtonElement>('resume-skill-1-remove-item-1').click();
    fixture.detectChanges();
    elementByTestId<HTMLButtonElement>('resume-skill-1-add-item').click();
    fixture.detectChanges();
    setInputValue('resume-skill-1-item-1', 'PostgreSQL');

    fixture.componentInstance.removeSkillGroup(0);
    fixture.componentInstance.saveResume();

    expect(service.updateResume).toHaveBeenCalledWith(
      RESUME_ID,
      expect.objectContaining({
        content: expect.objectContaining({
          skills: [
            {
              category: 'Платформа',
              items: ['Kubernetes', 'PostgreSQL'],
            },
          ],
        }),
      }),
    );
  });

  it('blocks blank inline list items before saving', () => {
    fixture.componentInstance.setActiveTab('skills');
    fixture.detectChanges();
    setInputValue('resume-skill-0-item-0', '   ');

    fixture.componentInstance.saveResume();
    fixture.detectChanges();

    const issue = 'Навыки / Группа навыков 1 / Пункт 1 — Заполните поле.';
    expect(service.updateResume).not.toHaveBeenCalled();
    expect(notifications.error).toHaveBeenCalledWith(`Не сохранено. Первая ошибка: ${issue}`);
    expect(elementByTestId<HTMLElement>('resume-validation-summary').textContent).toContain(issue);
  });

  it('updates payload when an experience project is edited', () => {
    fixture.componentInstance.setActiveTab('experience');
    fixture.detectChanges();

    expect(elementValueById('resume-experience-0-project-0-name')).toBe('Портфолио');

    setElementValueById('resume-experience-0-project-0-name', 'Платформа');
    setElementValueById('resume-experience-0-project-0-technology-0', ' Litestar ');
    elementByTestId<HTMLButtonElement>('resume-experience-0-project-0-add-technology').click();
    fixture.detectChanges();
    setInputValue('resume-experience-0-project-0-technology-1', ' Angular ');

    fixture.componentInstance.saveResume();

    expect(service.updateResume).toHaveBeenLastCalledWith(
      RESUME_ID,
      expect.objectContaining({
        content: expect.objectContaining({
          experience: [
            expect.objectContaining({
              projects: [
                expect.objectContaining({
                  name: 'Платформа',
                  technologies: ['Litestar', 'Angular'],
                }),
              ],
            }),
          ],
        }),
      }),
    );
  });

  it('shows validation feedback when export is blocked by a hidden required resume field', () => {
    fixture.componentInstance.setActiveTab('experience');
    fixture.detectChanges();
    fixture.componentInstance.updateDate(
      fixture.componentInstance.experience.controls[0].controls.startDate,
      '',
    );
    fixture.componentInstance.setActiveTab('profile');
    fixture.detectChanges();

    buttonByLabel('Экспорт').click();
    fixture.detectChanges();
    setInputValue('resume-export-format', 'pdf');
    elementByTestId<HTMLButtonElement>('resume-export-submit').click();
    fixture.detectChanges();

    const issue = 'Опыт / Компания 1 / Начало — Заполните поле.';
    expect(service.exportResume).not.toHaveBeenCalled();
    expect(notifications.error).toHaveBeenCalledWith(`Не сохранено. Первая ошибка: ${issue}`);
    expect(elementByTestId<HTMLElement>('resume-validation-summary').textContent).toContain(issue);
    expect(fixture.componentInstance.activeTab()).toBe('experience');
  });

  it('renders unsaved list input edits in the preview', () => {
    fixture.componentInstance.setActiveTab('experience');
    fixture.detectChanges();
    setElementValueById('resume-experience-0-highlight-0', 'Новый измеримый результат');
    elementByTestId<HTMLButtonElement>('resume-experience-0-add-technology').click();
    fixture.detectChanges();
    setInputValue('resume-experience-0-technology-1', 'Angular');

    fixture.componentInstance.showPreview();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Новый измеримый результат');
    expect(fixture.nativeElement.textContent).toContain('Python, Angular');
  });

  it('renders experience projects in the preview', () => {
    fixture.componentInstance.showPreview();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Портфолио');
    expect(fixture.nativeElement.textContent).toContain('Сайт и база знаний');
  });

  it('uses localized date pickers and saves resume dates as ISO values', () => {
    fixture.componentInstance.setActiveTab('experience');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('ds-localized-date-picker').length).toBe(2);

    setElementValueById('resume-experience-0-start-date', '31.01.2024');
    setElementValueById('resume-experience-0-end-date', '01.02.2024');

    fixture.componentInstance.saveResume();

    expect(service.updateResume).toHaveBeenLastCalledWith(
      RESUME_ID,
      expect.objectContaining({
        content: expect.objectContaining({
          experience: [
            expect.objectContaining({
              startDate: '2024-01-31',
              endDate: '2024-02-01',
            }),
          ],
        }),
      }),
    );
  });

  it('saves blank optional resume text and dates as empty values with current status enum', () => {
    fixture.componentInstance.setActiveTab('summary');
    fixture.detectChanges();
    setInputValue('resume-summary', '   ');

    fixture.componentInstance.setActiveTab('experience');
    fixture.detectChanges();
    setElementValueById('resume-experience-0-end-date', '');
    setElementValueById('resume-experience-current-0', 'notSet');

    fixture.componentInstance.saveResume();

    expect(service.updateResume).toHaveBeenLastCalledWith(
      RESUME_ID,
      expect.objectContaining({
        content: expect.objectContaining({
          summary: expect.objectContaining({
            text: '',
          }),
          experience: [
            expect.objectContaining({
              endDate: null,
              currentStatus: 'notSet',
            }),
          ],
        }),
      }),
    );
  });

  it('shows an API error notification on save failure', () => {
    service.updateResume.mockReturnValue(throwError(() => apiError()));

    fixture.componentInstance.saveResume();

    expect(notifications.error).toHaveBeenCalledWith('Не удалось сохранить резюме.');
  });

  function inputValue(testId: string): string {
    const input = fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as
      HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement;
    if (input instanceof HTMLButtonElement) {
      return siteSelectValue(fixture, `[data-testid="${testId}"]`);
    }
    return input.value;
  }

  function setInputValue(testId: string, value: string): void {
    const input = fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as
      HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement;
    if (input instanceof HTMLButtonElement) {
      chooseSiteSelectOption(fixture, `[data-testid="${testId}"]`, value);
      return;
    }
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  function setElementValueById(elementId: string, value: string): void {
    const input = fixture.nativeElement.querySelector(`#${elementId}`) as
      HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement;
    if (input instanceof HTMLButtonElement) {
      chooseSiteSelectOption(fixture, `#${elementId}`, value);
      return;
    }
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    if (input.closest('ds-localized-date-picker') !== null) {
      input.dispatchEvent(new FocusEvent('blur'));
    }
    fixture.detectChanges();
  }

  function elementValueById(elementId: string): string {
    const input = fixture.nativeElement.querySelector(`#${elementId}`) as
      HTMLInputElement | HTMLTextAreaElement;
    return input.value;
  }

  function elementById<TElement extends HTMLElement>(elementId: string): TElement {
    const element = fixture.nativeElement.querySelector(`#${elementId}`) as TElement | null;
    expect(element).not.toBeNull();
    return element as TElement;
  }

  function fieldColumn(element: HTMLElement): HTMLElement {
    const column = element.closest('.col-12, .col-md-6');
    expect(column).not.toBeNull();
    return column as HTMLElement;
  }

  function buttonByLabel(label: string): HTMLButtonElement {
    const button = fixture.nativeElement.querySelector(
      `button[aria-label="${label}"]`,
    ) as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    return button as HTMLButtonElement;
  }

  function elementByTestId<TElement extends HTMLElement>(testId: string): TElement {
    const element = fixture.nativeElement.querySelector(
      `[data-testid="${testId}"]`,
    ) as TElement | null;
    expect(element).not.toBeNull();
    return element as TElement;
  }

  function prepareResumeFieldValidationCase(setup: ResumeValidationCaseSetup | undefined): void {
    switch (setup) {
      case 'education':
        fixture.componentInstance.addEducationItem();
        break;
      case 'language':
        fixture.componentInstance.addLanguageItem();
        break;
      case 'certification':
        fixture.componentInstance.addCertificationItem();
        break;
      case 'additionalSection':
        fixture.componentInstance.addAdditionalSection();
        break;
      case 'additionalItem':
        fixture.componentInstance.addAdditionalSection();
        fixture.componentInstance.addAdditionalItem(0);
        break;
      case undefined:
        break;
    }
  }

  function setInvalidResumeField(elementId: string, invalidValue: string): void {
    switch (elementId) {
      case 'resume-experience-0-start-date':
        fixture.componentInstance.updateDate(
          fixture.componentInstance.experience.controls[0].controls.startDate,
          invalidValue,
        );
        fixture.detectChanges();
        return;
      case 'resume-experience-0-end-date':
        fixture.componentInstance.updateDate(
          fixture.componentInstance.experience.controls[0].controls.endDate,
          invalidValue,
        );
        fixture.detectChanges();
        return;
      case 'resume-education-0-start-date':
        fixture.componentInstance.updateDate(
          fixture.componentInstance.education.controls[0].controls.startDate,
          invalidValue,
        );
        fixture.detectChanges();
        return;
      case 'resume-education-0-end-date':
        fixture.componentInstance.updateDate(
          fixture.componentInstance.education.controls[0].controls.endDate,
          invalidValue,
        );
        fixture.detectChanges();
        return;
      case 'resume-certification-0-issued-on':
        fixture.componentInstance.updateDate(
          fixture.componentInstance.certifications.controls[0].controls.issuedOn,
          invalidValue,
        );
        fixture.detectChanges();
        return;
      case 'resume-certification-0-expires-on':
        fixture.componentInstance.updateDate(
          fixture.componentInstance.certifications.controls[0].controls.expiresOn,
          invalidValue,
        );
        fixture.detectChanges();
        return;
      default:
        setElementValueById(elementId, invalidValue);
    }
  }

  function textNodeContent(button: HTMLButtonElement): string {
    return Array.from(button.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent?.trim() ?? '')
      .join('');
  }
});

function resume(overrides: Partial<Resume> = {}): Resume {
  return {
    id: RESUME_ID,
    title: 'Backend resume',
    language: 'ru',
    createdAt: '2026-01-01T03:04:05+00:00',
    updatedAt: '2026-01-02T03:04:05+00:00',
    content: {
      profile: {
        fullName: 'Candidate Name',
        role: 'Backend инженер',
        location: 'Москва',
        email: 'candidate@example.com',
        phone: '',
        websiteUrl: '',
        linkedinUrl: '',
        githubUrl: '',
        telegram: '',
      },
      summary: {
        text: 'Сильный backend опыт.',
      },
      skills: [
        {
          category: 'Backend',
          items: ['Python', 'SQLAlchemy'],
        },
      ],
      experience: [
        {
          company: 'Компания',
          position: 'Инженер',
          location: 'Москва',
          startDate: '2024-01-01',
          endDate: null,
          currentStatus: 'current',
          summary: 'Разрабатывал API.',
          highlights: ['Ускорил сервис'],
          technologies: ['Python'],
          projects: [
            {
              name: 'Портфолио',
              role: 'Автор',
              description: 'Сайт и база знаний',
              highlights: ['Статическая CSR SPA'],
              technologies: ['Litestar'],
              url: 'https://example.com',
            },
          ],
        },
      ],
      education: [],
      languages: [],
      certifications: [],
      additionalSections: [],
    },
    ...overrides,
  };
}

function apiError(): ApiError {
  return {
    code: 'bad_request',
    type: 'BadRequest',
    message: 'Bad request',
    location: null,
    attr: null,
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
