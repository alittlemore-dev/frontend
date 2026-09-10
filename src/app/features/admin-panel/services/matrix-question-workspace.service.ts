import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiClient, QueryParams } from '../../../core/http/api-client.service';
import { LanguageCode } from '../../../core/i18n/i18n.model';
import {
  AdminMatrixQuestionDetailDto,
  AdminMatrixQuestionPayload,
  AdminMatrixQuestionWorkspace,
  AdminMatrixQuestionWorkspaceFilters,
  AdminMatrixResource,
  AdminMatrixResourcesDto,
  AdminMatrixSectionCreatePayload,
  AdminMatrixSheetCreatePayload,
  AdminMatrixStructure,
  AdminMatrixStructureSection,
  AdminMatrixStructureSheet,
  AdminMatrixStructureSubsection,
  AdminMatrixSubsectionCreatePayload,
  AdminMatrixWorkspaceDto,
  AdminMatrixWorkspaceFilterOptions,
  AdminMatrixWorkspaceFilterOptionsDto,
  MatrixItemsListDto,
  MatrixSheetsDto,
  mapPreviewQuestionsDto,
  mapPreviewSheetsDto,
  AdminReadonlyMatrixQuestionList,
  AdminReadonlyMatrixSheet,
} from '../models/matrix-question-workspace.model';

@Injectable({ providedIn: 'root' })
export class MatrixQuestionWorkspaceService {
  private readonly api = inject(ApiClient);

  listWorkspaceItems(
    filters: AdminMatrixQuestionWorkspaceFilters,
  ): Observable<AdminMatrixQuestionWorkspace> {
    return this.api
      .get<AdminMatrixWorkspaceDto>(
        '/api/admin/competency-matrix/items/workspace',
        workspaceQueryParams(filters),
      )
      .pipe(map((dto) => dto));
  }

  getFilterOptions(language: LanguageCode): Observable<AdminMatrixWorkspaceFilterOptions> {
    return this.api
      .get<AdminMatrixWorkspaceFilterOptionsDto>(
        '/api/admin/competency-matrix/items/filter-options',
        { language },
      )
      .pipe(map((dto) => dto));
  }

  getStructure(language: LanguageCode): Observable<AdminMatrixStructure> {
    return this.api.get<AdminMatrixStructure>('/api/admin/competency-matrix/structure', {
      language,
    });
  }

  createSheet(
    payload: AdminMatrixSheetCreatePayload,
    language: LanguageCode,
  ): Observable<AdminMatrixStructureSheet> {
    return this.api.post<AdminMatrixStructureSheet>(
      '/api/admin/competency-matrix/sheets',
      payload,
      { language },
    );
  }

  createSection(
    sheetId: string,
    payload: AdminMatrixSectionCreatePayload,
    language: LanguageCode,
  ): Observable<AdminMatrixStructureSection> {
    return this.api.post<AdminMatrixStructureSection>(
      `/api/admin/competency-matrix/sheets/${sheetId}/sections`,
      payload,
      { language },
    );
  }

  createSubsection(
    sectionId: string,
    payload: AdminMatrixSubsectionCreatePayload,
    language: LanguageCode,
  ): Observable<AdminMatrixStructureSubsection> {
    return this.api.post<AdminMatrixStructureSubsection>(
      `/api/admin/competency-matrix/sections/${sectionId}/subsections`,
      payload,
      { language },
    );
  }

  updateSheetPriorities(orderedIds: readonly string[]): Observable<void> {
    return this.api.put<void>('/api/admin/competency-matrix/sheets/priorities', {
      orderedIds,
    });
  }

  updateSectionPriorities(sheetId: string, orderedIds: readonly string[]): Observable<void> {
    return this.api.put<void>(
      `/api/admin/competency-matrix/sheets/${sheetId}/sections/priorities`,
      { orderedIds },
    );
  }

  updateSubsectionPriorities(sectionId: string, orderedIds: readonly string[]): Observable<void> {
    return this.api.put<void>(
      `/api/admin/competency-matrix/sections/${sectionId}/subsections/priorities`,
      { orderedIds },
    );
  }

  listPreviewSheets(language: LanguageCode): Observable<AdminReadonlyMatrixSheet[]> {
    return this.api
      .get<MatrixSheetsDto>('/api/admin/competency-matrix/sheets', { language })
      .pipe(map(mapPreviewSheetsDto));
  }

  listPreviewQuestions(
    sheetKey: string,
    language: LanguageCode,
  ): Observable<AdminReadonlyMatrixQuestionList> {
    return this.api
      .get<MatrixItemsListDto>('/api/admin/competency-matrix/items', {
        sheetKey,
        onlyPublished: 'true',
        language,
      })
      .pipe(map(mapPreviewQuestionsDto));
  }

  getQuestion(id: string, language: LanguageCode): Observable<AdminMatrixQuestionDetailDto> {
    return this.api.get<AdminMatrixQuestionDetailDto>(
      `/api/admin/competency-matrix/items/detail/${id}`,
      {
        onlyPublished: 'false',
        language,
      },
    );
  }

  createQuestion(
    payload: AdminMatrixQuestionPayload,
    language: LanguageCode,
  ): Observable<AdminMatrixQuestionDetailDto> {
    return this.api.post<AdminMatrixQuestionDetailDto>(
      '/api/admin/competency-matrix/items',
      payload,
      { language },
    );
  }

  updateQuestion(
    id: string,
    payload: AdminMatrixQuestionPayload,
    language: LanguageCode,
  ): Observable<AdminMatrixQuestionDetailDto> {
    return this.api.put<AdminMatrixQuestionDetailDto>(
      `/api/admin/competency-matrix/items/detail/${id}`,
      payload,
      { language },
    );
  }

  publishQuestion(id: string): Observable<void> {
    return this.api.post<void>(`/api/admin/competency-matrix/items/detail/${id}/set-published`, {});
  }

  unpublishQuestion(id: string): Observable<void> {
    return this.api.post<void>(`/api/admin/competency-matrix/items/detail/${id}/set-draft`, {});
  }

  deleteQuestion(id: string): Observable<void> {
    return this.api.delete<void>(`/api/admin/competency-matrix/items/detail/${id}`);
  }

  searchResources(
    searchName: string,
    limit: number,
    language: LanguageCode,
  ): Observable<AdminMatrixResource[]> {
    return this.api
      .get<AdminMatrixResourcesDto>('/api/admin/competency-matrix/resources/search', {
        searchName,
        limit: String(limit),
        language,
      })
      .pipe(map((dto) => dto.resources));
  }
}

function workspaceQueryParams(filters: AdminMatrixQuestionWorkspaceFilters): QueryParams {
  const params: Record<string, string | readonly string[]> = {
    page: String(filters.page),
    pageSize: String(filters.pageSize),
    language: filters.language,
    sort: filters.sort,
  };
  setOptionalString(params, 'searchQuery', filters.searchQuery);
  setOptionalArray(params, 'sheetKeys', filters.sheetKeys);
  setOptionalArray(params, 'grades', filters.grades);
  setOptionalArray(params, 'interviewFrequencies', filters.interviewFrequencies);
  setOptionalArray(params, 'sectionIds', filters.sectionIds);
  setOptionalArray(params, 'subsectionIds', filters.subsectionIds);
  setOptionalArray(params, 'sections', filters.sections);
  setOptionalArray(params, 'subsections', filters.subsections);
  setOptionalArray(params, 'publishStatuses', filters.publishStatuses);
  setOptionalString(params, 'publishedFrom', filters.publishedFrom);
  setOptionalString(params, 'publishedTo', filters.publishedTo);
  if (filters.hasMissingFields !== undefined) {
    params['hasMissingFields'] = String(filters.hasMissingFields);
  }
  return params;
}

function setOptionalString(
  params: Record<string, string | readonly string[]>,
  key: string,
  value: string | undefined,
): void {
  const normalized = value?.trim();
  if (normalized) {
    params[key] = normalized;
  }
}

function setOptionalArray(
  params: Record<string, string | readonly string[]>,
  key: string,
  value: readonly string[] | undefined,
): void {
  if (value !== undefined && value.length > 0) {
    params[key] = value;
  }
}
