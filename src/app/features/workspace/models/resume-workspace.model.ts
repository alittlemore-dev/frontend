import { LanguageCode } from '../../../core/i18n/i18n.model';

export type ResumeCurrentStatus = 'notSet' | 'current' | 'notCurrent';
export type ResumeLanguage = LanguageCode;
export type ResumeExportFormat = 'pdf' | 'docx';

export interface ResumeProfileDto {
  fullName: string;
  role: string;
  location: string;
  email: string;
  phone: string;
  websiteUrl: string;
  linkedinUrl: string;
  githubUrl: string;
  telegram: string;
}

export interface ResumeSummaryDto {
  text: string;
}

export interface ResumeSkillGroupDto {
  category: string;
  items: string[];
}

export interface ResumeExperienceItemDto {
  company: string;
  position: string;
  location: string;
  startDate: string | null;
  endDate: string | null;
  currentStatus: ResumeCurrentStatus;
  summary: string;
  highlights: string[];
  technologies: string[];
  projects: ResumeProjectItemDto[];
}

export interface ResumeProjectItemDto {
  name: string;
  role: string;
  description: string;
  highlights: string[];
  technologies: string[];
  url: string;
}

export interface ResumeEducationItemDto {
  institution: string;
  degree: string;
  field: string;
  location: string;
  startDate: string | null;
  endDate: string | null;
  description: string;
}

export interface ResumeLanguageItemDto {
  name: string;
  proficiency: string;
}

export interface ResumeCertificationItemDto {
  name: string;
  issuer: string;
  issuedOn: string | null;
  expiresOn: string | null;
  credentialUrl: string;
}

export interface ResumeAdditionalSectionItemDto {
  title: string;
  description: string;
  url: string;
}

export interface ResumeAdditionalSectionDto {
  title: string;
  items: ResumeAdditionalSectionItemDto[];
}

export interface ResumeContentDto {
  profile: ResumeProfileDto;
  summary: ResumeSummaryDto;
  skills: ResumeSkillGroupDto[];
  experience: ResumeExperienceItemDto[];
  education: ResumeEducationItemDto[];
  languages: ResumeLanguageItemDto[];
  certifications: ResumeCertificationItemDto[];
  additionalSections: ResumeAdditionalSectionDto[];
}

export interface ResumeDto {
  id: string;
  title: string;
  language: ResumeLanguage;
  content: ResumeContentDto;
  createdAt: string;
  updatedAt: string;
}

export interface ResumesDto {
  totalCount: number;
  totalPages: number;
  resumes: ResumeDto[];
}

export interface ResumePayloadDto {
  title: string;
  language: ResumeLanguage;
  content: ResumeContentDto;
}

export interface ResumeExportPayloadDto extends ResumePayloadDto {
  format: ResumeExportFormat;
}

export interface ResumeProfile {
  fullName: string;
  role: string;
  location: string;
  email: string;
  phone: string;
  websiteUrl: string;
  linkedinUrl: string;
  githubUrl: string;
  telegram: string;
}

export interface ResumeSummary {
  text: string;
}

export interface ResumeSkillGroup {
  category: string;
  items: string[];
}

export interface ResumeExperienceItem {
  company: string;
  position: string;
  location: string;
  startDate: string | null;
  endDate: string | null;
  currentStatus: ResumeCurrentStatus;
  summary: string;
  highlights: string[];
  technologies: string[];
  projects: ResumeProjectItem[];
}

export interface ResumeProjectItem {
  name: string;
  role: string;
  description: string;
  highlights: string[];
  technologies: string[];
  url: string;
}

export interface ResumeEducationItem {
  institution: string;
  degree: string;
  field: string;
  location: string;
  startDate: string | null;
  endDate: string | null;
  description: string;
}

export interface ResumeLanguageItem {
  name: string;
  proficiency: string;
}

export interface ResumeCertificationItem {
  name: string;
  issuer: string;
  issuedOn: string | null;
  expiresOn: string | null;
  credentialUrl: string;
}

export interface ResumeAdditionalSectionItem {
  title: string;
  description: string;
  url: string;
}

export interface ResumeAdditionalSection {
  title: string;
  items: ResumeAdditionalSectionItem[];
}

export interface ResumeContent {
  profile: ResumeProfile;
  summary: ResumeSummary;
  skills: ResumeSkillGroup[];
  experience: ResumeExperienceItem[];
  education: ResumeEducationItem[];
  languages: ResumeLanguageItem[];
  certifications: ResumeCertificationItem[];
  additionalSections: ResumeAdditionalSection[];
}

export interface Resume {
  id: string;
  title: string;
  language: ResumeLanguage;
  content: ResumeContent;
  createdAt: string;
  updatedAt: string;
}

export interface Resumes {
  totalCount: number;
  totalPages: number;
  resumes: Resume[];
}

export interface ResumePayload {
  title: string;
  language: ResumeLanguage;
  content: ResumeContent;
}

export interface ResumeListParams {
  page: number;
  pageSize: number;
}

export function mapResumeDto(dto: ResumeDto): Resume {
  return {
    id: dto.id,
    title: dto.title,
    language: dto.language,
    content: mapResumeContentDto(dto.content),
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export function mapResumesDto(dto: ResumesDto): Resumes {
  return {
    totalCount: dto.totalCount,
    totalPages: dto.totalPages,
    resumes: dto.resumes.map(mapResumeDto),
  };
}

export function toResumePayloadDto(payload: ResumePayload): ResumePayloadDto {
  return {
    title: payload.title,
    language: payload.language,
    content: mapResumeContentToDto(payload.content),
  };
}

export function toResumeExportPayloadDto(
  payload: ResumePayload,
  format: ResumeExportFormat,
): ResumeExportPayloadDto {
  return {
    format,
    ...toResumePayloadDto(payload),
  };
}

export function mapResumeContentDto(dto: ResumeContentDto): ResumeContent {
  return {
    profile: { ...dto.profile },
    summary: { ...dto.summary },
    skills: dto.skills.map((skill) => ({
      category: skill.category,
      items: [...skill.items],
    })),
    experience: dto.experience.map((item) => ({
      company: item.company,
      position: item.position,
      location: item.location,
      startDate: item.startDate,
      endDate: item.endDate,
      currentStatus: item.currentStatus,
      summary: item.summary,
      highlights: [...item.highlights],
      technologies: [...item.technologies],
      projects: item.projects.map(mapResumeProjectItemDto),
    })),
    education: dto.education.map((item) => ({ ...item })),
    languages: dto.languages.map((item) => ({ ...item })),
    certifications: dto.certifications.map((item) => ({ ...item })),
    additionalSections: dto.additionalSections.map((section) => ({
      title: section.title,
      items: section.items.map((item) => ({ ...item })),
    })),
  };
}

function mapResumeContentToDto(content: ResumeContent): ResumeContentDto {
  return {
    profile: { ...content.profile },
    summary: { ...content.summary },
    skills: content.skills.map((skill) => ({
      category: skill.category,
      items: [...skill.items],
    })),
    experience: content.experience.map((item) => ({
      company: item.company,
      position: item.position,
      location: item.location,
      startDate: item.startDate,
      endDate: item.endDate,
      currentStatus: item.currentStatus,
      summary: item.summary,
      highlights: [...item.highlights],
      technologies: [...item.technologies],
      projects: item.projects.map(mapResumeProjectItemToDto),
    })),
    education: content.education.map((item) => ({ ...item })),
    languages: content.languages.map((item) => ({ ...item })),
    certifications: content.certifications.map((item) => ({ ...item })),
    additionalSections: content.additionalSections.map((section) => ({
      title: section.title,
      items: section.items.map((item) => ({ ...item })),
    })),
  };
}

function mapResumeProjectItemDto(item: ResumeProjectItemDto): ResumeProjectItem {
  return {
    name: item.name,
    role: item.role,
    description: item.description,
    highlights: [...item.highlights],
    technologies: [...item.technologies],
    url: item.url,
  };
}

function mapResumeProjectItemToDto(item: ResumeProjectItem): ResumeProjectItemDto {
  return {
    name: item.name,
    role: item.role,
    description: item.description,
    highlights: [...item.highlights],
    technologies: [...item.technologies],
    url: item.url,
  };
}
