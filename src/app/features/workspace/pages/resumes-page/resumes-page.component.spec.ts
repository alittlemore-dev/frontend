import { NotificationService } from '@alittlemore.dev/design-system';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';

import { ApiError } from '../../../../core/models/api-error.model';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { chooseSiteSelectOption } from '@alittlemore.dev/design-system/testing';
import { Resume, Resumes, ResumePayload } from '../../models/resume-workspace.model';
import { ResumeWorkspaceService } from '../../services/resume-workspace.service';
import { UnsavedChangesService } from '../../../../core/unsaved-changes/unsaved-changes.service';
import { ResumesPageComponent } from './resumes-page.component';

const RESUME_ID = '00000000000000000000000000000007';

describe('ResumesPageComponent', () => {
  let fixture: ComponentFixture<ResumesPageComponent>;
  let service: {
    listResumes: jest.Mock;
    createResume: jest.Mock;
  };
  let router: Router;
  let notifications: {
    success: jest.Mock;
    error: jest.Mock;
  };
  let routeQueryParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(async () => {
    service = {
      listResumes: jest.fn().mockReturnValue(of(resumesList([resume()]))),
      createResume: jest.fn().mockReturnValue(of(resume())),
    };
    notifications = {
      success: jest.fn(),
      error: jest.fn(),
    };
    routeQueryParams = new BehaviorSubject(convertToParamMap({}));

    await TestBed.configureTestingModule({
      imports: [ResumesPageComponent],
      providers: [
        provideRouter([]),
        provideI18nTesting(),
        { provide: ResumeWorkspaceService, useValue: service },
        { provide: NotificationService, useValue: notifications },
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: routeQueryParams.asObservable() },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(ResumesPageComponent);
    fixture.detectChanges();
  });

  it('loads the resume list', () => {
    expect(service.listResumes).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
    expect(fixture.nativeElement.textContent).toContain('Backend resume');
    expect(fixture.nativeElement.textContent).toContain('EN');
    expect(fixture.nativeElement.textContent).toContain(
      formatExpectedDate(resume().updatedAt, 'ru-RU'),
    );
    expect(fixture.nativeElement.textContent).toContain(
      formatExpectedDate(resume().createdAt, 'ru-RU'),
    );
    expect(fixture.nativeElement.textContent).not.toContain(resume().updatedAt);
  });

  it('restores pagination from the URL before the first request', () => {
    fixture.destroy();
    service.listResumes.mockClear();
    service.listResumes.mockReturnValue(
      of({ ...resumesList([resume()]), totalCount: 41, totalPages: 3 }),
    );
    routeQueryParams.next(convertToParamMap({ page: '2' }));

    fixture = TestBed.createComponent(ResumesPageComponent);
    fixture.detectChanges();

    expect(service.listResumes).toHaveBeenCalledTimes(1);
    expect(service.listResumes).toHaveBeenCalledWith({ page: 2, pageSize: 20 });
  });

  it('renders resume dates in the selected language and preserves ISO values', () => {
    const timestamps = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLTimeElement>('[data-testid="resume-date"]'),
    );

    expect(timestamps).toHaveLength(2);
    expect(timestamps[0]?.dateTime).toBe(resume().updatedAt);
    expect(timestamps[0]?.textContent?.trim()).toBe(
      formatExpectedDate(resume().updatedAt, 'ru-RU'),
    );

    TestBed.inject(I18nService).switchLanguage('en').subscribe();
    fixture.detectChanges();

    expect(timestamps[0]?.textContent?.trim()).toBe(
      formatExpectedDate(resume().updatedAt, 'en-US'),
    );
  });

  it('shows an empty state', () => {
    service.listResumes.mockReturnValue(of(resumesList([])));

    fixture.componentInstance.loadResumes();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Резюме пока не созданы.');
  });

  it('opens the create dialog', () => {
    const button = fixture.nativeElement.querySelector(
      '[data-testid="resume-create-open"]',
    ) as HTMLButtonElement;

    button.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="resume-create-dialog"]')).not.toBe(
      null,
    );
  });

  it('shows live limits in the create form and flags overflow before submission', () => {
    fixture.componentInstance.openCreateDialog();
    fixture.detectChanges();

    const title = fixture.nativeElement.querySelector('#resume-create-title') as HTMLInputElement;
    const counter = fixture.nativeElement.querySelector(
      '#resume-create-title-limit',
    ) as HTMLElement;
    expect(counter.textContent).toBe('0/255');
    expect(title.hasAttribute('maxlength')).toBe(false);

    setInputValue('resume-create-title', 'x'.repeat(256));
    fixture.detectChanges();
    expect(counter.textContent).toBe('256/255');
    expect(title.classList).toContain('resume-limit-exceeded');
    expect(service.createResume).not.toHaveBeenCalled();
  });

  it('confirms closing a changed create form but not a fully reverted form', () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    fixture.componentInstance.openCreateDialog();
    fixture.detectChanges();
    setInputValue('resume-create-title', 'Draft');

    fixture.componentInstance.closeCreateDialog();

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.createDialogOpen()).toBe(true);

    setInputValue('resume-create-title', '');
    fixture.componentInstance.closeCreateDialog();

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.createDialogOpen()).toBe(false);
  });

  it('keeps failed create data unsaved and commits it after success', () => {
    const unsavedChanges = TestBed.inject(UnsavedChangesService);
    service.createResume.mockReturnValueOnce(throwError(() => apiError()));
    fixture.componentInstance.openCreateDialog();
    fixture.componentInstance.createForm.setValue({
      title: 'Target resume',
      language: 'en',
      fullName: 'Dmitriy',
      role: 'Backend engineer',
      summary: 'Summary',
    });

    fixture.componentInstance.createResume();
    expect(unsavedChanges.hasChanges()).toBe(true);

    service.createResume.mockReturnValueOnce(of(resume()));
    fixture.componentInstance.createResume();

    expect(unsavedChanges.hasChanges()).toBe(false);
  });

  it('creates a resume and navigates to detail', () => {
    fixture.componentInstance.openCreateDialog();
    fixture.detectChanges();

    setInputValue('resume-create-title', 'Target resume');
    setInputValue('resume-create-language', 'en');
    setInputValue('resume-create-full-name', 'Dmitriy');
    setInputValue('resume-create-role', 'Backend engineer');
    setInputValue('resume-create-summary', 'Summary');

    const form = fixture.nativeElement.querySelector(
      '[data-testid="resume-create-form"]',
    ) as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(service.createResume).toHaveBeenCalledWith({
      title: 'Target resume',
      language: 'en',
      content: expect.objectContaining({
        profile: expect.objectContaining({
          fullName: 'Dmitriy',
          role: 'Backend engineer',
          phone: '',
        }),
        summary: {
          text: 'Summary',
        },
        skills: [],
        experience: [],
      }),
    } satisfies ResumePayload);
    expect(notifications.success).toHaveBeenCalledWith('Резюме сохранено.');
    expect(router.navigate).toHaveBeenCalledWith(['/personal-workspace/resumes', RESUME_ID], {
      queryParamsHandling: 'preserve',
    });
  });

  it('marks required create fields and clears red border after a required value is entered', () => {
    fixture.componentInstance.openCreateDialog();
    fixture.detectChanges();

    const title = fixture.nativeElement.querySelector(
      '[data-testid="resume-create-title"]',
    ) as HTMLInputElement;
    const form = fixture.nativeElement.querySelector(
      '[data-testid="resume-create-form"]',
    ) as HTMLFormElement;

    expect(fixture.nativeElement.textContent).toContain('Название *');

    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(title.classList).toContain('is-invalid');
    expect(service.createResume).not.toHaveBeenCalled();

    title.value = 'Target resume';
    title.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(title.classList).not.toContain('is-invalid');
  });

  it('requires choosing a resume language before creation', () => {
    fixture.componentInstance.openCreateDialog();
    fixture.detectChanges();

    setInputValue('resume-create-title', 'Target resume');
    setInputValue('resume-create-full-name', 'Dmitriy');
    setInputValue('resume-create-role', 'Backend engineer');
    setInputValue('resume-create-summary', 'Summary');

    const language = fixture.nativeElement.querySelector(
      '[data-testid="resume-create-language"]',
    ) as HTMLButtonElement;
    const form = fixture.nativeElement.querySelector(
      '[data-testid="resume-create-form"]',
    ) as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(language.classList).toContain('is-invalid');
    expect(service.createResume).not.toHaveBeenCalled();
  });

  it('blocks too-long create summary before calling the service', () => {
    fixture.componentInstance.openCreateDialog();
    fixture.detectChanges();

    setInputValue('resume-create-title', 'Target resume');
    setInputValue('resume-create-language', 'en');
    setInputValue('resume-create-full-name', 'Dmitriy');
    setInputValue('resume-create-role', 'Backend engineer');
    setInputValue('resume-create-summary', 'x'.repeat(10_001));

    const form = fixture.nativeElement.querySelector(
      '[data-testid="resume-create-form"]',
    ) as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(service.createResume).not.toHaveBeenCalled();
  });

  it('shows an API error notification on create failure', () => {
    service.createResume.mockReturnValue(throwError(() => apiError()));
    fixture.componentInstance.openCreateDialog();
    fixture.detectChanges();

    setInputValue('resume-create-title', 'Target resume');
    setInputValue('resume-create-language', 'en');
    setInputValue('resume-create-full-name', 'Dmitriy');
    setInputValue('resume-create-role', 'Backend engineer');
    setInputValue('resume-create-summary', 'Summary');

    fixture.componentInstance.createResume();
    fixture.detectChanges();

    expect(notifications.error).toHaveBeenCalledWith('Не удалось сохранить резюме.');
  });

  function setInputValue(testId: string, value: string): void {
    const input = fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as
      HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement;
    if (input instanceof HTMLButtonElement) {
      chooseSiteSelectOption(fixture, `[data-testid="${testId}"]`, value);
      return;
    }
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }
});

function resumesList(resumes: Resume[]): Resumes {
  return {
    totalCount: resumes.length,
    totalPages: resumes.length > 0 ? 1 : 0,
    resumes,
  };
}

function resume(): Resume {
  return {
    id: RESUME_ID,
    title: 'Backend resume',
    language: 'en',
    createdAt: '2026-01-01T03:04:05+00:00',
    updatedAt: '2026-01-02T03:04:05+00:00',
    content: {
      profile: {
        fullName: 'Candidate Name',
        photoFileId: '',
        photoDataUrl: '',
        role: 'Engineer',
        location: '',
        email: '',
        phone: '',
        websiteUrl: '',
        linkedinUrl: '',
        githubUrl: '',
        telegram: '',
      },
      summary: {
        text: 'Short experience summary.',
      },
      skills: [],
      experience: [],
      education: [],
      languages: [],
      certifications: [],
      additionalSections: [],
    },
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

function formatExpectedDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value));
}
