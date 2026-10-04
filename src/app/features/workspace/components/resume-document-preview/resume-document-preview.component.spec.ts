import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { RESUME_SECTION_KEYS, ResumePayload } from '../../models/resume-workspace.model';
import { ResumeDocumentPreviewComponent } from './resume-document-preview.component';

class TestResizeObserver implements ResizeObserver {
  static readonly instances: TestResizeObserver[] = [];
  readonly observe = jest.fn();
  readonly unobserve = jest.fn();
  readonly disconnect = jest.fn();

  constructor(private readonly callback: ResizeObserverCallback) {
    TestResizeObserver.instances.push(this);
  }

  resize(target: Element): void {
    this.callback(
      [{ target, contentRect: target.getBoundingClientRect() } as ResizeObserverEntry],
      this,
    );
  }
}

const payload: ResumePayload = {
  title: 'Resume',
  language: 'ru',
  content: {
    settings: { dateFormat: 'monthYearNumeric', sectionOrder: [], hiddenSections: [] },
    profile: {
      fullName: 'Candidate',
      role: 'Engineer',
      location: 'Yerevan',
      email: 'candidate@example.com',
      phone: '',
      websiteUrl: '',
      linkedinUrl: '',
      githubUrl: '',
      telegram: '',
      photoFileId: '',
      photoDataUrl: 'data:image/jpeg;base64,dGVzdA==',
    },
    summary: { text: 'Line one\nLine two' },
    skills: [],
    experience: [
      {
        company: 'Company',
        companyWebsiteUrl: '',
        position: 'Engineer',
        location: '',
        startDate: '2024-08-19',
        endDate: null,
        currentStatus: 'current',
        summary: '',
        highlights: ['Result'],
        technologies: [],
        projects: [
          {
            name: 'Project',
            role: '',
            teamSize: '',
            scale: '',
            description: 'Project description',
            highlights: [],
            technologies: [],
            url: '',
          },
        ],
      },
    ],
    education: [
      {
        institution: 'University',
        degree: '',
        field: '',
        location: '',
        startDate: null,
        endDate: null,
        description: '',
      },
    ],
    languages: [{ name: 'English', proficiency: 'C1' }],
    certifications: [],
    additionalSections: [],
  },
};

describe('ResumeDocumentPreviewComponent', () => {
  let fixture: ComponentFixture<ResumeDocumentPreviewComponent>;
  let originalObserver: PropertyDescriptor | undefined;
  beforeEach(() => {
    TestResizeObserver.instances.length = 0;
    originalObserver = Object.getOwnPropertyDescriptor(window, 'ResizeObserver');
    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      value: TestResizeObserver,
    });
    TestBed.configureTestingModule({
      imports: [ResumeDocumentPreviewComponent],
      providers: [provideI18nTesting()],
    });
    fixture = TestBed.createComponent(ResumeDocumentPreviewComponent);
    fixture.componentRef.setInput('payload', payload);
    fixture.componentRef.setInput('theme', 'simple');
    fixture.componentRef.setInput('format', 'pdf');
    fixture.detectChanges();
  });

  afterEach(() => {
    if (originalObserver) Object.defineProperty(window, 'ResizeObserver', originalObserver);
    else Reflect.deleteProperty(window, 'ResizeObserver');
    jest.restoreAllMocks();
  });

  function measurePaper(height: number, scale = 1): HTMLElement {
    const paper = fixture.nativeElement.querySelector(
      '[data-testid="resume-preview"]',
    ) as HTMLElement;
    const width = fixture.componentInstance.paperWidth();
    paper.style.width = `${width}px`;
    paper.style.paddingTop = '50px';
    paper.style.paddingBottom = '50px';
    jest.spyOn(paper, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: height * scale,
      right: width * scale,
      width: width * scale,
      height: height * scale,
      toJSON: () => ({}),
    });
    return paper;
  }

  it('matches the theme section order and inherits an empty project role', () => {
    const headings = (): string[] =>
      Array.from(fixture.nativeElement.querySelectorAll('h3') as NodeListOf<HTMLElement>).map(
        (heading) => heading.textContent?.trim() ?? '',
      );
    expect(headings()).toEqual(['Профессиональный профиль', 'Опыт работы', 'Образование', 'Языки']);
    expect(fixture.nativeElement.textContent).toContain('Проект: Project | Engineer');
    fixture.componentRef.setInput('theme', 'accent');
    fixture.detectChanges();
    expect(headings()).toEqual([
      'Контактные данные',
      'Профессиональный профиль',
      'Образование',
      'Опыт работы',
    ]);
    expect(fixture.nativeElement.textContent).toContain('Проект: Project');
    expect(fixture.nativeElement.textContent).not.toContain('Проект: Project | Engineer');
    expect(fixture.nativeElement.textContent).toContain('08.2024 - настоящее время');
  });

  it('uses format-specific photo placement and offers fit-width or actual-size viewing', () => {
    const paper = (): HTMLElement =>
      fixture.nativeElement.querySelector('[data-testid="resume-preview"]');
    expect(paper().children[0].tagName).toBe('IMG');
    expect(fixture.nativeElement.textContent).toContain('PDF · A4');
    fixture.componentRef.setInput('format', 'docx');
    fixture.detectChanges();
    expect(paper().children[0].textContent).toBe('Candidate');
    expect(paper().children[1].tagName).toBe('IMG');
    expect(fixture.nativeElement.textContent).toContain('DOCX · Letter');
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('aria-pressed')).toBe('true');
    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.textContent).toContain('По ширине');
  });

  it.each(['simple', 'accent'])(
    'uses custom section order and visibility for %s without mutating content',
    (theme) => {
      const custom: ResumePayload = {
        ...payload,
        content: {
          ...payload.content,
          settings: { ...payload.content.settings, sectionOrder: [], hiddenSections: [] },
        },
      };
      custom.content.settings.sectionOrder = [
        'experience',
        ...RESUME_SECTION_KEYS.filter((key) => key !== 'experience'),
      ];
      custom.content.settings.hiddenSections = ['education', 'summary'];
      fixture.componentRef.setInput('payload', custom);
      fixture.componentRef.setInput('theme', theme);
      fixture.detectChanges();
      const paper = fixture.nativeElement.querySelector(
        '[data-testid="resume-preview"]',
      ) as HTMLElement;
      expect(paper.textContent).toContain('Company');
      expect(paper.textContent).not.toContain('University');
      expect(paper.textContent).not.toContain('Line one');
      expect(paper.querySelectorAll('h3')[theme === 'accent' ? 1 : 0].textContent).toBe(
        'Опыт работы',
      );
      expect(custom.content.education).toHaveLength(1);
      expect(custom.content.summary.text).toContain('Line one');
    },
  );

  it('hides the Accent imported education fallback when its source section is hidden', () => {
    const custom: ResumePayload = {
      ...payload,
      content: {
        ...payload.content,
        settings: { ...payload.content.settings, sectionOrder: [], hiddenSections: [] },
      },
    };
    custom.content.education = [];
    custom.content.additionalSections = [
      { title: 'Образование', items: [{ title: 'Imported University', description: '', url: '' }] },
    ];
    fixture.componentRef.setInput('payload', custom);
    fixture.componentRef.setInput('theme', 'accent');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Imported University');
    fixture.componentRef.setInput('payload', {
      ...custom,
      content: {
        ...custom.content,
        settings: { ...custom.content.settings, hiddenSections: ['additionalSections'] },
      },
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Imported University');
  });

  it('renders empty sections and multilingual text safely without editor placeholders', () => {
    fixture.componentRef.setInput('payload', {
      ...payload,
      content: {
        ...payload.content,
        summary: { text: '<script>alert(1)</script>\nSecond line' },
        education: [],
        experience: [],
        languages: [],
        profile: { ...payload.content.profile, photoDataUrl: '' },
      },
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('script')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('<script>alert(1)</script>');
    expect(fixture.nativeElement.querySelectorAll('h3')).toHaveLength(1);
    expect(fixture.nativeElement.textContent).not.toContain('Добавьте');
  });

  it('measures the rendered paper independently of fit-width zoom and updates on resize', () => {
    const estimate = jest.fn();
    fixture.componentInstance.estimatedPageCount.subscribe(estimate);
    const pageHeight = (297 * 96) / 25.4;
    const paper = measurePaper((pageHeight - 100) * 3.2 + 100, 0.4);
    TestResizeObserver.instances[0].resize(paper);
    expect(estimate).toHaveBeenLastCalledWith(4);
    measurePaper(pageHeight, 0.4);
    TestResizeObserver.instances[0].resize(paper);
    expect(estimate).toHaveBeenLastCalledWith(1);
    fixture.destroy();
    expect(TestResizeObserver.instances[0].disconnect).toHaveBeenCalled();
  });

  it('invalidates a previous measurement before measuring changed content or theme', () => {
    const estimate = jest.fn();
    fixture.componentInstance.estimatedPageCount.subscribe(estimate);
    const paper = measurePaper(3500);
    TestResizeObserver.instances[0].resize(paper);
    expect(estimate).toHaveBeenLastCalledWith(4);
    measurePaper(0);
    fixture.componentRef.setInput('payload', { ...payload, title: 'Updated resume' });
    fixture.detectChanges();
    expect(estimate).toHaveBeenLastCalledWith(null);
    measurePaper((742 * 96) / 72 + 100);
    fixture.componentRef.setInput('theme', 'accent');
    fixture.detectChanges();
    expect(estimate.mock.calls.slice(-2)).toEqual([[null], [1]]);
  });

  it('uses the selected format page height instead of a PDF estimate for Word', () => {
    const estimate = jest.fn();
    fixture.componentInstance.estimatedPageCount.subscribe(estimate);
    fixture.componentRef.setInput('format', 'docx');
    const paper = measurePaper((11 * 96 - 100) * 2.8 + 100);
    fixture.detectChanges();
    expect(estimate.mock.calls.slice(-2)).toEqual([[null], [3]]);
    measurePaper((11 * 96 - 100) * 3.2 + 100);
    TestResizeObserver.instances[0].resize(paper);
    expect(estimate).toHaveBeenLastCalledWith(4);
  });
});
