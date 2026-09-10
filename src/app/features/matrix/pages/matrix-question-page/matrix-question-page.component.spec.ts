import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, ParamMap, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { ApiError } from '../../../../core/models/api-error.model';
import { SeoService } from '../../../../core/seo/seo.service';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { MatrixQuestionDetail } from '../../models/matrix-question.model';
import { MatrixService } from '../../services/matrix.service';
import { MatrixQuestionPageComponent } from './matrix-question-page.component';

describe('MatrixQuestionPageComponent', () => {
  let fixture: ComponentFixture<MatrixQuestionPageComponent>;
  let matrixService: { getPublicQuestionBySlug: jest.Mock };
  let seoService: { setMeta: jest.Mock };
  let paramMap: BehaviorSubject<ParamMap>;
  let el: HTMLElement;

  beforeEach(async () => {
    paramMap = new BehaviorSubject(convertToParamMap({ slug: 'what-is-a-closure' }));
    matrixService = {
      getPublicQuestionBySlug: jest.fn().mockReturnValue(of(matrixQuestion())),
    };
    seoService = { setMeta: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [MatrixQuestionPageComponent],
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        { provide: MatrixService, useValue: matrixService },
        { provide: SeoService, useValue: seoService },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: paramMap.asObservable(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MatrixQuestionPageComponent);
    el = fixture.nativeElement as HTMLElement;
  });

  it('loads a published matrix question by slug and active language', () => {
    fixture.detectChanges();

    expect(matrixService.getPublicQuestionBySlug).toHaveBeenCalledWith('what-is-a-closure', 'ru');
    expect(el.textContent).toContain('Что такое замыкание?');
    expect(el.innerHTML).toContain('<strong>');
  });

  it('renders a localized back link to the matrix overview', () => {
    fixture.detectChanges();

    const link = el.querySelector<HTMLAnchorElement>('a[href="/ru/competency-matrix"]');
    expect(link?.textContent).toContain('Назад');
  });

  it('sets canonical, alternates, and FAQPage JSON-LD from visible answer content', () => {
    fixture.detectChanges();

    expect(seoService.setMeta).toHaveBeenCalledWith({
      title: 'Что такое замыкание?',
      description: 'Замыкание хранит внешнюю область видимости.',
      canonicalPath: '/ru/competency-matrix/questions/what-is-a-closure',
      alternates: [
        { language: 'ru', path: '/ru/competency-matrix/questions/what-is-a-closure' },
        { language: 'en', path: '/en/competency-matrix/questions/what-is-a-closure' },
      ],
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Что такое замыкание?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Замыкание хранит внешнюю область видимости.',
            },
          },
        ],
      },
    });
  });

  it('shows loading state while the detail request is pending', () => {
    const pending = new Subject<MatrixQuestionDetail>();
    matrixService.getPublicQuestionBySlug.mockReturnValue(pending.asObservable());

    fixture.detectChanges();

    expect(el.querySelector('app-loading-spinner')).toBeTruthy();
  });

  it('ignores stale responses after the route slug changes', () => {
    const first = new Subject<MatrixQuestionDetail>();
    const second = new Subject<MatrixQuestionDetail>();
    matrixService.getPublicQuestionBySlug
      .mockReturnValueOnce(first.asObservable())
      .mockReturnValueOnce(second.asObservable());

    fixture.detectChanges();
    paramMap.next(convertToParamMap({ slug: 'dependency-injection' }));

    first.next(matrixQuestion({ slug: 'what-is-a-closure', question: 'Stale question' }));
    second.next(
      matrixQuestion({
        slug: 'dependency-injection',
        question: 'Что такое DI?',
        answer: 'DI передаёт зависимости извне.',
      }),
    );
    fixture.detectChanges();

    expect(matrixService.getPublicQuestionBySlug).toHaveBeenNthCalledWith(
      2,
      'dependency-injection',
      'ru',
    );
    expect(el.textContent).toContain('Что такое DI?');
    expect(el.textContent).not.toContain('Stale question');
  });

  it('shows error state and noindex meta when the detail request fails', () => {
    matrixService.getPublicQuestionBySlug.mockReturnValue(throwError(() => apiError()));

    fixture.detectChanges();

    expect(el.querySelector('app-error-message')).toBeTruthy();
    expect(seoService.setMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Вопрос не найден',
        description: 'Вопрос матрицы недоступен или ещё не опубликован.',
        canonicalPath: '/ru/competency-matrix/questions/what-is-a-closure',
        robots: 'noindex, follow',
      }),
    );
  });
});

function matrixQuestion(overrides: Partial<MatrixQuestionDetail> = {}): MatrixQuestionDetail {
  const question: MatrixQuestionDetail = {
    slug: 'what-is-a-closure',
    question: 'Что такое замыкание?',
    answer: '**Замыкание** хранит внешнюю область видимости.',
    interviewAnswerExplanation: 'Лексическая область видимости.',
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
        answer: '**Замыкание** хранит внешнюю область видимости.',
        interviewAnswerExplanation: 'Лексическая область видимости.',
        sheet: 'JavaScript',
        section: 'Core',
        subsection: 'Syntax',
      },
      en: {
        question: 'What is a closure?',
        answer: 'A **closure** keeps outer scope.',
        interviewAnswerExplanation: 'Lexical scope.',
        sheet: 'JavaScript',
        section: 'Core',
        subsection: 'Syntax',
      },
    },
    resources: [],
  };
  return { ...question, ...overrides };
}

function apiError(): ApiError {
  return {
    code: 'not_found',
    type: 'not_found',
    message: 'Not found',
    location: null,
    attr: null,
  };
}
