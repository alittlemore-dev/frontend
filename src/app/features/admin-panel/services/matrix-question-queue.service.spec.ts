import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiClient } from '../../../core/http/api-client.service';
import { MatrixQuestionQueueService } from './matrix-question-queue.service';

const QUESTION_ID = '00000000000000000000000000000007';
const SECOND_QUESTION_ID = '00000000000000000000000000000008';
const SUBSECTION_ID = '00000000000000000000000000000003';

describe('MatrixQuestionQueueService', () => {
  let service: MatrixQuestionQueueService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MatrixQuestionQueueService,
        ApiClient,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(MatrixQuestionQueueService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads queued questions in backend order', () => {
    let claimName: string | null | undefined;

    service.listQueuedQuestions().subscribe((questions) => {
      claimName = questions[0].claim?.agentClientName ?? null;
    });

    const req = httpMock.expectOne((r) =>
      r.url.endsWith('/api/admin/competency-matrix/queued-questions'),
    );
    expect(req.request.method).toBe('GET');
    req.flush({
      questions: [
        {
          id: '00000000000000000000000000000001',
          question: 'What is PEP 8?',
          grade: null,
          sheet: null,
          section: null,
          subsection: null,
          suggestedByUsername: 'anon',
          createdAt: '2026-06-07T12:00:00+00:00',
          claim: {
            id: 'claim-1',
            agentClientId: 'agent-1',
            agentClientName: 'desktop-codex',
            claimedAt: '2026-07-14T12:00:00+00:00',
            expiresAt: '2026-07-14T14:00:00+00:00',
          },
        },
      ],
    });

    expect(claimName).toBe('desktop-codex');
  });

  it('releases an agent claim for a queued question', () => {
    service.releaseAgentClaim(QUESTION_ID).subscribe();

    const req = httpMock.expectOne((request) =>
      request.url.endsWith(
        `/api/admin/competency-matrix/queued-questions/${QUESTION_ID}/release-agent-claim`,
      ),
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('rejects queued question', () => {
    let completed = false;

    service.rejectQueuedQuestion(QUESTION_ID).subscribe(() => {
      completed = true;
    });

    const req = httpMock.expectOne((r) =>
      r.url.endsWith(`/api/admin/competency-matrix/queued-questions/${QUESTION_ID}`),
    );
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });

  it('creates queued question manually', () => {
    let createdQuestion: string | undefined;

    service.createQueuedQuestion('What is PEP 8?').subscribe((question) => {
      createdQuestion = question.question;
    });

    const req = httpMock.expectOne((r) =>
      r.url.endsWith('/api/admin/competency-matrix/queued-questions'),
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ question: 'What is PEP 8?', sheet: null });
    req.flush({
      id: QUESTION_ID,
      question: 'What is PEP 8?',
      grade: null,
      sheet: null,
      section: null,
      subsection: null,
      suggestedByUsername: 'test',
      createdAt: '2026-06-07T12:00:00+00:00',
      claim: null,
    });

    expect(createdQuestion).toBe('What is PEP 8?');
  });

  it('previews queued questions from file upload form data', () => {
    let previewedRows: number[] | undefined;
    const file = new File(['What is PEP 8?'], 'questions.txt', { type: 'text/plain' });

    service.previewQueuedQuestions(file).subscribe((preview) => {
      previewedRows = preview.rows.map((row) => row.rowNumber);
    });

    const req = httpMock.expectOne((r) =>
      r.url.endsWith('/api/admin/competency-matrix/queued-questions/import/preview'),
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeInstanceOf(FormData);
    expect((req.request.body as FormData).get('file')).toBe(file);
    req.flush({
      rows: [
        {
          rowNumber: 1,
          question: 'What is PEP 8?',
          sheet: '',
          grade: '',
          canImport: true,
          selectedByDefault: true,
          issues: [],
        },
      ],
    });

    expect(previewedRows).toEqual([1]);
  });

  it('imports selected queued question rows from file upload form data', () => {
    let importedQuestions: string[] | undefined;
    const file = new File(['What is PEP 8?'], 'questions.txt', { type: 'text/plain' });

    service.importQueuedQuestions(file, [1, 3]).subscribe((questions) => {
      importedQuestions = questions.map((question) => question.question);
    });

    const req = httpMock.expectOne((r) =>
      r.url.endsWith('/api/admin/competency-matrix/queued-questions/import'),
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeInstanceOf(FormData);
    expect((req.request.body as FormData).get('file')).toBe(file);
    expect((req.request.body as FormData).getAll('selectedRowNumbers')).toEqual(['1', '3']);
    req.flush({
      questions: [
        {
          id: QUESTION_ID,
          question: 'What is PEP 8?',
          grade: null,
          sheet: null,
          section: null,
          subsection: null,
          suggestedByUsername: 'test',
          createdAt: '2026-06-07T12:00:00+00:00',
          claim: null,
        },
        {
          id: SECOND_QUESTION_ID,
          question: 'What is Black?',
          grade: null,
          sheet: null,
          section: null,
          subsection: null,
          suggestedByUsername: 'test',
          createdAt: '2026-06-07T12:01:00+00:00',
          claim: null,
        },
      ],
    });

    expect(importedQuestions).toEqual(['What is PEP 8?', 'What is Black?']);
  });

  it('creates matrix question from queued question', () => {
    let createdId: string | undefined;

    service
      .createQuestionFromQueue(
        QUESTION_ID,
        {
          slug: 'pep-8',
          subsectionId: SUBSECTION_ID,
          grade: null,
          interviewFrequency: null,
          publishStatus: 'Draft',
          translations: {
            ru: {
              question: 'Что такое PEP 8?',
              answer: 'Ответ',
              interviewAnswerExplanation: 'Объяснение ответа',
            },
            en: {
              question: 'What is PEP 8?',
              answer: 'Answer',
              interviewAnswerExplanation: 'Answer explanation',
            },
          },
          resources: [],
        },
        'en',
      )
      .subscribe((created) => {
        createdId = created.id;
      });

    const req = httpMock.expectOne((r) =>
      r.url.endsWith(`/api/admin/competency-matrix/queued-questions/${QUESTION_ID}/create-item`),
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.params.get('language')).toBe('en');
    expect(req.request.body.slug).toBe('pep-8');
    expect(req.request.body.subsectionId).toBe(SUBSECTION_ID);
    expect(req.request.body.grade).toBeNull();
    expect(req.request.body.interviewFrequency).toBeNull();
    expect(req.request.body.sheetKey).toBeUndefined();
    expect(req.request.body.translations.en.section).toBeUndefined();
    req.flush({ id: '10', slug: 'pep-8', question: 'What is PEP 8?' });

    expect(createdId).toBe('10');
  });
});
