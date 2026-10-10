import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AnalyticsPageComponent } from './analytics-page.component';

@Component({
  selector: 'app-article-statistics-page',
  imports: [AnalyticsPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-analytics-page scope="Articles" />`,
})
export class ArticleStatisticsPageComponent {}

@Component({
  selector: 'app-matrix-statistics-page',
  imports: [AnalyticsPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-analytics-page scope="Matrix" />`,
})
export class MatrixStatisticsPageComponent {}
