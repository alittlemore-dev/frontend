import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nParams } from './i18n.model';
import { I18nService } from './i18n.service';

@Pipe({
  name: 't',
  standalone: true,
  pure: false,
})
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: string, params?: I18nParams): string {
    return this.i18n.translate(key, params);
  }
}
