import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import { LanguageCode } from '../../../core/i18n/i18n.model';
import {
  MatrixItemDetailDto,
  MatrixItemsListDto,
  MatrixQuestionDetail,
  MatrixQuestionList,
  MatrixSheet,
  MatrixSheetsDto,
  mapMatrixDetailDto,
  mapMatrixListDto,
  mapMatrixSheetDto,
} from '../models/matrix-question.model';

@Injectable({ providedIn: 'root' })
export class MatrixService {
  private readonly api = inject(ApiClient);

  getPublicSheets(language: LanguageCode): Observable<MatrixSheet[]> {
    return this.api
      .get<MatrixSheetsDto>('/api/competency-matrix/sheets', { language })
      .pipe(map((dto) => dto.sheets.map(mapMatrixSheetDto)));
  }

  getPublicQuestions(sheetKey: string, language: LanguageCode): Observable<MatrixQuestionList> {
    return this.api
      .get<MatrixItemsListDto>('/api/competency-matrix/items', {
        sheetKey,
        language,
      })
      .pipe(map(mapMatrixListDto));
  }

  getPublicQuestionBySlug(slug: string, language: LanguageCode): Observable<MatrixQuestionDetail> {
    return this.api
      .get<MatrixItemDetailDto>(`/api/competency-matrix/items/public/${slug}`, { language })
      .pipe(map(mapMatrixDetailDto));
  }

  suggestQuestion(question: string, sheet: string): Observable<void> {
    return this.api.post<void>('/api/competency-matrix/question-suggestions', {
      question,
      sheet,
    });
  }
}
