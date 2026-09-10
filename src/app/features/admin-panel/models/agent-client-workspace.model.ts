export type AgentClientStatus = 'active' | 'revoked';

export type AgentScope =
  'matrix.queue.claim' | 'matrix.context.read' | 'matrix.resources.read' | 'matrix.draft.create';

export type AgentAction =
  | 'claim_next_matrix_question'
  | 'get_matrix_authoring_context'
  | 'search_matrix_resources'
  | 'save_matrix_question_draft'
  | 'release_matrix_question_claim'
  | 'rotate_agent_certificate'
  | 'confirm_agent_certificate_rotation';

export type AgentAuditResult = 'success' | 'rejected' | 'failed';

export interface AgentCertificateDto {
  id: string;
  fingerprintSha256: string;
  serialNumber: string;
  validFrom: string;
  expiresAt: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface AgentClientDto {
  id: string;
  name: string;
  status: AgentClientStatus;
  scopes: AgentScope[];
  createdAt: string;
  revokedAt: string | null;
  certificates: AgentCertificateDto[];
}

export interface AgentClientsDto {
  clients: AgentClientDto[];
}

export interface AgentCertificate {
  id: string;
  fingerprintSha256: string;
  serialNumber: string;
  validFrom: string;
  expiresAt: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface AgentClient {
  id: string;
  name: string;
  status: AgentClientStatus;
  scopes: AgentScope[];
  createdAt: string;
  revokedAt: string | null;
  certificates: AgentCertificate[];
}

export interface AgentClientRegistrationPayload {
  name: string;
  scopes: readonly AgentScope[];
  csrPem: string;
}

export interface AgentClientRegistrationResultDto {
  client: AgentClientDto;
  certificatePem: string;
  certificateChainPem: string;
}

export interface AgentClientRegistrationResult {
  client: AgentClient;
  certificatePem: string;
  certificateChainPem: string;
}

export interface AgentAuditEventDto {
  id: string;
  agentClientId: string;
  certificateId: string;
  action: AgentAction;
  queueItemId: string | null;
  matrixItemId: string | null;
  requestId: string;
  result: AgentAuditResult;
  inputDigest: string;
  createdAt: string;
}

export interface AgentAuditCursorDto {
  createdAt: string;
  eventId: string;
}

export interface AgentAuditEventPageDto {
  events: AgentAuditEventDto[];
  nextCursor: AgentAuditCursorDto | null;
}

export interface AgentAuditEvent {
  id: string;
  agentClientId: string;
  certificateId: string;
  action: AgentAction;
  queueItemId: string | null;
  matrixItemId: string | null;
  requestId: string;
  result: AgentAuditResult;
  inputDigest: string;
  createdAt: string;
}

export interface AgentAuditCursor {
  createdAt: string;
  eventId: string;
}

export interface AgentAuditEventPage {
  events: AgentAuditEvent[];
  nextCursor: AgentAuditCursor | null;
}

export function mapAgentClientDto(dto: AgentClientDto): AgentClient {
  return {
    id: dto.id,
    name: dto.name,
    status: dto.status,
    scopes: [...dto.scopes],
    createdAt: dto.createdAt,
    revokedAt: dto.revokedAt,
    certificates: dto.certificates.map((certificate) => ({
      id: certificate.id,
      fingerprintSha256: certificate.fingerprintSha256,
      serialNumber: certificate.serialNumber,
      validFrom: certificate.validFrom,
      expiresAt: certificate.expiresAt,
      createdAt: certificate.createdAt,
      revokedAt: certificate.revokedAt,
    })),
  };
}

export function mapAgentAuditEventDto(dto: AgentAuditEventDto): AgentAuditEvent {
  return {
    id: dto.id,
    agentClientId: dto.agentClientId,
    certificateId: dto.certificateId,
    action: dto.action,
    queueItemId: dto.queueItemId,
    matrixItemId: dto.matrixItemId,
    requestId: dto.requestId,
    result: dto.result,
    inputDigest: dto.inputDigest,
    createdAt: dto.createdAt,
  };
}

export function mapAgentAuditEventPageDto(dto: AgentAuditEventPageDto): AgentAuditEventPage {
  return {
    events: dto.events.map(mapAgentAuditEventDto),
    nextCursor:
      dto.nextCursor === null
        ? null
        : {
            createdAt: dto.nextCursor.createdAt,
            eventId: dto.nextCursor.eventId,
          },
  };
}
