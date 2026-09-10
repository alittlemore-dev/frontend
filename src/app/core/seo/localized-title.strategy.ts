import { effect, inject, Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { I18nService } from '../i18n/i18n.service';

@Injectable()
export class LocalizedTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly i18n = inject(I18nService);
  private activeTitleKey: string | null = null;

  constructor() {
    super();
    effect(() => {
      this.i18n.language();
      if (this.activeTitleKey !== null) {
        this.title.setTitle(this.i18n.translate(this.activeTitleKey));
      }
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const titleKey = this.buildTitle(snapshot);
    this.activeTitleKey = titleKey ?? null;
    if (titleKey !== undefined) {
      this.title.setTitle(this.i18n.translate(titleKey));
    }
  }
}
