import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import {
  AdminMatrixQuestionWorkspace,
  AdminMatrixWorkspaceFilterOptions,
  AdminReadonlyMatrixQuestionList,
  AdminReadonlyMatrixSheet,
} from '../../models/matrix-question-workspace.model';
import { MatrixQuestionWorkspaceService } from '../../services/matrix-question-workspace.service';
import { MatrixQuestionsPageComponent } from './matrix-questions-page.component';

const SECTION_ID = '00000000000000000000000000000001';
const SUBSECTION_ID = '00000000000000000000000000000002';

describe('MatrixQuestionsPageComponent URL state', () => {
  let fixture: ComponentFixture<MatrixQuestionsPageComponent>;
  let routeQueryParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let service: jest.Mocked<MatrixQuestionWorkspaceService>;
  let router: Router;

  beforeEach(async () => {
    routeQueryParams = new BehaviorSubject(convertToParamMap({}));
    service = {
      getFilterOptions: jest.fn().mockReturnValue(of(filterOptions())),
      listWorkspaceItems: jest.fn().mockReturnValue(of(workspace(10))),
      listPreviewSheets: jest.fn().mockReturnValue(of(previewSheets())),
      listPreviewQuestions: jest.fn().mockReturnValue(of(previewQuestions())),
    } as unknown as jest.Mocked<MatrixQuestionWorkspaceService>;

    await TestBed.configureTestingModule({
      imports: [MatrixQuestionsPageComponent],
      providers: [
        provideRouter([]),
        provideI18nTesting(),
        { provide: MatrixQuestionWorkspaceService, useValue: service },
        { provide: NotificationService, useValue: { success: jest.fn(), error: jest.fn() } },
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: routeQueryParams.asObservable() },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  it('restores stable ID filters and pagination before the first workspace request', () => {
    routeQueryParams.next(
      convertToParamMap({
        q: 'typing',
        sheet: 'python',
        grade: 'Middle',
        interviewFrequency: 'often',
        sectionId: SECTION_ID,
        subsectionId: SUBSECTION_ID,
        publishStatus: 'Draft',
        hasMissingFields: 'false',
        sort: 'oldest',
        pageSize: '50',
        publishedFrom: '2026-01-01',
        publishedTo: '2026-02-01',
        page: '3',
      }),
    );

    render();

    expect(service.listWorkspaceItems).toHaveBeenCalledTimes(1);
    expect(service.listWorkspaceItems).toHaveBeenCalledWith({
      page: 3,
      pageSize: 50,
      language: 'ru',
      sort: 'oldest',
      searchQuery: 'typing',
      sheetKeys: ['python'],
      grades: ['Middle'],
      interviewFrequencies: ['often'],
      sectionIds: [SECTION_ID],
      subsectionIds: [SUBSECTION_ID],
      publishStatuses: ['Draft'],
      publishedFrom: '2026-01-01',
      publishedTo: '2026-02-01',
      hasMissingFields: false,
    });
  });

  it('canonicalizes invalid and duplicated known values while preserving merge semantics', () => {
    routeQueryParams.next(
      convertToParamMap({
        q: ['one', 'two'],
        sort: 'random',
        page: '0',
        hasMissingFields: 'sometimes',
        compatibility: 'kept',
      }),
    );

    render();

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: expect.objectContaining({
          q: null,
          sort: null,
          page: null,
          hasMissingFields: null,
        }),
        queryParamsHandling: 'merge',
        replaceUrl: true,
      }),
    );
    expect(service.listWorkspaceItems).toHaveBeenCalledTimes(1);
  });

  it('opens preview directly from a URL with explicit language and sheet', () => {
    routeQueryParams.next(
      convertToParamMap({ tab: 'preview', previewLanguage: 'en', previewSheet: 'sql' }),
    );

    render();

    expect(service.listWorkspaceItems).not.toHaveBeenCalled();
    expect(service.listPreviewSheets).toHaveBeenCalledWith('en');
    expect(service.listPreviewQuestions).toHaveBeenCalledWith('sql', 'en');
    expect(fixture.componentInstance.previewLanguage()).toBe('en');
    expect(fixture.componentInstance.selectedPreviewSheetKey()).toBe('sql');
  });

  it('canonicalizes the preview sheet to the first sheet available in preview', () => {
    service.listPreviewSheets.mockReturnValue(of([{ key: 'python', name: 'Python' }]));
    routeQueryParams.next(
      convertToParamMap({ tab: 'preview', previewLanguage: 'en', previewSheet: 'sql' }),
    );

    render();

    expect(service.listPreviewQuestions).toHaveBeenCalledTimes(1);
    expect(service.listPreviewQuestions).toHaveBeenCalledWith('python', 'en');
    expect(router.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: expect.objectContaining({ previewSheet: 'python' }),
        queryParamsHandling: 'merge',
        replaceUrl: true,
      }),
    );
    expect(fixture.componentInstance.selectedPreviewSheetKey()).toBe('python');
  });

  it('clamps an out-of-range page and reloads the closest valid page', () => {
    service.listWorkspaceItems.mockReturnValue(of(workspace(2)));
    routeQueryParams.next(convertToParamMap({ page: '9' }));

    render();

    expect(service.listWorkspaceItems.mock.calls.map(([filters]) => filters.page)).toEqual([9, 2]);
    expect(router.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: expect.objectContaining({ page: '2' }),
        queryParamsHandling: 'merge',
        replaceUrl: true,
      }),
    );
  });

  function render(): void {
    fixture = TestBed.createComponent(MatrixQuestionsPageComponent);
    fixture.detectChanges();
  }
});

function filterOptions(): AdminMatrixWorkspaceFilterOptions {
  return {
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
      { key: 'sql', label: 'SQL', sections: [] },
    ],
    grades: ['Middle'],
    interviewFrequencies: ['often'],
    sections: ['Core'],
    subsections: ['Syntax'],
    publishStatuses: ['Draft', 'Published'],
  };
}

function workspace(totalPages: number): AdminMatrixQuestionWorkspace {
  return {
    totalCount: 0,
    totalPages,
    summary: { total: 0, draft: 0, missingDraft: 0, dangerousPublished: 0, readyPublished: 0 },
    items: [],
  };
}

function previewSheets(): AdminReadonlyMatrixSheet[] {
  return [
    { key: 'python', name: 'Python' },
    { key: 'sql', name: 'SQL' },
  ];
}

function previewQuestions(): AdminReadonlyMatrixQuestionList {
  return { sheetKey: 'sql', sheet: 'SQL', sections: [], questionIdsBySlug: {} };
}
