import { Injectable, SecurityContext, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { LanguageCode } from '../i18n/i18n.model';
import { renderMarkdownWithWikiLinks } from './wiki-links';

@Injectable({ providedIn: 'root' })
export class WikiLinkRendererService {
  private readonly sanitizer = inject(DomSanitizer);

  render(markdown: string, language: LanguageCode): string {
    return renderMarkdownWithWikiLinks(
      markdown,
      language,
      (html) => this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '',
    );
  }
}
