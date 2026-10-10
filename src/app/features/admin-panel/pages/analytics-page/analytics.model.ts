import { ArticleReactionCounts } from '../../models/article-workspace.model';
import { AnalyticsSource } from '../../../../core/analytics/anonymous-analytics.service';

export type AnalyticsKind = 'Articles' | 'Matrix' | 'Site' | 'Suggestions';
export type AnalyticsMetric = 'views' | 'engaged' | 'reactions' | 'suggestions' | 'visitors';
export type AnalyticsBucket = 'day' | 'week' | 'month';
export interface AnalyticsDaily {
  date: string;
  targetId: string;
  title: string;
  groupId: string;
  groupTitle: string;
  sectionId: string;
  sectionTitle: string;
  source: AnalyticsSource;
  views: number;
  engaged: number;
  reactions: number;
  suggestions: number;
  visitors: number;
}
export interface AnalyticsReport {
  dateFrom: string;
  dateTo: string;
  kind: AnalyticsKind;
  daily: AnalyticsDaily[];
  currentReactions: Record<string, ArticleReactionCounts>;
}
export interface AnalyticsPoint {
  date: string;
  value: number;
}
export interface AnalyticsTotal {
  views: number;
  engaged: number;
  reactions: number;
  suggestions: number;
  visitors: number;
}
