import { Injectable, inject } from '@angular/core';
import { MarkdownRendererService } from '@alittlemore.dev/design-system/markdown';
import { LanguageCode } from '../i18n/i18n.model';
import { applicationWikiLinks } from './wiki-links';

@Injectable({ providedIn: 'root' })
export class WikiLinkRendererService {
  private readonly renderer = inject(MarkdownRendererService);

  render(markdown: string, language: LanguageCode): string {
    return this.renderer.render(markdown, { wikiLinks: applicationWikiLinks(language) });
  }
}
