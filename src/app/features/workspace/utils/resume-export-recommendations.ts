import { ResumeContent, ResumeTheme } from '../models/resume-workspace.model';

export interface ResumeRecommendationContext {
  theme: ResumeTheme | '';
  educationHeading: string;
  estimatedPageCount: number | null;
}

export interface ResumeExportRecommendation {
  key:
    | 'contacts'
    | 'summary'
    | 'skills'
    | 'experience'
    | 'education'
    | 'certifications'
    | 'companies'
    | 'projects'
    | 'length';
  params?: Record<string, number>;
}

export function resumeExportRecommendations(
  content: ResumeContent,
  context: ResumeRecommendationContext,
): ResumeExportRecommendation[] {
  const hidden = new Set(content.settings.hiddenSections);
  const recommendations: ResumeExportRecommendation[] = [];
  if (
    ![
      content.profile.email,
      content.profile.phone,
      content.profile.telegram,
      content.profile.websiteUrl,
      content.profile.linkedinUrl,
      content.profile.githubUrl,
    ].some((value) => value.trim())
  )
    recommendations.push({ key: 'contacts' });
  if (!hidden.has('summary') && !content.summary.text.trim())
    recommendations.push({ key: 'summary' });
  if (
    !hidden.has('skills') &&
    !content.skills.some((group) => group.items.some((item) => item.trim()))
  )
    recommendations.push({ key: 'skills' });

  const experience = hidden.has('experience') ? [] : content.experience;
  const companies = experience.filter((item) => item.company.trim() || item.position.trim());
  const projects = experience.flatMap((item) => item.projects).filter((item) => item.name.trim());
  if (!hidden.has('experience') && !companies.length && !projects.length)
    recommendations.push({ key: 'experience' });

  const importedEducationVisible =
    !hidden.has('additionalSections') && (context.theme !== 'accent' || !hidden.has('education'));
  const hasEducation =
    content.education.some((item) => item.institution.trim()) ||
    (importedEducationVisible &&
      content.additionalSections.some(
        (section) =>
          section.title === context.educationHeading &&
          section.items.some((item) => item.title.trim()),
      ));
  if (!hidden.has('education') && !hasEducation) recommendations.push({ key: 'education' });
  if (!hidden.has('certifications') && !content.certifications.some((item) => item.name.trim()))
    recommendations.push({ key: 'certifications' });

  if (companies.length > 8)
    recommendations.push({ key: 'companies', params: { count: companies.length } });
  if (projects.length > 12)
    recommendations.push({ key: 'projects', params: { count: projects.length } });
  if (
    context.theme &&
    context.estimatedPageCount !== null &&
    Number.isFinite(context.estimatedPageCount) &&
    context.estimatedPageCount > 3
  )
    recommendations.push({ key: 'length', params: { pages: context.estimatedPageCount } });
  return recommendations;
}
