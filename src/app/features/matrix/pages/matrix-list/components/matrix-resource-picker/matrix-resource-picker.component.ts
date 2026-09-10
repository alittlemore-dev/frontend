import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LanguageCode } from '../../../../../../core/i18n/i18n.model';
import { TranslatePipe } from '../../../../../../core/i18n/translate.pipe';
import {
  MatrixAttachedResource,
  MatrixAttachedResourceTranslations,
  MatrixResource,
  MatrixResourceTranslations,
} from '../../../../models/matrix-question.model';

export interface MatrixResourceDraft extends Omit<MatrixAttachedResource, 'translations'> {
  isNew: boolean;
  translations: MatrixAttachedResourceTranslations;
}

@Component({
  selector: 'app-matrix-resource-picker',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './matrix-resource-picker.component.html',
})
export class MatrixResourcePickerComponent {
  readonly resources = input.required<MatrixResourceDraft[]>();
  readonly searchResults = input<MatrixResource[]>([]);
  readonly activeLanguage = input.required<LanguageCode>();
  readonly searchChange = output<string>();
  readonly resourcesChange = output<MatrixResourceDraft[]>();

  readonly search = signal('');
  readonly newNameRu = signal('');
  readonly newNameEn = signal('');
  readonly newUrl = signal('');

  private nextNewResourceId = -1;

  setSearch(value: string): void {
    this.search.set(value);
    this.searchChange.emit(value);
  }

  attach(resource: MatrixResource): void {
    if (this.resources().some((item) => !item.isNew && item.id === resource.id)) return;
    this.resourcesChange.emit([
      ...this.resources(),
      {
        ...resource,
        context: '',
        translations: {
          ru: { name: resource.translations.ru.name, context: '' },
          en: { name: resource.translations.en.name, context: '' },
        },
        isNew: false,
      },
    ]);
  }

  addNew(): void {
    const nameRu = this.newNameRu().trim();
    const nameEn = this.newNameEn().trim();
    const url = this.newUrl().trim();
    if (!nameRu || !nameEn || !url) return;
    const translations: MatrixAttachedResourceTranslations = {
      ru: { name: nameRu, context: '' },
      en: { name: nameEn, context: '' },
    };
    this.resourcesChange.emit([
      ...this.resources(),
      {
        id: this.nextNewResourceId--,
        name: this.activeLanguage() === 'ru' ? nameRu : nameEn,
        url,
        context: '',
        translations,
        isNew: true,
      },
    ]);
    this.newNameRu.set('');
    this.newNameEn.set('');
    this.newUrl.set('');
  }

  updateContext(index: number, language: LanguageCode, context: string): void {
    this.resourcesChange.emit(
      this.resources().map((resource, currentIndex) =>
        currentIndex === index
          ? {
              ...resource,
              context: language === this.activeLanguage() ? context : resource.context,
              translations: {
                ...resource.translations,
                [language]: { ...resource.translations[language], context },
              },
            }
          : resource,
      ),
    );
  }

  detach(index: number): void {
    this.resourcesChange.emit(this.resources().filter((_, currentIndex) => currentIndex !== index));
  }

  static fromAttachedResource(resource: MatrixAttachedResource): MatrixResourceDraft {
    return {
      ...resource,
      translations: resource.translations,
      isNew: false,
    };
  }
}

export function toNewResourceTranslations(
  translations: MatrixAttachedResourceTranslations,
): MatrixResourceTranslations {
  return {
    ru: { name: translations.ru.name },
    en: { name: translations.en.name },
  };
}
