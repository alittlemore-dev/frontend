import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatrixService } from './matrix.service';
import { ApiClient } from '../../../core/http/api-client.service';

const RESOURCE_ID = '00000000000000000000000000000001';

describe('MatrixService', () => {
  let service: MatrixService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MatrixService, ApiClient, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MatrixService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads localized public sheets from the backend matrix endpoint', () => {
    let result: { key: string; name: string }[] | undefined;

    service.getPublicSheets('en').subscribe((sheets) => {
      result = sheets;
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/api/competency-matrix/sheets'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('language')).toBe('en');
    req.flush({ sheets: [{ key: 'python', name: 'Python' }] });

    expect(result).toEqual([{ key: 'python', name: 'Python' }]);
  });

  it('loads grouped public questions with sheet key and language filters', () => {
    let resultSheet: string | undefined;
    let firstQuestion: string | undefined;
    let firstSlug: string | undefined;
    let firstFrequency: string | null | undefined;

    service.getPublicQuestions('python', 'en').subscribe((list) => {
      resultSheet = list.sheet;
      firstQuestion = list.sections[0].subsections[0].grades[0].questions[0].question;
      firstSlug = list.sections[0].subsections[0].grades[0].questions[0].slug;
      firstFrequency = list.sections[0].subsections[0].grades[0].questions[0].interviewFrequency;
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/api/competency-matrix/items'));
    expect(req.request.params.get('sheetKey')).toBe('python');
    expect(req.request.params.has('onlyPublished')).toBe(false);
    expect(req.request.params.get('language')).toBe('en');
    req.flush({
      sheetKey: 'python',
      sheet: 'Python',
      sections: [
        {
          section: 'Core',
          subsections: [
            {
              subsection: 'Syntax',
              grades: [
                {
                  grade: 'Junior',
                  items: [
                    {
                      slug: 'what-is-pep8',
                      question: 'What is PEP8?',
                      interviewFrequency: 'often',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(resultSheet).toBe('Python');
    expect(firstQuestion).toBe('What is PEP8?');
    expect(firstSlug).toBe('what-is-pep8');
    expect(firstFrequency).toBe('often');
  });

  it('loads public localized question detail by slug', () => {
    let resultSlug: string | undefined;
    let suggestedByUsername: string | undefined;

    service.getPublicQuestionBySlug('how-to-write-function', 'ru').subscribe((question) => {
      resultSlug = question.slug;
      suggestedByUsername = question.suggestedByUsername;
    });

    const req = httpMock.expectOne((r) =>
      r.url.endsWith('/api/competency-matrix/items/public/how-to-write-function'),
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('language')).toBe('ru');
    expect(req.request.params.has('onlyPublished')).toBe(false);
    req.flush(matrixDetailDto({ slug: 'how-to-write-function' }));

    expect(resultSlug).toBe('how-to-write-function');
    expect(suggestedByUsername).toBe('anon');
  });

  it('suggestQuestion posts anonymous question suggestion', () => {
    let completed = false;

    service.suggestQuestion('What is PEP 8?', 'python').subscribe(() => {
      completed = true;
    });

    const req = httpMock.expectOne((r) =>
      r.url.endsWith('/api/competency-matrix/question-suggestions'),
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ question: 'What is PEP 8?', sheet: 'python' });
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });
});

function matrixDetailDto(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    slug: 'what-is-pep8',
    question: 'What is PEP8?',
    answer: 'Answer',
    interviewAnswerExplanation: 'Answer explanation',
    sheetKey: 'python',
    sheet: 'Python',
    grade: 'Junior',
    interviewFrequency: 'often',
    section: 'Core',
    subsection: 'Style',
    publishStatus: 'Published',
    suggestedByUsername: 'anon',
    translations: {
      ru: {
        question: 'Что такое PEP8?',
        answer: 'Ответ',
        interviewAnswerExplanation: 'Объяснение ответа',
        sheet: 'Питон',
        section: 'Основы',
        subsection: 'Стиль',
      },
      en: {
        question: 'What is PEP8?',
        answer: 'Answer',
        interviewAnswerExplanation: 'Answer explanation',
        sheet: 'Python',
        section: 'Core',
        subsection: 'Style',
      },
    },
    resources: [
      {
        id: RESOURCE_ID,
        name: 'Python docs',
        url: 'https://docs.python.org',
        context: 'Read first',
        translations: {
          ru: { name: 'Документация Python', context: 'Читать сначала' },
          en: { name: 'Python docs', context: 'Read first' },
        },
      },
    ],
    ...overrides,
  };
}
