import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import {
  Resume,
  ResumeDto,
  ResumeExportFormat,
  ResumeListParams,
  ResumePayload,
  Resumes,
  ResumesDto,
  mapResumeDto,
  mapResumesDto,
  toResumeExportPayloadDto,
  toResumePayloadDto,
} from '../models/resume-workspace.model';

@Injectable({ providedIn: 'root' })
export class ResumeWorkspaceService {
  private readonly api = inject(ApiClient);

  listResumes(params: ResumeListParams): Observable<Resumes> {
    return this.api
      .get<ResumesDto>('/api/personal-workspace/resumes', {
        page: String(params.page),
        pageSize: String(params.pageSize),
      })
      .pipe(map(mapResumesDto));
  }

  getResume(id: string): Observable<Resume> {
    return this.api.get<ResumeDto>(`/api/personal-workspace/resumes/${id}`).pipe(map(mapResumeDto));
  }

  createResume(payload: ResumePayload): Observable<Resume> {
    return this.api
      .post<ResumeDto>('/api/personal-workspace/resumes', toResumePayloadDto(payload))
      .pipe(map(mapResumeDto));
  }

  updateResume(id: string, payload: ResumePayload): Observable<Resume> {
    return this.api
      .put<ResumeDto>(`/api/personal-workspace/resumes/${id}`, toResumePayloadDto(payload))
      .pipe(map(mapResumeDto));
  }

  deleteResume(id: string): Observable<void> {
    return this.api.delete<void>(`/api/personal-workspace/resumes/${id}`);
  }

  exportResume(id: string, format: ResumeExportFormat, payload: ResumePayload): Observable<Blob> {
    return this.api.postBlob(
      `/api/personal-workspace/resumes/${id}/export`,
      toResumeExportPayloadDto(payload, format),
    );
  }
}
