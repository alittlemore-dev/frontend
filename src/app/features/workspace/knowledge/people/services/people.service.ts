import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiClient, QueryParams } from '../../../../../core/http/api-client.service';
import { KnowledgeFile } from '../../shared/knowledge-file.model';
import {
  KnowledgeTag,
  KnowledgeTagsDto,
  PeopleListFilters,
  PeoplePage,
  PersonDetail,
  PersonQuickCreatePayload,
  PersonRelationshipType,
  PersonUpdatePayload,
  RelationshipTypePayload,
  RelationshipTypesDto,
} from '../models/people.model';

@Injectable({ providedIn: 'root' })
export class PeopleService {
  private readonly api = inject(ApiClient);

  listPeople(filters: PeopleListFilters): Observable<PeoplePage> {
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
    return this.api
      .get<PeoplePage>('/api/personal-workspace/knowledge/people', params)
      .pipe(map((page) => mapPeoplePage(page)));
  }

  createPerson(payload: PersonQuickCreatePayload): Observable<PersonDetail> {
    return this.api
      .post<PersonDetail>('/api/personal-workspace/knowledge/people', payload)
      .pipe(map((person) => mapPerson(person)));
  }

  getPerson(personId: string): Observable<PersonDetail> {
    return this.api
      .get<PersonDetail>(`/api/personal-workspace/knowledge/people/${personId}`)
      .pipe(map((person) => mapPerson(person)));
  }

  updatePerson(personId: string, payload: PersonUpdatePayload): Observable<PersonDetail> {
    return this.api
      .put<PersonDetail>(`/api/personal-workspace/knowledge/people/${personId}`, payload)
      .pipe(map((person) => mapPerson(person)));
  }

  deletePerson(personId: string): Observable<void> {
    return this.api.delete<void>(`/api/personal-workspace/knowledge/people/${personId}`);
  }

  listTags(searchQuery: string): Observable<readonly KnowledgeTag[]> {
    const params = searchQuery.trim() === '' ? undefined : { searchQuery: searchQuery.trim() };
    return this.api
      .get<KnowledgeTagsDto>('/api/personal-workspace/knowledge/tags', params)
      .pipe(map((response) => response.tags.map((tag) => ({ ...tag }))));
  }

  createTag(name: string): Observable<KnowledgeTag> {
    return this.api.post<KnowledgeTag>('/api/personal-workspace/knowledge/tags', { name });
  }

  updateTag(tagId: string, name: string): Observable<KnowledgeTag> {
    return this.api.put<KnowledgeTag>(`/api/personal-workspace/knowledge/tags/${tagId}`, { name });
  }

  deleteTag(tagId: string): Observable<void> {
    return this.api.delete<void>(`/api/personal-workspace/knowledge/tags/${tagId}`);
  }

  listRelationshipTypes(): Observable<readonly PersonRelationshipType[]> {
    return this.api
      .get<RelationshipTypesDto>('/api/personal-workspace/knowledge/people/relationship-types')
      .pipe(
        map((response) =>
          response.relationshipTypes.map((relationshipType) => ({ ...relationshipType })),
        ),
      );
  }

  createRelationshipType(payload: RelationshipTypePayload): Observable<PersonRelationshipType> {
    return this.api.post<PersonRelationshipType>(
      '/api/personal-workspace/knowledge/people/relationship-types',
      payload,
    );
  }

  updateRelationshipType(
    relationshipTypeId: string,
    payload: RelationshipTypePayload,
  ): Observable<PersonRelationshipType> {
    return this.api.put<PersonRelationshipType>(
      `/api/personal-workspace/knowledge/people/relationship-types/${relationshipTypeId}`,
      payload,
    );
  }

  deleteRelationshipType(relationshipTypeId: string): Observable<void> {
    return this.api.delete<void>(
      `/api/personal-workspace/knowledge/people/relationship-types/${relationshipTypeId}`,
    );
  }

  replacePhoto(personId: string, file: File): Observable<KnowledgeFile> {
    const formData = new FormData();
    formData.append('file', file);
    return this.api.put<KnowledgeFile>(
      `/api/personal-workspace/knowledge/people/${personId}/photo`,
      formData,
    );
  }

  deletePhoto(personId: string): Observable<void> {
    return this.api.delete<void>(`/api/personal-workspace/knowledge/people/${personId}/photo`);
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

function mapPeoplePage(page: PeoplePage): PeoplePage {
  return {
    totalCount: page.totalCount,
    totalPages: page.totalPages,
    people: page.people.map((person) => ({
      ...person,
      telegram: person.telegram,
      birthday: person.birthday === null ? null : { ...person.birthday },
      tags: person.tags.map((tag) => ({ ...tag })),
      photo: person.photo === null ? null : { ...person.photo },
    })),
  };
}

function mapPerson(person: PersonDetail): PersonDetail {
  return {
    ...person,
    telegram: person.telegram,
    birthday: person.birthday === null ? null : { ...person.birthday },
    tags: person.tags.map((tag) => ({ ...tag })),
    relationships: person.relationships.map((relationship) => ({
      ...relationship,
      relationshipType: { ...relationship.relationshipType },
    })),
    relatedDates: person.relatedDates.map((value) => ({
      ...value,
      date: { ...value.date },
    })),
    photo: person.photo === null ? null : { ...person.photo },
    attachments: person.attachments.map((file) => ({ ...file })),
  };
}
