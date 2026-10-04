import {
  ResumeContent,
  ResumeDateFormat,
  ResumeExportFormat,
  ResumeLanguage,
  ResumePayload,
  ResumeTheme,
  ResumeSectionKey,
  resumeSectionOrder,
} from '../../models/resume-workspace.model';

export interface ResumeDocumentBlock {
  kind:
    | 'name'
    | 'photo'
    | 'role'
    | 'location'
    | 'contacts'
    | 'section'
    | 'title'
    | 'body'
    | 'bullet'
    | 'company'
    | 'muted'
    | 'band'
    | 'project'
    | 'link';
  text: string;
  detail?: string;
  lines?: readonly string[];
  contacts?: readonly { label: string; value: string }[];
}

type Translate = (key: string) => string;

export function formatResumeDocumentDate(
  value: string | null,
  format: ResumeDateFormat,
  language: ResumeLanguage,
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value?.trim() ?? '');
  if (!match) return '';
  const [, year, month, day] = match;
  switch (format) {
    case 'year':
      return year;
    case 'monthYearNumeric':
      return `${month}.${year}`;
    case 'fullDate':
      return language === 'ru' ? `${day}.${month}.${year}` : `${month}/${day}/${year}`;
    case 'monthYear': {
      const months =
        language === 'ru'
          ? [
              'янв.',
              'февр.',
              'мар.',
              'апр.',
              'май',
              'июн.',
              'июл.',
              'авг.',
              'сент.',
              'окт.',
              'нояб.',
              'дек.',
            ]
          : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[Number(month) - 1]} ${year}`;
    }
  }
}

// Mirrors the content order and paragraph roles of the PDF/Word export templates.
export function resumeDocumentBlocks(
  payload: ResumePayload,
  theme: ResumeTheme,
  format: ResumeExportFormat,
  t: Translate,
): readonly ResumeDocumentBlock[] {
  const content = payload.content;
  const profile = content.profile;
  const blocks: ResumeDocumentBlock[] = [];
  const sectionBlocks = new Map<ResumeSectionKey, ResumeDocumentBlock[]>();
  const collect = (key: ResumeSectionKey, render: () => void): void => {
    const start = blocks.length;
    render();
    sectionBlocks.set(key, blocks.splice(start));
  };
  const accent = theme === 'accent';
  const word = format === 'docx';
  const add = (kind: ResumeDocumentBlock['kind'], text: string, detail?: string): void => {
    blocks.push({ kind, text, detail });
  };
  const optional = (kind: ResumeDocumentBlock['kind'], text: string): void => {
    if (text) add(kind, text);
  };
  const label = (key: string): string => t(`resumeWorkspace.document.${key}`);
  const date = (value: string | null): string =>
    formatResumeDocumentDate(value, content.settings.dateFormat, payload.language);
  const range = (start: string | null, end: string | null, current = false): string =>
    [date(start), current ? label('present') : date(end)].filter(Boolean).join(' - ');
  const photo = (): void => {
    if (profile.photoDataUrl) add('photo', profile.photoDataUrl);
  };
  if (!word) photo();
  add('name', profile.fullName || payload.title);
  if (word) photo();
  optional('role', profile.role);
  if (accent && !word) optional('location', profile.location);
  const contacts = [
    { label: label('phone'), value: profile.phone },
    { label: 'Email', value: profile.email },
    { label: 'Telegram', value: profile.telegram },
    { label: 'LinkedIn', value: profile.linkedinUrl },
    { label: 'GitHub', value: profile.githubUrl },
    { label: label('website'), value: profile.websiteUrl },
  ].filter((contact) => contact.value);
  if (accent && contacts.length) {
    add('section', label('contacts'));
    blocks.push({ kind: 'contacts', text: '', contacts });
  } else if (!accent) {
    optional(
      'contacts',
      [
        profile.location,
        profile.email,
        profile.phone,
        profile.websiteUrl,
        profile.linkedinUrl,
        profile.githubUrl,
        profile.telegram,
      ]
        .filter(Boolean)
        .join(' | '),
    );
  }
  collect('summary', () => {
    if (content.summary.text) {
      add('section', label('summary'));
      add('body', content.summary.text);
    }
  });
  collect('skills', () => {
    if (content.skills.length) {
      add('section', label('skills'));
      for (const group of content.skills)
        add('body', `${group.category}: ${group.items.join(', ')}`);
    }
  });
  const education = (): void => {
    if (!content.education.length) return;
    add('section', label('education'));
    for (const item of content.education) {
      const details = [item.degree, item.field].filter(Boolean).join(' | ');
      const locationPeriod = [item.location, range(item.startDate, item.endDate)]
        .filter(Boolean)
        .join(' | ');
      add(
        'title',
        accent ? item.institution : [item.institution, details].filter(Boolean).join(' | '),
      );
      if (accent && word) optional('body', [details, locationPeriod].filter(Boolean).join(' | '));
      else {
        if (accent) optional('body', details);
        optional(accent ? 'muted' : 'body', locationPeriod);
      }
      optional('body', item.description);
    }
  };
  const additional = (sections: ResumeContent['additionalSections']): void => {
    for (const section of sections) {
      add('section', section.title);
      for (const item of section.items) {
        add('title', item.title);
        optional('body', item.description);
        optional(accent ? 'link' : 'body', item.url);
      }
    }
  };
  const languages = (): void => {
    if (!content.languages.length) return;
    if (accent)
      add(
        'muted',
        `${label('languages')}: ${content.languages.map((item) => `${item.name} — ${item.proficiency}`).join(', ')}`,
      );
    else {
      add('section', label('languages'));
      for (const item of content.languages) add('body', `${item.name} | ${item.proficiency}`);
    }
  };
  collect('education', () => {
    education();
    if (
      accent &&
      !content.education.length &&
      !content.settings.hiddenSections.includes('additionalSections')
    )
      additional(
        content.additionalSections.filter((section) => section.title === label('education')),
      );
  });
  collect('languages', languages);
  collect('experience', () => {
    if (content.experience.length) {
      add('section', label('experience'));
      for (const item of content.experience) {
        const period = range(item.startDate, item.endDate, item.currentStatus === 'current');
        if (accent) {
          const lines = [
            item.companyWebsiteUrl,
            [item.position, item.location].filter(Boolean).join(' | '),
            item.summary,
          ].filter(Boolean);
          blocks.push({
            kind: 'company',
            text: item.company,
            detail: period,
            lines: word ? undefined : lines,
          });
          if (word) for (const line of lines) add('muted', line);
        } else {
          add('title', `${item.position} | ${item.company}`);
          optional('body', item.companyWebsiteUrl);
          optional('body', [item.location, period].filter(Boolean).join(' | '));
          optional('body', item.summary);
        }
        for (const highlight of item.highlights) add('bullet', highlight);
        if (item.technologies.length)
          add(
            accent ? 'band' : 'body',
            `${label('technologies')}: ${item.technologies.join(', ')}`,
          );
        for (const project of item.projects) {
          const role = project.role || item.position;
          const suffix = role && (!accent || role !== item.position) ? ` | ${role}` : '';
          add(accent ? 'project' : 'title', `${label('project')}: ${project.name}${suffix}`);
          const band = accent ? 'band' : 'body';
          if (project.teamSize) add(band, `${label('teamSize')}: ${project.teamSize}`);
          if (project.scale) add(band, `${label('scale')}: ${project.scale}`);
          if (!accent) optional('body', project.description);
          for (const highlight of project.highlights) add('bullet', highlight);
          if (accent) optional('band', project.description);
          if (project.technologies.length)
            add(band, `${label('technologies')}: ${project.technologies.join(', ')}`);
          optional(accent ? 'link' : 'body', project.url);
        }
      }
    }
  });
  collect('certifications', () => {
    if (content.certifications.length) {
      add('section', label('certifications'));
      for (const item of content.certifications) {
        add('title', `${item.name} | ${item.issuer}`);
        optional(
          'body',
          [
            item.issuedOn ? `${label('issued')}: ${date(item.issuedOn)}` : '',
            item.expiresOn ? `${label('expires')}: ${date(item.expiresOn)}` : '',
          ]
            .filter(Boolean)
            .join(' | '),
        );
        optional(accent ? 'link' : 'body', item.credentialUrl);
      }
    }
  });
  collect('additionalSections', () =>
    additional(
      accent
        ? content.additionalSections.filter(
            (section) => section.title !== label('education') || content.education.length,
          )
        : content.additionalSections,
    ),
  );
  for (const key of resumeSectionOrder(content.settings, theme)) {
    if (!content.settings.hiddenSections.includes(key))
      blocks.push(...(sectionBlocks.get(key) ?? []));
  }
  return blocks;
}
