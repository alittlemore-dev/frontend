import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { LanguageCode } from '../../../core/i18n/i18n.model';
import {
  ModeratorDashboardMatrixStats,
  ModeratorDashboardQueueStats,
  mapModeratorDashboardMatrixStats,
  mapModeratorDashboardQueueStats,
} from '../models/moderator-dashboard.model';
import { MatrixQuestionQueueService } from './matrix-question-queue.service';
import { MatrixQuestionWorkspaceService } from './matrix-question-workspace.service';

@Injectable({ providedIn: 'root' })
export class ModeratorDashboardService {
  private readonly queueService = inject(MatrixQuestionQueueService);
  private readonly workspaceService = inject(MatrixQuestionWorkspaceService);

  getQueueStats(): Observable<ModeratorDashboardQueueStats> {
    return this.queueService.listQueuedQuestions().pipe(map(mapModeratorDashboardQueueStats));
  }

  getMatrixStats(language: LanguageCode): Observable<ModeratorDashboardMatrixStats> {
    return this.workspaceService
      .listWorkspaceItems({
        page: 1,
        pageSize: 1,
        language,
        sort: 'dangerousPublished',
      })
      .pipe(map((workspace) => mapModeratorDashboardMatrixStats(workspace.summary)));
  }
}
