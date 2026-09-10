import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';
import { LanguageCode } from '../i18n/i18n.model';
import { I18nService } from '../i18n/i18n.service';

export interface SeoAlternate {
  language: LanguageCode;
  canonicalUrl?: string;
  path?: string;
}

export interface SeoMeta {
  title: string;
  description: string;
  canonicalUrl?: string;
  canonicalPath?: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  alternates?: SeoAlternate[];
  structuredData?: Record<string, unknown>;
  robots?: string;
}

export interface TranslatedSeoMeta {
  titleKey: string;
  descriptionKey: string;
  canonicalUrl?: string;
  canonicalPath?: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  alternates?: SeoAlternate[];
  robots?: string;
}

const SITE_NAME_KEY = 'app.siteName';
const DEFAULT_OG_IMAGE = '/images/personal.jpg';
const SEO_MANAGED_BY = 'seo-service';
const JSON_SCRIPT_ESCAPE_PATTERN = /[<>&\u2028\u2029]/g;
const JSON_SCRIPT_ESCAPES: Record<string, string> = {
  '<': '\\u003C',
  '>': '\\u003E',
  '&': '\\u0026',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
};

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly i18n = inject(I18nService);
  private translatedMeta: TranslatedSeoMeta | null = null;

  constructor() {
    effect(() => {
      this.i18n.language();
      if (this.translatedMeta) {
        this.applyTranslatedMeta(this.translatedMeta);
      }
    });
  }

  setMeta(data: SeoMeta): void {
    this.translatedMeta = null;
    this.applyMeta(data, this.i18n.translate(SITE_NAME_KEY));
  }

  setTranslatedMeta(data: TranslatedSeoMeta): void {
    this.translatedMeta = data;
    this.applyTranslatedMeta(data);
  }

  private applyTranslatedMeta(data: TranslatedSeoMeta): void {
    this.applyMeta(
      {
        title: this.i18n.translate(data.titleKey),
        description: this.i18n.translate(data.descriptionKey),
        canonicalUrl: data.canonicalUrl,
        canonicalPath: data.canonicalPath,
        ogImage: data.ogImage,
        ogType: data.ogType,
        alternates: data.alternates,
        robots: data.robots,
      },
      this.i18n.translate('app.siteName'),
    );
  }

  private applyMeta(data: SeoMeta, siteName: string): void {
    const image = data.ogImage ?? DEFAULT_OG_IMAGE;
    const url = data.canonicalUrl ?? this.buildCanonicalUrl(data.canonicalPath);

    this.title.setTitle(data.title);

    this.meta.updateTag({ name: 'description', content: data.description });

    this.meta.updateTag({ property: 'og:type', content: data.ogType ?? 'website' });
    this.meta.updateTag({ property: 'og:site_name', content: siteName });
    this.meta.updateTag({ property: 'og:title', content: data.title });
    this.meta.updateTag({ property: 'og:description', content: data.description });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:image', content: image });

    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: data.title });
    this.meta.updateTag({ name: 'twitter:description', content: data.description });
    this.meta.updateTag({ name: 'twitter:image', content: image });

    if (url) {
      this.updateCanonicalLink(url);
    } else {
      this.removeCanonicalLink();
    }

    this.updateAlternateLinks(data.alternates ?? []);
    this.updateStructuredData(data.structuredData);
    this.updateRobots(data.robots);
  }

  private buildCanonicalUrl(path: string | undefined): string {
    if (!path) return '';
    const baseUrl = environment.siteUrl.replace(/\/$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    if (baseUrl) return `${baseUrl}${normalizedPath}`;
    return new URL(normalizedPath, this.document.location.origin).toString();
  }

  private updateCanonicalLink(url: string): void {
    const head = this.document.head;
    let link = head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  private removeCanonicalLink(): void {
    this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.remove();
  }

  private updateAlternateLinks(alternates: SeoAlternate[]): void {
    const head = this.document.head;
    head
      .querySelectorAll<HTMLLinkElement>(
        `link[rel="alternate"][data-managed-by="${SEO_MANAGED_BY}"]`,
      )
      .forEach((link) => link.remove());

    for (const alternate of alternates) {
      const href = alternate.canonicalUrl ?? this.buildCanonicalUrl(alternate.path);
      if (!href) continue;
      const link = this.document.createElement('link');
      link.setAttribute('rel', 'alternate');
      link.setAttribute('hreflang', alternate.language);
      link.setAttribute('href', href);
      link.setAttribute('data-managed-by', SEO_MANAGED_BY);
      head.appendChild(link);
    }
  }

  private updateStructuredData(data: Record<string, unknown> | undefined): void {
    this.document.head
      .querySelectorAll<HTMLScriptElement>(
        `script[type="application/ld+json"][data-managed-by="${SEO_MANAGED_BY}"]`,
      )
      .forEach((script) => script.remove());

    if (!data) return;

    const script = this.document.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    script.setAttribute('data-managed-by', SEO_MANAGED_BY);
    script.textContent = serializeJsonForInlineScript(data);
    this.document.head.appendChild(script);
  }

  private updateRobots(value: string | undefined): void {
    if (value) {
      this.meta.updateTag({ name: 'robots', content: value });
      return;
    }
    this.meta.removeTag('name="robots"');
  }
}

function serializeJsonForInlineScript(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(
    JSON_SCRIPT_ESCAPE_PATTERN,
    (character) => JSON_SCRIPT_ESCAPES[character],
  );
}
