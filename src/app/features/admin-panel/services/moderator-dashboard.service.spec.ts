import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MatrixQuestionQueueService } from './matrix-question-queue.service';
import { MatrixQuestionWorkspaceService } from './matrix-question-workspace.service';
import { ModeratorDashboardService } from './moderator-dashboard.service';

describe('ModeratorDashboardService', () => {
  const listQueuedQuestions = jest.fn();
  const listWorkspaceItems = jest.fn();

  beforeEach(() => {
    listQueuedQuestions
      .mockReset()
      .mockReturnValue(
        of([queuedQuestion('first'), queuedQuestion('second'), queuedQuestion('third')]),
      );
    listWorkspaceItems.mockReset().mockReturnValue(
      of({
        totalCount: 12,
        totalPages: 12,
        summary: {
          total: 12,
          draft: 7,
          missingDraft: 3,
          dangerousPublished: 2,
          readyPublished: 3,
        },
        items: [],
      }),
    );
    TestBed.configureTestingModule({
      providers: [
        ModeratorDashboardService,
        { provide: MatrixQuestionQueueService, useValue: { listQueuedQuestions } },
        { provide: MatrixQuestionWorkspaceService, useValue: { listWorkspaceItems } },
      ],
    });
  });

  it('loads queue totals independently', () => {
    let result: unknown;

    TestBed.inject(ModeratorDashboardService)
      .getQueueStats()
      .subscribe((stats) => {
        result = stats;
      });

    expect(result).toEqual({ total: 3 });
    expect(listQueuedQuestions).toHaveBeenCalledTimes(1);
    expect(listWorkspaceItems).not.toHaveBeenCalled();
  });

  it('loads matrix quality independently', () => {
    let result: unknown;

    TestBed.inject(ModeratorDashboardService)
      .getMatrixStats('ru')
      .subscribe((stats) => {
        result = stats;
      });

    expect(result).toEqual({ draft: 7, missingDraft: 3, dangerousPublished: 2 });
    expect(listQueuedQuestions).not.toHaveBeenCalled();
    expect(listWorkspaceItems).toHaveBeenCalledWith({
      page: 1,
      pageSize: 1,
      language: 'ru',
      sort: 'dangerousPublished',
    });
  });
});

function queuedQuestion(id: string): object {
  return {
    id,
    question: id,
    grade: null,
    sheet: null,
    section: null,
    subsection: null,
    suggestedByUsername: 'moderator',
    createdAt: '2026-07-31T12:00:00Z',
  };
}
