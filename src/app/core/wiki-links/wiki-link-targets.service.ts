import { Injectable, inject } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import { LanguageCode } from '../i18n/i18n.model';
import {
  WikiLinkTargetGroup,
  WikiLinkTargetRegistry,
  createWikiLinkTargetRegistry,
} from './wiki-links';

interface WikiLinkTargetsDto {
  targets: WikiLinkTargetGroup[];
}

@Injectable({ providedIn: 'root' })
export class WikiLinkTargetsService {
  private readonly api = inject(ApiClient);
  private readonly registries = new Map<LanguageCode, Observable<WikiLinkTargetRegistry>>();

  getTargets(language: LanguageCode): Observable<WikiLinkTargetRegistry> {
    const cached = this.registries.get(language);
    if (cached !== undefined) {
      return cached;
    }

    const registry = this.api
      .get<WikiLinkTargetsDto>('/api/admin/wiki-links/targets', { language })
      .pipe(
        map((dto) => createWikiLinkTargetRegistry(dto.targets)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    this.registries.set(language, registry);
    return registry;
  }
}
