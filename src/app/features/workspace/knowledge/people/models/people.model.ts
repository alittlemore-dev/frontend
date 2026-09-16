import { KnowledgeFile } from '../../shared/knowledge-file.model';

export type PersonListSort = 'updatedNewest' | 'updatedOldest' | 'nameAsc' | 'nameDesc';
export type PersonRelationshipDirection = 'forward' | 'reverse';

export interface PersonBirthday {
  day: number;
  month: number;
  year: number | null;
}

export interface KnowledgeTag {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersonRelationshipType {
  id: string;
  isSymmetric: boolean;
  forwardName: string;
  reverseName: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersonRelationship {
  id: string;
  relatedPersonId: string;
  relatedPersonDisplayName: string;
  relationshipType: PersonRelationshipType;
  direction: PersonRelationshipDirection;
  label: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeDateReference {
  id: string;
  displayName: string;
  date: PersonBirthday;
}

export interface PersonSummary {
  id: string;
  displayName: string;
  email: string;
  phone: string;
  telegram: string;
  birthday: PersonBirthday | null;
  tags: readonly KnowledgeTag[];
  photo: KnowledgeFile | null;
  createdAt: string;
  updatedAt: string;
}

export interface PeoplePage {
  totalCount: number;
  totalPages: number;
  people: readonly PersonSummary[];
}

export interface PersonDetail {
  id: string;
  displayName: string;
  lastName: string;
  firstName: string;
  middleName: string;
  email: string;
  phone: string;
  telegram: string;
  birthday: PersonBirthday | null;
  description: string;
  tags: readonly KnowledgeTag[];
  relationships: readonly PersonRelationship[];
  relatedDates: readonly KnowledgeDateReference[];
  photo: KnowledgeFile | null;
  attachments: readonly KnowledgeFile[];
  createdAt: string;
  updatedAt: string;
}

export interface PeopleListFilters {
  page: number;
  pageSize: 20 | 50 | 100;
  sort: PersonListSort;
  searchQuery: string;
  tagIds: readonly string[];
}

export interface PersonQuickCreatePayload {
  firstName: string;
  lastName: string;
}

export interface PersonRelationshipCreatePayload {
  relatedPersonId: string;
  relationshipTypeId: string;
  direction: PersonRelationshipDirection;
  note: string;
}

export interface PersonRelationshipUpdatePayload extends PersonRelationshipCreatePayload {
  id: string;
}

export interface PersonRelationshipChangesPayload {
  create: readonly PersonRelationshipCreatePayload[];
  update: readonly PersonRelationshipUpdatePayload[];
  deleteIds: readonly string[];
}

export interface PersonUpdatePayload {
  lastName: string;
  firstName: string;
  middleName: string;
  email: string;
  phone: string;
  telegram: string;
  birthday: PersonBirthday | null;
  description: string;
  tagIds: readonly string[];
  relationshipChanges: PersonRelationshipChangesPayload;
}

export interface RelationshipTypePayload {
  isSymmetric: boolean;
  forwardName: string;
  reverseName: string;
}

export interface PersonRelationshipDraft {
  clientId: string;
  persistedId: string | null;
  relatedPersonId: string;
  relatedPersonDisplayName: string;
  relationshipTypeId: string;
  direction: PersonRelationshipDirection;
  note: string;
}

export interface KnowledgeTagsDto {
  tags: KnowledgeTag[];
}

export interface RelationshipTypesDto {
  relationshipTypes: PersonRelationshipType[];
}
