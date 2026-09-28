import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import { ImportantInfoItem, ImportantInfoList } from '../models/important-info.model';

const PATH = '/api/personal-workspace/important-info';

@Injectable({ providedIn: 'root' })
export class ImportantInfoService {
  private readonly api = inject(ApiClient);

  list(): Observable<readonly ImportantInfoItem[]> {
    return this.api
      .get<ImportantInfoList>(PATH)
      .pipe(map(({ items }) => [...items].sort(byPosition)));
  }

  create(text: string): Observable<ImportantInfoItem> {
    return this.api.post<ImportantInfoItem>(PATH, { text });
  }

  update(id: string, text: string): Observable<ImportantInfoItem> {
    return this.api.put<ImportantInfoItem>(`${PATH}/${encodeURIComponent(id)}`, { text });
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`${PATH}/${encodeURIComponent(id)}`);
  }

  reorder(ids: readonly string[]): Observable<readonly ImportantInfoItem[]> {
    return this.api
      .put<ImportantInfoList>(`${PATH}/order`, { ids })
      .pipe(map(({ items }) => [...items].sort(byPosition)));
  }
}

function byPosition(left: ImportantInfoItem, right: ImportantInfoItem): number {
  return left.position - right.position;
}
