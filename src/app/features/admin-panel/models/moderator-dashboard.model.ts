import { QueuedMatrixQuestion } from './matrix-question-queue.model';
import { AdminMatrixWorkspaceSummary } from './matrix-question-workspace.model';

export interface ModeratorDashboardQueueStats {
  total: number;
  available: number;
  claimed: number;
}

export interface ModeratorDashboardMatrixStats {
  draft: number;
  missingDraft: number;
  dangerousPublished: number;
}

export function mapModeratorDashboardQueueStats(
  questions: readonly QueuedMatrixQuestion[],
): ModeratorDashboardQueueStats {
  const available = questions.filter((question) => question.claim === null).length;
  return {
    total: questions.length,
    available,
    claimed: questions.length - available,
  };
}

export function mapModeratorDashboardMatrixStats(
  summary: AdminMatrixWorkspaceSummary,
): ModeratorDashboardMatrixStats {
  return {
    draft: summary.draft,
    missingDraft: summary.missingDraft,
    dangerousPublished: summary.dangerousPublished,
  };
}
