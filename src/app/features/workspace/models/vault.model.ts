export interface VaultEntry {
  id: string;
  source: string;
  kind: string;
  displayName: string;
  updatedAt: string;
}

export interface VaultRecent {
  items: readonly VaultEntry[];
}

export interface VaultKindStatistics {
  source: string;
  kind: string;
  totalCount: number;
}

export interface VaultStatistics {
  totalCount: number;
  knowledgeCount: number;
  resumeCount: number;
  byKind: readonly VaultKindStatistics[];
  createdLast30DaysCount: number;
  createdOrUpdatedLast30DaysCount: number;
}
