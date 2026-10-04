import {
  ResumeContent,
  ResumeExperienceItem,
  ResumeProjectItem,
} from '../models/resume-workspace.model';
import {
  ResumeRecommendationContext,
  resumeExportRecommendations,
} from './resume-export-recommendations';

function company(): ResumeExperienceItem {
  return {
    company: 'Company',
    position: 'Engineer',
    companyWebsiteUrl: '',
    location: '',
    startDate: null,
    endDate: null,
    currentStatus: 'notSet',
    summary: '',
    highlights: [],
    technologies: [],
    projects: [],
  };
}

function project(): ResumeProjectItem {
  return {
    name: 'Project',
    role: '',
    teamSize: '',
    scale: '',
    description: '',
    highlights: [],
    technologies: [],
    url: '',
  };
}

function completeContent(): ResumeContent {
  return {
    settings: { dateFormat: 'monthYear', sectionOrder: [], hiddenSections: [] },
    profile: {
      fullName: 'Candidate',
      photoFileId: '',
      photoDataUrl: '',
      role: 'Engineer',
      location: 'Yerevan',
      email: 'candidate@example.com',
      phone: '',
      websiteUrl: '',
      linkedinUrl: '',
      githubUrl: '',
      telegram: '',
    },
    summary: { text: 'Professional profile' },
    skills: [{ category: 'Development', items: ['TypeScript'] }],
    experience: [company()],
    education: [
      {
        institution: 'University',
        degree: '',
        field: '',
        location: '',
        startDate: null,
        endDate: null,
        description: '',
      },
    ],
    languages: [],
    certifications: [
      { name: 'Certificate', issuer: 'Issuer', issuedOn: null, expiresOn: null, credentialUrl: '' },
    ],
    additionalSections: [],
  };
}

const context: ResumeRecommendationContext = {
  theme: 'simple',
  educationHeading: 'Образование',
  estimatedPageCount: 2,
};

describe('resumeExportRecommendations', () => {
  it('does not invent recommendations for a complete compact resume', () => {
    const content = completeContent();
    content.experience = Array.from({ length: 5 }, company);
    content.experience[0].projects = Array.from({ length: 10 }, project);
    content.summary.text = 'Profile '.repeat(1500);
    expect(resumeExportRecommendations(content, context)).toEqual([]);
    expect(resumeExportRecommendations(content, { ...context, estimatedPageCount: null })).toEqual(
      [],
    );
  });

  it('checks actual filling instead of treating empty added entries as content', () => {
    const content = completeContent();
    content.profile.email = ' ';
    content.summary.text = '\n ';
    content.skills[0].items = [' '];
    content.experience[0].company = '';
    content.experience[0].position = '';
    content.education[0].institution = '';
    content.certifications[0].name = '';
    expect(resumeExportRecommendations(content, context).map((item) => item.key)).toEqual([
      'contacts',
      'summary',
      'skills',
      'experience',
      'education',
      'certifications',
    ]);
  });

  it('suppresses completeness recommendations for deliberately hidden sections', () => {
    const content = completeContent();
    content.summary.text = '';
    content.skills = [];
    content.experience = [];
    content.education = [];
    content.certifications = [];
    content.settings.hiddenSections = [
      'summary',
      'skills',
      'experience',
      'education',
      'certifications',
    ];
    expect(resumeExportRecommendations(content, context)).toEqual([]);
  });

  it('includes certification advice only while a visible certification section is empty', () => {
    const content = completeContent();
    content.certifications = [];
    expect(resumeExportRecommendations(content, context)).toEqual([{ key: 'certifications' }]);
    content.certifications = completeContent().certifications;
    expect(resumeExportRecommendations(content, context)).toEqual([]);
    content.certifications = [];
    content.settings.hiddenSections = ['certifications'];
    expect(resumeExportRecommendations(content, context)).toEqual([]);
  });

  it('reports large company and project counts separately with the actual numbers', () => {
    const content = completeContent();
    content.experience = Array.from({ length: 9 }, company);
    content.experience[0].projects = Array.from({ length: 13 }, project);
    content.experience.push({ ...company(), company: '', position: '' });
    content.experience[0].projects.push({ ...project(), name: ' ' });
    expect(resumeExportRecommendations(content, context)).toEqual([
      { key: 'companies', params: { count: 9 } },
      { key: 'projects', params: { count: 13 } },
    ]);
    content.settings.hiddenSections = ['experience'];
    expect(resumeExportRecommendations(content, context)).toEqual([]);
  });

  it('keeps the count recommendations absent at their thresholds', () => {
    const content = completeContent();
    content.experience = Array.from({ length: 8 }, company);
    content.experience[0].projects = Array.from({ length: 12 }, project);
    expect(resumeExportRecommendations(content, context)).toEqual([]);
  });

  it('bases volume advice on the selected rendered document beyond three pages', () => {
    const content = completeContent();
    expect(resumeExportRecommendations(content, { ...context, estimatedPageCount: 3 })).toEqual([]);
    expect(resumeExportRecommendations(content, { ...context, estimatedPageCount: 4 })).toEqual([
      { key: 'length', params: { pages: 4 } },
    ]);
    expect(
      resumeExportRecommendations(content, { ...context, theme: '', estimatedPageCount: 4 }),
    ).toEqual([]);
    expect(
      resumeExportRecommendations(content, { ...context, estimatedPageCount: Number.NaN }),
    ).toEqual([]);
  });

  it.each(['simple', 'accent'] as const)(
    'recognizes imported education in visible additional sections with the %s theme',
    (theme) => {
      const content = completeContent();
      content.education = [];
      content.additionalSections = [
        {
          title: 'Образование',
          items: [{ title: 'Imported University', description: '', url: '' }],
        },
      ];
      expect(resumeExportRecommendations(content, { ...context, theme })).toEqual([]);
      content.settings.hiddenSections = ['additionalSections'];
      expect(resumeExportRecommendations(content, { ...context, theme })).toEqual([
        { key: 'education' },
      ]);
      content.settings.hiddenSections = ['education'];
      expect(resumeExportRecommendations(content, { ...context, theme })).toEqual([]);
    },
  );

  it('uses the document language for imported education and ignores empty imported items', () => {
    const content = completeContent();
    content.education = [];
    content.additionalSections = [
      { title: 'Education', items: [{ title: 'University', description: '', url: '' }] },
    ];
    expect(
      resumeExportRecommendations(content, { ...context, educationHeading: 'Education' }),
    ).toEqual([]);
    content.additionalSections[0].items[0].title = ' ';
    expect(
      resumeExportRecommendations(content, { ...context, educationHeading: 'Education' }),
    ).toEqual([{ key: 'education' }]);
  });

  it('preserves the authored content', () => {
    const content = completeContent();
    const before = JSON.stringify(content);
    resumeExportRecommendations(content, context);
    expect(JSON.stringify(content)).toBe(before);
  });
});
