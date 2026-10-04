export type AdminMatrixGrade = 'Junior' | 'Junior+' | 'Middle' | 'Middle+' | 'Senior';

export interface QueuedMatrixQuestionDto {
  id: string;
  question: string;
  grade: AdminMatrixGrade | null;
  sheet: string | null;
  section: string | null;
  subsection: string | null;
  suggestedByUsername: string;
  createdAt: string;
}

export interface QueuedMatrixQuestionsDto {
  questions: QueuedMatrixQuestionDto[];
}

export type QueuedMatrixImportIssueCode =
  | 'questionNotText'
  | 'questionBlank'
  | 'questionTooLong'
  | 'sheetNotText'
  | 'gradeNotText'
  | 'gradeInvalid'
  | 'duplicateInFile'
  | 'duplicateInQueue';

export type QueuedMatrixImportIssueSeverity = 'error' | 'warning';

export interface QueuedMatrixImportIssue {
  code: QueuedMatrixImportIssueCode;
  severity: QueuedMatrixImportIssueSeverity;
  relatedRowNumbers: number[];
}

export interface QueuedMatrixImportPreviewRow {
  rowNumber: number;
  question: string;
  sheet: string;
  grade: string;
  canImport: boolean;
  selectedByDefault: boolean;
  issues: QueuedMatrixImportIssue[];
}

export interface QueuedMatrixImportPreview {
  rows: QueuedMatrixImportPreviewRow[];
}

export interface QueuedMatrixQuestion {
  id: string;
  question: string;
  grade: AdminMatrixGrade | null;
  sheet: string | null;
  section: string | null;
  subsection: string | null;
  suggestedByUsername: string;
  createdAt: string;
}

export interface AdminMatrixItemDetailDto {
  id: string;
  slug: string;
  question: string;
}

export function mapQueuedMatrixQuestionDto(dto: QueuedMatrixQuestionDto): QueuedMatrixQuestion {
  return {
    id: dto.id,
    question: dto.question,
    grade: dto.grade,
    sheet: dto.sheet,
    section: dto.section,
    subsection: dto.subsection,
    suggestedByUsername: dto.suggestedByUsername,
    createdAt: dto.createdAt,
  };
}
