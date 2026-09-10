import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import {
  AgentAuditCursor,
  AgentAuditEventPage,
  AgentAuditEventPageDto,
  AgentClient,
  AgentClientRegistrationPayload,
  AgentClientRegistrationResult,
  AgentClientRegistrationResultDto,
  AgentClientsDto,
  mapAgentAuditEventPageDto,
  mapAgentClientDto,
} from '../models/agent-client-workspace.model';

@Injectable({ providedIn: 'root' })
export class AgentClientWorkspaceService {
  private readonly api = inject(ApiClient);

  listClients(): Observable<AgentClient[]> {
    return this.api
      .get<AgentClientsDto>('/api/admin/agent-clients')
      .pipe(map((dto) => dto.clients.map(mapAgentClientDto)));
  }

  registerClient(
    payload: AgentClientRegistrationPayload,
  ): Observable<AgentClientRegistrationResult> {
    return this.api
      .post<AgentClientRegistrationResultDto>('/api/admin/agent-clients', payload)
      .pipe(
        map((dto) => ({
          client: mapAgentClientDto(dto.client),
          certificatePem: dto.certificatePem,
          certificateChainPem: dto.certificateChainPem,
        })),
      );
  }

  revokeClient(clientId: string): Observable<void> {
    return this.api.post<void>(`/api/admin/agent-clients/${clientId}/revoke`, {});
  }

  listAuditEvents(
    clientId: string,
    pageSize: number,
    cursor: AgentAuditCursor | null,
  ): Observable<AgentAuditEventPage> {
    const params: Record<string, string> = { pageSize: String(pageSize) };
    if (cursor !== null) {
      params['cursorCreatedAt'] = cursor.createdAt;
      params['cursorEventId'] = cursor.eventId;
    }
    return this.api
      .get<AgentAuditEventPageDto>(`/api/admin/agent-clients/${clientId}/audit`, params)
      .pipe(map(mapAgentAuditEventPageDto));
  }
}
