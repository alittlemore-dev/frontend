import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { TranslatePipe } from '../../../../../../core/i18n/translate.pipe';
import { MatrixSheet } from '../../../../models/matrix-question.model';

@Component({
  selector: 'app-matrix-sheet-tabs',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './matrix-sheet-tabs.component.html',
})
export class MatrixSheetTabsComponent {
  readonly sheets = input.required<MatrixSheet[]>();
  readonly selectedSheetKey = input<string | null>(null);

  readonly sheetSelected = output<string>();

  isSelected(sheet: MatrixSheet): boolean {
    return this.selectedSheetKey() === sheet.key;
  }

  selectSheet(sheet: MatrixSheet): void {
    this.sheetSelected.emit(sheet.key);
  }
}
