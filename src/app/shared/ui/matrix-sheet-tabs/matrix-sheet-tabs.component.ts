import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ReadonlyMatrixSheet } from '../matrix-readonly.model';

@Component({
  selector: 'app-matrix-readonly-sheet-tabs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './matrix-sheet-tabs.component.html',
})
export class MatrixSheetTabsComponent {
  readonly sheets = input.required<ReadonlyMatrixSheet[]>();
  readonly selectedSheetKey = input<string | null>(null);
  readonly ariaLabel = input.required<string>();

  readonly sheetSelected = output<string>();

  isSelected(sheet: ReadonlyMatrixSheet): boolean {
    return this.selectedSheetKey() === sheet.key;
  }

  selectSheet(sheet: ReadonlyMatrixSheet): void {
    this.sheetSelected.emit(sheet.key);
  }
}
