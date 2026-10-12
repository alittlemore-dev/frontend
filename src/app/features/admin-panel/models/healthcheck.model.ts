export type HealthcheckStatus =
  'healthy' | 'initializing' | 'degraded' | 'stale' | 'failed' | 'unavailable';

export interface HealthcheckSystemSummary {
  id: string;
  kind: string;
  status: HealthcheckStatus;
  observedAt: string | null;
}

export interface HealthcheckOverview {
  checkedAt: string;
  systems: readonly HealthcheckSystem[];
}

export interface SafeHealthcheckError {
  code: string;
  sourceId: string | null;
  destinationId: string | null;
}

export interface RetainedBackupSet {
  runId: string;
  completedAt: string;
  roles: readonly ('latest' | 'weekly_current' | 'weekly_previous')[];
  totalBytes: number;
}

export interface BackupDestination {
  id: string;
  required: boolean;
  lastSuccessAt: string | null;
  pendingCount: number;
  deliveryGapCount: number;
  lastError: SafeHealthcheckError | null;
  cleanupError: SafeHealthcheckError | null;
  retainedSets: readonly RetainedBackupSet[];
}

export interface BackupDetails {
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  nextDueAt: string | null;
  freshnessThresholdSeconds: number;
  runState: 'initializing' | 'idle' | 'running' | 'failed';
  currentRun: { id: string; phase: string; startedAt: string | null } | null;
  lastError: SafeHealthcheckError | null;
  lastRestoreVerifiedAt: string | null;
  destinations: readonly BackupDestination[];
}

export interface BackupHealthcheckSystem extends HealthcheckSystemSummary {
  kind: 'backups';
  backup: BackupDetails | null;
}

export type HealthcheckSystem = BackupHealthcheckSystem;

const statuses: readonly string[] = [
  'healthy',
  'initializing',
  'degraded',
  'stale',
  'failed',
  'unavailable',
];

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Invalid healthcheck response');
  }
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128) {
    throw new Error('Invalid healthcheck response');
  }
  return value;
}

function timestamp(value: unknown, nullable = true): string | null {
  if (value === null && nullable) return null;
  const result = text(value);
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(result) || !Number.isFinite(Date.parse(result))) {
    throw new Error('Invalid healthcheck timestamp');
  }
  return result;
}

function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error('Invalid healthcheck number');
  }
  return value;
}

function list(value: unknown): readonly unknown[] {
  if (!Array.isArray(value) || value.length > 64) throw new Error('Invalid healthcheck list');
  return value as readonly unknown[];
}

function error(value: unknown): SafeHealthcheckError | null {
  if (value === null) return null;
  const data = object(value);
  return {
    code: text(data['code']),
    sourceId: data['source_id'] === undefined ? null : text(data['source_id']),
    destinationId: data['destination_id'] === undefined ? null : text(data['destination_id']),
  };
}

function retainedSet(value: unknown): RetainedBackupSet {
  const data = object(value);
  const roles = list(data['roles']).map((role) => {
    if (role !== 'latest' && role !== 'weekly_current' && role !== 'weekly_previous') {
      throw new Error('Invalid checkpoint role');
    }
    return role;
  });
  if (data['complete'] !== true || roles.length === 0 || new Set(roles).size !== roles.length) {
    throw new Error('Incomplete backup set');
  }
  return {
    runId: text(data['run_id']),
    completedAt: timestamp(data['completed_at'], false)!,
    totalBytes: number(data['total_bytes']),
    roles,
  };
}

function destination(value: unknown): BackupDestination {
  const data = object(value);
  if (typeof data['required'] !== 'boolean') throw new Error('Invalid backup destination');
  const retainedSets = list(data['retained_sets']).map(retainedSet);
  if (
    retainedSets.length > 3 ||
    new Set(retainedSets.map((set) => set.runId)).size !== retainedSets.length
  ) {
    throw new Error('Invalid retained sets');
  }
  return {
    id: text(data['id']),
    required: data['required'],
    lastSuccessAt: timestamp(data['last_success_at']),
    pendingCount: number(data['pending_count']),
    deliveryGapCount: number(data['delivery_gap_count']),
    lastError: error(data['last_error']),
    cleanupError: error(data['cleanup_error']),
    retainedSets,
  };
}

function backup(value: unknown): BackupDetails | null {
  if (value === null) return null;
  const data = object(value);
  const runState = data['run_state'];
  if (
    runState !== 'initializing' &&
    runState !== 'idle' &&
    runState !== 'running' &&
    runState !== 'failed'
  )
    throw new Error('Invalid backup run state');
  let currentRun: BackupDetails['currentRun'] = null;
  if (data['current_run'] !== null) {
    const run = object(data['current_run']);
    const phase = text(run['phase']);
    if (!['collecting', 'delivering', 'retrying', 'pruning'].includes(phase))
      throw new Error('Invalid backup phase');
    currentRun = { id: text(run['id']), phase, startedAt: timestamp(run['started_at']) };
  }
  return {
    lastAttemptAt: timestamp(data['last_attempt_at']),
    lastSuccessAt: timestamp(data['last_success_at']),
    nextDueAt: timestamp(data['next_due_at']),
    freshnessThresholdSeconds: number(data['freshness_threshold_seconds']),
    runState,
    currentRun,
    lastError: error(data['last_error']),
    lastRestoreVerifiedAt: timestamp(data['last_restore_verified_at']),
    destinations: list(data['destinations']).map(destination),
  };
}

export function mapHealthcheckOverview(value: unknown): HealthcheckOverview {
  const data = object(value);
  if (data['schema_version'] !== 1) throw new Error('Unsupported healthcheck schema');
  const systems = list(data['systems']).map((entry): HealthcheckSystem => {
    const system = object(entry);
    const status = system['status'];
    if (
      system['id'] !== 'backups' ||
      system['kind'] !== 'backups' ||
      typeof status !== 'string' ||
      !statuses.includes(status)
    )
      throw new Error('Unsupported healthcheck system');
    return {
      id: 'backups',
      kind: 'backups',
      status: status as HealthcheckStatus,
      observedAt: timestamp(system['observed_at']),
      backup: backup(system['backup']),
    };
  });
  if (new Set(systems.map((system) => system.id)).size !== systems.length)
    throw new Error('Duplicate healthcheck system');
  return { checkedAt: timestamp(data['checked_at'], false)!, systems };
}
