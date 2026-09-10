export interface ReadonlyMatrixSheet {
  key: string;
  name: string;
}

export interface ReadonlyMatrixQuestion {
  slug: string;
  question: string;
  interviewFrequency: string | null;
}

export interface ReadonlyMatrixGradeGroup {
  grade: string | null;
  questions: ReadonlyMatrixQuestion[];
}

export interface ReadonlyMatrixSubsectionGroup {
  subsection: string;
  grades: ReadonlyMatrixGradeGroup[];
}

export interface ReadonlyMatrixSectionGroup {
  section: string;
  subsections: ReadonlyMatrixSubsectionGroup[];
}

export interface ReadonlyMatrixQuestionList {
  sheetKey: string;
  sheet: string;
  sections: ReadonlyMatrixSectionGroup[];
}
