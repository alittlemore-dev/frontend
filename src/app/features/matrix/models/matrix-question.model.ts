export type MatrixPublishStatus = 'Draft' | 'Published';
export type MatrixGrade = 'Junior' | 'Junior+' | 'Middle' | 'Middle+' | 'Senior';
export type MatrixInterviewFrequency = 'constantly' | 'often' | 'rarely' | 'neverSeen';

export interface MatrixResourceTranslationDto {
  name: string;
}

export interface MatrixResourceTranslationsDto {
  ru: MatrixResourceTranslationDto;
  en: MatrixResourceTranslationDto;
}

export interface MatrixAttachedResourceTranslationDto {
  name: string;
  context: string;
}

export interface MatrixAttachedResourceTranslationsDto {
  ru: MatrixAttachedResourceTranslationDto;
  en: MatrixAttachedResourceTranslationDto;
}

export interface MatrixItemTranslationDto {
  question: string;
  answer: string;
  interviewAnswerExplanation: string;
  sheet: string;
  section: string;
  subsection: string;
}

export interface MatrixItemTranslationsDto {
  ru: MatrixItemTranslationDto;
  en: MatrixItemTranslationDto;
}

export interface MatrixResourceDto {
  id: string;
  name: string;
  url: string;
  translations: MatrixResourceTranslationsDto;
}

export interface MatrixAttachedResourceDto extends Omit<MatrixResourceDto, 'translations'> {
  context: string;
  translations: MatrixAttachedResourceTranslationsDto;
}

export interface MatrixItemDto {
  slug: string;
  question: string;
  interviewFrequency: MatrixInterviewFrequency | null;
}

export interface MatrixItemDetailDto extends MatrixItemDto {
  answer: string;
  interviewAnswerExplanation: string;
  sheetKey: string;
  sheet: string;
  grade: MatrixGrade | null;
  section: string;
  subsection: string;
  publishStatus: MatrixPublishStatus;
  suggestedByUsername: string;
  translations: MatrixItemTranslationsDto;
  resources: MatrixAttachedResourceDto[];
}

export interface MatrixGradeGroupDto {
  grade: MatrixGrade | null;
  items: MatrixItemDto[];
}

export interface MatrixSubsectionGroupDto {
  subsection: string;
  grades: MatrixGradeGroupDto[];
}

export interface MatrixSectionGroupDto {
  section: string;
  subsections: MatrixSubsectionGroupDto[];
}

export interface MatrixItemsListDto {
  sheetKey: string;
  sheet: string;
  sections: MatrixSectionGroupDto[];
}

export interface MatrixSheetDto {
  key: string;
  name: string;
}

export interface MatrixSheetsDto {
  sheets: MatrixSheetDto[];
}

export interface MatrixResourcesDto {
  resources: MatrixResourceDto[];
}

export interface MatrixResourceTranslation {
  name: string;
}

export interface MatrixResourceTranslations {
  ru: MatrixResourceTranslation;
  en: MatrixResourceTranslation;
}

export interface MatrixAttachedResourceTranslation {
  name: string;
  context: string;
}

export interface MatrixAttachedResourceTranslations {
  ru: MatrixAttachedResourceTranslation;
  en: MatrixAttachedResourceTranslation;
}

export interface MatrixItemTranslation {
  question: string;
  answer: string;
  interviewAnswerExplanation: string;
  sheet: string;
  section: string;
  subsection: string;
}

export interface MatrixItemTranslations {
  ru: MatrixItemTranslation;
  en: MatrixItemTranslation;
}

export interface MatrixSheet {
  key: string;
  name: string;
}

export interface MatrixResource {
  id: string;
  name: string;
  url: string;
  translations: MatrixResourceTranslations;
}

export interface MatrixAttachedResource extends Omit<MatrixResource, 'translations'> {
  context: string;
  translations: MatrixAttachedResourceTranslations;
}

export interface MatrixQuestion {
  slug: string;
  question: string;
  interviewFrequency: MatrixInterviewFrequency | null;
}

export interface MatrixQuestionDetail extends MatrixQuestion {
  answer: string;
  interviewAnswerExplanation: string;
  sheetKey: string;
  sheet: string;
  grade: MatrixGrade | null;
  section: string;
  subsection: string;
  publishStatus: MatrixPublishStatus;
  suggestedByUsername: string;
  translations: MatrixItemTranslations;
  resources: MatrixAttachedResource[];
}

export interface MatrixAttachmentContextTranslationPayload {
  context: string;
}

export interface MatrixAttachmentContextTranslationsPayload {
  ru: MatrixAttachmentContextTranslationPayload;
  en: MatrixAttachmentContextTranslationPayload;
}

export interface ExistingMatrixResourceAttachmentPayload {
  resourceId: string;
  translations: MatrixAttachmentContextTranslationsPayload;
}

export interface NewMatrixResourcePayload {
  url: string;
  translations: MatrixResourceTranslations;
}

export interface NewMatrixResourceAttachmentPayload {
  resource: NewMatrixResourcePayload;
  translations: MatrixAttachmentContextTranslationsPayload;
}

export type MatrixResourceAttachmentPayload =
  ExistingMatrixResourceAttachmentPayload | NewMatrixResourceAttachmentPayload;

export interface MatrixQuestionPayload {
  slug: string;
  sheetKey: string;
  grade: MatrixGrade;
  interviewFrequency: MatrixInterviewFrequency | null;
  publishStatus: MatrixPublishStatus;
  translations: MatrixItemTranslations;
  resources: MatrixResourceAttachmentPayload[];
}

export interface MatrixGradeGroup {
  grade: MatrixGrade | null;
  questions: MatrixQuestion[];
}

export interface MatrixSubsectionGroup {
  subsection: string;
  grades: MatrixGradeGroup[];
}

export interface MatrixSectionGroup {
  section: string;
  subsections: MatrixSubsectionGroup[];
}

export interface MatrixQuestionList {
  sheetKey: string;
  sheet: string;
  sections: MatrixSectionGroup[];
}

export function mapMatrixSheetDto(dto: MatrixSheetDto): MatrixSheet {
  return {
    key: dto.key,
    name: dto.name,
  };
}

export function mapMatrixListDto(dto: MatrixItemsListDto): MatrixQuestionList {
  return {
    sheetKey: dto.sheetKey,
    sheet: dto.sheet,
    sections: dto.sections.map((section) => ({
      section: section.section,
      subsections: section.subsections.map((subsection) => ({
        subsection: subsection.subsection,
        grades: subsection.grades.map((grade) => ({
          grade: grade.grade,
          questions: grade.items.map((item) => ({
            slug: item.slug,
            question: item.question,
            interviewFrequency: item.interviewFrequency,
          })),
        })),
      })),
    })),
  };
}

export function mapMatrixDetailDto(dto: MatrixItemDetailDto): MatrixQuestionDetail {
  return {
    slug: dto.slug,
    question: dto.question,
    interviewFrequency: dto.interviewFrequency,
    answer: dto.answer,
    interviewAnswerExplanation: dto.interviewAnswerExplanation,
    sheetKey: dto.sheetKey,
    sheet: dto.sheet,
    grade: dto.grade,
    section: dto.section,
    subsection: dto.subsection,
    publishStatus: dto.publishStatus,
    suggestedByUsername: dto.suggestedByUsername,
    translations: dto.translations,
    resources: dto.resources.map((resource) => ({
      id: resource.id,
      name: resource.name,
      url: resource.url,
      context: resource.context,
      translations: resource.translations,
    })),
  };
}

export function mapMatrixResourceDto(dto: MatrixResourceDto): MatrixResource {
  return {
    id: dto.id,
    name: dto.name,
    url: dto.url,
    translations: dto.translations,
  };
}
