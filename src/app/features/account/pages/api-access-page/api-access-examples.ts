interface ApiAccessExample {
  id: string;
  permission: string;
  command: string;
  file?: { name: string; content: string };
}

const resumeJson = JSON.stringify(
  {
    title: 'Example resume',
    language: 'en',
    content: {
      settings: { dateFormat: 'monthYear' },
      profile: {
        fullName: 'Example Person',
        role: 'Software engineer',
        photoFileId: '',
        location: '',
        email: '',
        phone: '',
        websiteUrl: '',
        linkedinUrl: '',
        githubUrl: '',
        telegram: '',
      },
      summary: { text: '' },
      skills: [],
      experience: [],
      education: [],
      languages: [],
      certifications: [],
      additionalSections: [],
    },
  },
  null,
  2,
);

function request(method: 'GET' | 'POST', path: string, file?: string): string {
  const command = `curl --request ${method} 'https://alittlemore.dev/api/${path}' \\\n  --header 'Authorization: Bearer <YOUR_API_TOKEN>'`;
  return file
    ? `${command} \\\n  --header 'Content-Type: application/json' \\\n  --data-binary @${file}`
    : command;
}

export const API_ACCESS_EXAMPLES: readonly ApiAccessExample[] = [
  {
    id: 'profile',
    permission: 'auth.account.read',
    command: request('GET', 'auth/account/me'),
  },
  {
    id: 'resumeRead',
    permission: 'workspace.resumes.read',
    command: request('GET', 'personal-workspace/resumes?page=1&pageSize=20'),
  },
  {
    id: 'resumeImport',
    permission: 'workspace.resumes.create',
    command: request('POST', 'personal-workspace/resumes', 'resume.json'),
    file: { name: 'resume.json', content: resumeJson },
  },
  {
    id: 'event',
    permission: 'workspace.events.create',
    command: request('POST', 'personal-workspace/events', 'event.json'),
    file: {
      name: 'event.json',
      content: JSON.stringify(
        {
          title: 'Interview',
          description: 'Example calendar event',
          allDay: false,
          start: '2030-06-15T10:00:00Z',
          end: '2030-06-15T11:00:00Z',
          recurrence: { frequency: 'none', untilDate: null },
        },
        null,
        2,
      ),
    },
  },
];
