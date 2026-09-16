import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiClient, QueryParams } from '../../../../../core/http/api-client.service';
import { KnowledgeFile } from '../../shared/knowledge-file.model';
import {
  KnowledgeDateCreatePayload,
  KnowledgeDateDetail,
  KnowledgeDateListFilters,
  KnowledgeDatesPage,
  KnowledgeDateUpdatePayload,
} from '../models/dates.model';

@Injectable({ providedIn: 'root' })
export class KnowledgeDatesService {
  private readonly api = inject(ApiClient);

  listDates(filters: KnowledgeDateListFilters): Observable<KnowledgeDatesPage> {
    const params: QueryParams = {
      page: String(filters.page),
      pageSize: String(filters.pageSize),
      sort: filters.sort,
    };
    if (filters.searchQuery.trim() !== '') {
      params['searchQuery'] = filters.searchQuery.trim();
    }
    if (filters.tagIds.length > 0) {
      params['tagIds'] = filters.tagIds;
    }
    if (filters.relatedPersonId !== '') {
      params['relatedPersonId'] = filters.relatedPersonId;
    }
    return this.api
      .get<KnowledgeDatesPage>('/api/personal-workspace/knowledge/dates', params)
      .pipe(map((page) => mapPage(page)));
  }

  createDate(payload: KnowledgeDateCreatePayload): Observable<KnowledgeDateDetail> {
    return this.api
      .post<KnowledgeDateDetail>('/api/personal-workspace/knowledge/dates', payload)
      .pipe(map((value) => mapDetail(value)));
  }

  getDate(dateId: string): Observable<KnowledgeDateDetail> {
    return this.api
      .get<KnowledgeDateDetail>(`/api/personal-workspace/knowledge/dates/${dateId}`)
      .pipe(map((value) => mapDetail(value)));
  }

  updateDate(dateId: string, payload: KnowledgeDateUpdatePayload): Observable<KnowledgeDateDetail> {
    return this.api
      .put<KnowledgeDateDetail>(`/api/personal-workspace/knowledge/dates/${dateId}`, payload)
      .pipe(map((value) => mapDetail(value)));
  }

  deleteDate(dateId: string): Observable<void> {
    return this.api.delete<void>(`/api/personal-workspace/knowledge/dates/${dateId}`);
  }

  uploadAttachment(itemId: string, file: File, name: string): Observable<KnowledgeFile> {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('file', file);
    return this.api.post<KnowledgeFile>(
      `/api/personal-workspace/knowledge/items/${itemId}/attachments`,
      formData,
    );
  }

  renameAttachment(itemId: string, fileId: string, name: string): Observable<KnowledgeFile> {
    return this.api.put<KnowledgeFile>(
      `/api/personal-workspace/knowledge/items/${itemId}/attachments/${fileId}`,
      {
        name,
      },
    );
  }

  deleteAttachment(itemId: string, fileId: string): Observable<void> {
    return this.api.delete<void>(
      `/api/personal-workspace/knowledge/items/${itemId}/attachments/${fileId}`,
    );
  }

  getFileContent(fileId: string): Observable<Blob> {
    return this.api.getBlob(`/api/personal-workspace/knowledge/files/${fileId}/content`);
  }
}

function mapPage(page: KnowledgeDatesPage): KnowledgeDatesPage {
  return {
    totalCount: page.totalCount,
    totalPages: page.totalPages,
    dates: page.dates.map((value) => ({
      ...value,
      date: { ...value.date },
      relatedPeople: value.relatedPeople.map((person) => ({ ...person })),
      tags: value.tags.map((tag) => ({ ...tag })),
    })),
  };
}

function mapDetail(value: KnowledgeDateDetail): KnowledgeDateDetail {
  return {
    ...value,
    date: { ...value.date },
    relatedPeople: value.relatedPeople.map((person) => ({ ...person })),
    tags: value.tags.map((tag) => ({ ...tag })),
    attachments: value.attachments.map((file) => ({ ...file })),
  };
}
