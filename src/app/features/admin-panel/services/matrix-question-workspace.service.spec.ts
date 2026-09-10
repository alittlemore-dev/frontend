import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiClient } from '../../../core/http/api-client.service';
import { MatrixQuestionWorkspaceService } from './matrix-question-workspace.service';

const SHEET_ID = '00000000000000000000000000000001';
const SECTION_ID = '00000000000000000000000000000002';
const SUBSECTION_ID = '00000000000000000000000000000003';
const RESOURCE_ID = '00000000000000000000000000000004';

describe('MatrixQuestionWorkspaceService', () => {
  let service: MatrixQuestionWorkspaceService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MatrixQuestionWorkspaceService,
        ApiClient,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(MatrixQuestionWorkspaceService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('serializes workspace filters with repeated array query params', () => {
    let total = 0;

    service
      .listWorkspaceItems({
        page: 2,
        pageSize: 50,
        language: 'en',
        sort: 'dangerousPublished',
        searchQuery: 'typing',
        sheetKeys: ['python', 'sql'],
        grades: ['Junior', 'Senior'],
        interviewFrequencies: ['often', 'rarely'],
        sectionIds: ['section-1'],
        subsectionIds: ['subsection-1'],
        sections: ['Core'],
        subsections: ['Syntax'],
        publishStatuses: ['Draft', 'Published'],
        publishedFrom: '2026-01-01',
        publishedTo: '2026-02-01',
        hasMissingFields: true,
      })
      .subscribe((workspace) => {
        total = workspace.summary.total;
      });

    const req = httpMock.expectOne((r) =>
      r.url.endsWith('/api/admin/competency-matrix/items/workspace'),
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('50');
    expect(req.request.params.getAll('sheetKeys')).toEqual(['python', 'sql']);
    expect(req.request.params.getAll('grades')).toEqual(['Junior', 'Senior']);
    expect(req.request.params.getAll('interviewFrequencies')).toEqual(['often', 'rarely']);
    expect(req.request.params.getAll('sectionIds')).toEqual(['section-1']);
    expect(req.request.params.getAll('subsectionIds')).toEqual(['subsection-1']);
    expect(req.request.params.get('hasMissingFields')).toBe('true');
    req.flush({
      totalCount: 1,
      totalPages: 1,
      summary: {
        total: 1,
        draft: 0,
        missingDraft: 0,
        dangerousPublished: 1,
        readyPublished: 0,
      },
      items: [
        {
          id: '1',
          slug: 'typing',
          question: 'What is typing?',
          sheetKey: 'python',
          sheet: 'Python',
          grade: 'Junior',
          interviewFrequency: 'often',
          section: 'Core',
          subsection: 'Syntax',
          publishStatus: 'Published',
          publishedAt: '2026-01-01T00:00:00+00:00',
          missingFields: ['answerEn'],
        },
      ],
    });

    expect(total).toBe(1);
  });

  it('loads filter options from the admin endpoint', () => {
    let firstSubsectionId = '';

    service.getFilterOptions('ru').subscribe((options) => {
      firstSubsectionId = options.sheets[0].sections[0].subsections[0].id;
    });

    const req = httpMock.expectOne((r) =>
      r.url.endsWith('/api/admin/competency-matrix/items/filter-options'),
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('language')).toBe('ru');
    req.flush({
      sheets: [
        {
          key: 'python',
          label: 'Питон',
          sections: [
            {
              id: 'section-1',
              label: 'Основы',
              subsections: [{ id: 'subsection-1', label: 'Синтаксис' }],
            },
          ],
        },
      ],
      grades: ['Junior'],
      interviewFrequencies: ['often'],
      sections: ['Основы'],
      subsections: ['Синтаксис'],
      publishStatuses: ['Draft', 'Published'],
    });

    expect(firstSubsectionId).toBe('subsection-1');
  });

  it('loads matrix structure from the admin endpoint', () => {
    let subsectionName = '';

    service.getStructure('en').subscribe((structure) => {
      subsectionName = structure.sheets[0].sections[0].subsections[0].name;
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/api/admin/competency-matrix/structure'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('language')).toBe('en');
    req.flush({
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
    });

    expect(subsectionName).toBe('Style');
  });

  it('loads matrix question details with a string id so large identifiers stay exact', () => {
    const id = '1152921504606846975';

    service.getQuestion(id, 'ru').subscribe();

    const req = httpMock.expectOne((r) =>
      r.url.endsWith('/api/admin/competency-matrix/items/detail/1152921504606846975'),
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('onlyPublished')).toBe('false');
    expect(req.request.params.get('language')).toBe('ru');
    req.flush({
      id,
      slug: 'large-id-question',
      question: 'Большой id?',
      answer: '',
      interviewAnswerExplanation: '',
      subsectionId: SUBSECTION_ID,
      sheetKey: 'python',
      sheet: 'Python',
      grade: 'Junior',
      interviewFrequency: 'often',
      section: 'Core',
      subsection: 'Syntax',
      publishStatus: 'Draft',
      suggestedByUsername: 'owner',
      translations: {
        ru: { question: 'Большой id?', answer: '', interviewAnswerExplanation: '' },
        en: { question: 'Large id?', answer: '', interviewAnswerExplanation: '' },
      },
      resources: [],
    });
  });

  it('creates matrix structure nodes through admin endpoints', () => {
    service
      .createSheet(
        {
          key: 'python',
          translations: { ru: { name: 'Питон' }, en: { name: 'Python' } },
        },
        'en',
      )
      .subscribe();
    const sheetReq = httpMock.expectOne((r) =>
      r.url.endsWith('/api/admin/competency-matrix/sheets'),
    );
    expect(sheetReq.request.method).toBe('POST');
    expect(sheetReq.request.params.get('language')).toBe('en');
    expect(sheetReq.request.body.key).toBe('python');
    sheetReq.flush({
      id: SHEET_ID,
      key: 'python',
      name: 'Python',
      priority: 1,
      translations: { ru: { name: 'Питон' }, en: { name: 'Python' } },
      sections: [],
    });

    service
      .createSection(
        SHEET_ID,
        {
          translations: { ru: { name: 'Основы' }, en: { name: 'Core' } },
        },
        'en',
      )
      .subscribe();
    const sectionReq = httpMock.expectOne((r) =>
      r.url.endsWith(`/api/admin/competency-matrix/sheets/${SHEET_ID}/sections`),
    );
    expect(sectionReq.request.method).toBe('POST');
    expect(sectionReq.request.params.get('language')).toBe('en');
    expect(sectionReq.request.body.translations.en.name).toBe('Core');
    sectionReq.flush({
      id: SECTION_ID,
      name: 'Core',
      priority: 1,
      translations: { ru: { name: 'Основы' }, en: { name: 'Core' } },
      subsections: [],
    });

    service
      .createSubsection(
        SECTION_ID,
        {
          translations: { ru: { name: 'Стиль' }, en: { name: 'Style' } },
        },
        'en',
      )
      .subscribe();
    const subsectionReq = httpMock.expectOne((r) =>
      r.url.endsWith(`/api/admin/competency-matrix/sections/${SECTION_ID}/subsections`),
    );
    expect(subsectionReq.request.method).toBe('POST');
    expect(subsectionReq.request.params.get('language')).toBe('en');
    expect(subsectionReq.request.body.translations.ru.name).toBe('Стиль');
    subsectionReq.flush({
      id: SUBSECTION_ID,
      name: 'Style',
      priority: 1,
      translations: { ru: { name: 'Стиль' }, en: { name: 'Style' } },
    });
  });

  it('updates matrix structure priorities through admin endpoints', () => {
    service.updateSheetPriorities([SECTION_ID, SHEET_ID]).subscribe();
    const sheetReq = httpMock.expectOne((r) =>
      r.url.endsWith('/api/admin/competency-matrix/sheets/priorities'),
    );
    expect(sheetReq.request.method).toBe('PUT');
    expect(sheetReq.request.body).toEqual({ orderedIds: [SECTION_ID, SHEET_ID] });
    sheetReq.flush(null);

    service.updateSectionPriorities(SHEET_ID, [SUBSECTION_ID, SECTION_ID]).subscribe();
    const sectionReq = httpMock.expectOne((r) =>
      r.url.endsWith(`/api/admin/competency-matrix/sheets/${SHEET_ID}/sections/priorities`),
    );
    expect(sectionReq.request.method).toBe('PUT');
    expect(sectionReq.request.body).toEqual({ orderedIds: [SUBSECTION_ID, SECTION_ID] });
    sectionReq.flush(null);

    service.updateSubsectionPriorities(SECTION_ID, [SUBSECTION_ID, RESOURCE_ID]).subscribe();
    const subsectionReq = httpMock.expectOne((r) =>
      r.url.endsWith(`/api/admin/competency-matrix/sections/${SECTION_ID}/subsections/priorities`),
    );
    expect(subsectionReq.request.method).toBe('PUT');
    expect(subsectionReq.request.body).toEqual({ orderedIds: [SUBSECTION_ID, RESOURCE_ID] });
    subsectionReq.flush(null);
  });

  it('searches resources through the admin endpoint', () => {
    let resourceName = '';

    service.searchResources('python', 10, 'en').subscribe((resources) => {
      resourceName = resources[0].translations.en.name;
    });

    const req = httpMock.expectOne((r) =>
      r.url.endsWith('/api/admin/competency-matrix/resources/search'),
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('searchName')).toBe('python');
    expect(req.request.params.get('limit')).toBe('10');
    expect(req.request.params.get('language')).toBe('en');
    req.flush({
      resources: [
        {
          id: RESOURCE_ID,
          name: 'Python docs',
          url: 'https://docs.python.org',
          translations: {
            ru: { name: 'Документация Python' },
            en: { name: 'Python docs' },
          },
        },
      ],
    });

    expect(resourceName).toBe('Python docs');
  });

  it('loads published preview data through protected matrix endpoints with edit identifiers', () => {
    let sheetCount = 0;
    let questionCount = 0;
    let questionId = '';

    service.listPreviewSheets('en').subscribe((sheets) => {
      sheetCount = sheets.length;
    });
    service.listPreviewQuestions('python', 'en').subscribe((questions) => {
      questionCount = questions.sections[0].subsections[0].grades[0].questions.length;
      questionId = questions.questionIdsBySlug['typing'];
    });

    const sheetsReq = httpMock.expectOne((r) =>
      r.url.endsWith('/api/admin/competency-matrix/sheets'),
    );
    expect(sheetsReq.request.params.get('language')).toBe('en');
    sheetsReq.flush({ sheets: [{ key: 'python', name: 'Python' }] });

    const questionsReq = httpMock.expectOne((r) =>
      r.url.endsWith('/api/admin/competency-matrix/items'),
    );
    expect(questionsReq.request.params.get('sheetKey')).toBe('python');
    expect(questionsReq.request.params.get('onlyPublished')).toBe('true');
    expect(questionsReq.request.params.get('language')).toBe('en');
    questionsReq.flush({
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
                      id: '00000000000000000000000000000007',
                      slug: 'typing',
                      question: 'What is typing?',
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

    expect(sheetCount).toBe(1);
    expect(questionCount).toBe(1);
    expect(questionId).toBe('00000000000000000000000000000007');
  });
});
