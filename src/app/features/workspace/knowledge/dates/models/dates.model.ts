import { KnowledgeTag } from '../../people/models/people.model';
import { AnnualDateValue } from '../../shared/annual-date';
import { KnowledgeFile } from '../../shared/knowledge-file.model';

export type KnowledgeDateListSort =
  'dateAsc' | 'dateDesc' | 'updatedNewest' | 'updatedOldest' | 'nameAsc' | 'nameDesc';

export interface RelatedPerson {
  id: string;
  displayName: string;
}

export interface KnowledgeDateSummary {
  id: string;
  displayName: string;
  date: AnnualDateValue;
  relatedPeople: readonly RelatedPerson[];
  tags: readonly KnowledgeTag[];
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeDatesPage {
  totalCount: number;
  totalPages: number;
  dates: readonly KnowledgeDateSummary[];
}

export interface KnowledgeDateDetail extends KnowledgeDateSummary {
  description: string;
  attachments: readonly KnowledgeFile[];
}

export interface KnowledgeDateListFilters {
  page: number;
  pageSize: 20 | 50 | 100;
  sort: KnowledgeDateListSort;
  searchQuery: string;
  tagIds: readonly string[];
  relatedPersonId: string;
}

export interface KnowledgeDateCreatePayload {
  displayName: string;
  date: AnnualDateValue;
}

export interface KnowledgeDateUpdatePayload extends KnowledgeDateCreatePayload {
  description: string;
  tagIds: readonly string[];
  personIds: readonly string[];
}
