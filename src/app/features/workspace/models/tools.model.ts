export type CacheDomain = 'i18n';
export type CacheWarmStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface CacheWarmSummaryDto {
  attempted: number;
  written: number;
  skipped: number;
}

export interface CacheWarmOperationDto {
  operationId: string;
  status: CacheWarmStatus;
  queuedAt: string;
  summary: CacheWarmSummaryDto | null;
}

export interface CacheDomainStatusDto {
  domain: CacheDomain;
  keyCount: number;
  minimumRemainingTtlSeconds: number | null;
  nonExpiringKeyCount: number;
}

export interface CacheStatusDto {
  enabled: boolean;
  configuredTtlSeconds: number;
  scheduledWarmIntervalSeconds: number;
  domains: CacheDomainStatusDto[];
  lastManualWarmOperation: CacheWarmOperationDto | null;
}

export interface CacheWarmSummary {
  attempted: number;
  written: number;
  skipped: number;
}

export interface CacheWarmOperation {
  operationId: string;
  status: CacheWarmStatus;
  queuedAt: string;
  summary: CacheWarmSummary | null;
}

export interface CacheDomainStatus {
  domain: CacheDomain;
  keyCount: number;
  minimumRemainingTtlSeconds: number | null;
  nonExpiringKeyCount: number;
}

export interface CacheStatus {
  enabled: boolean;
  configuredTtlSeconds: number;
  scheduledWarmIntervalSeconds: number;
  domains: CacheDomainStatus[];
  lastManualWarmOperation: CacheWarmOperation | null;
}

export function mapCacheWarmOperationDto(dto: CacheWarmOperationDto): CacheWarmOperation {
  return {
    operationId: dto.operationId,
    status: dto.status,
    queuedAt: dto.queuedAt,
    summary:
      dto.summary === null
        ? null
        : {
            attempted: dto.summary.attempted,
            written: dto.summary.written,
            skipped: dto.summary.skipped,
          },
  };
}

export function mapCacheStatusDto(dto: CacheStatusDto): CacheStatus {
  return {
    enabled: dto.enabled,
    configuredTtlSeconds: dto.configuredTtlSeconds,
    scheduledWarmIntervalSeconds: dto.scheduledWarmIntervalSeconds,
    domains: dto.domains.map((domain) => ({
      domain: domain.domain,
      keyCount: domain.keyCount,
      minimumRemainingTtlSeconds: domain.minimumRemainingTtlSeconds,
      nonExpiringKeyCount: domain.nonExpiringKeyCount,
    })),
    lastManualWarmOperation:
      dto.lastManualWarmOperation === null
        ? null
        : mapCacheWarmOperationDto(dto.lastManualWarmOperation),
  };
}
