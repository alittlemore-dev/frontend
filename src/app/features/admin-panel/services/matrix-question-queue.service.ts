import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import { LanguageCode } from '../../../core/i18n/i18n.model';
import { AdminMatrixQuestionPayload } from '../models/matrix-question-workspace.model';
import {
  AdminMatrixItemDetailDto,
  QueuedMatrixImportPreview,
  QueuedMatrixQuestion,
  QueuedMatrixQuestionDto,
  QueuedMatrixQuestionsDto,
  mapQueuedMatrixQuestionDto,
} from '../models/matrix-question-queue.model';

@Injectable({ providedIn: 'root' })
export class MatrixQuestionQueueService {
  private readonly api = inject(ApiClient);

  listQueuedQuestions(): Observable<QueuedMatrixQuestion[]> {
    return this.api
      .get<QueuedMatrixQuestionsDto>('/api/admin/competency-matrix/queued-questions')
      .pipe(map((dto) => dto.questions.map(mapQueuedMatrixQuestionDto)));
  }

  createQueuedQuestion(question: string): Observable<QueuedMatrixQuestion> {
    return this.api
      .post<QueuedMatrixQuestionDto>('/api/admin/competency-matrix/queued-questions', {
        question,
        sheet: null,
      })
      .pipe(map(mapQueuedMatrixQuestionDto));
  }

  previewQueuedQuestions(file: File): Observable<QueuedMatrixImportPreview> {
    const formData = new FormData();
    formData.append('file', file);
    return this.api.post<QueuedMatrixImportPreview>(
      '/api/admin/competency-matrix/queued-questions/import/preview',
      formData,
    );
  }

  importQueuedQuestions(
    file: File,
    selectedRowNumbers: number[],
  ): Observable<QueuedMatrixQuestion[]> {
    const formData = new FormData();
    formData.append('file', file);
    for (const rowNumber of selectedRowNumbers) {
      formData.append('selectedRowNumbers', String(rowNumber));
    }
    return this.api
      .post<QueuedMatrixQuestionsDto>(
        '/api/admin/competency-matrix/queued-questions/import',
        formData,
      )
      .pipe(map((dto) => dto.questions.map(mapQueuedMatrixQuestionDto)));
  }

  rejectQueuedQuestion(questionId: string): Observable<void> {
    return this.api.delete<void>(`/api/admin/competency-matrix/queued-questions/${questionId}`);
  }

  createQuestionFromQueue(
    questionId: string,
    payload: AdminMatrixQuestionPayload,
    language: LanguageCode,
  ): Observable<AdminMatrixItemDetailDto> {
    return this.api.post<AdminMatrixItemDetailDto>(
      `/api/admin/competency-matrix/queued-questions/${questionId}/create-item`,
      payload,
      { language },
    );
  }
}
