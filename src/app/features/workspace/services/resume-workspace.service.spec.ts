import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiClient } from '../../../core/http/api-client.service';
import { ResumePayload } from '../models/resume-workspace.model';
import { ResumeWorkspaceService } from './resume-workspace.service';

const RESUME_ID = '00000000000000000000000000000007';

describe('ResumeWorkspaceService', () => {
  let service: ResumeWorkspaceService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ResumeWorkspaceService,
        ApiClient,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(ResumeWorkspaceService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads protected resumes with explicit pagination', () => {
    let firstTitle = '';
    let firstLanguage = '';

    service.listResumes({ page: 2, pageSize: 20 }).subscribe((list) => {
      firstTitle = list.resumes[0].title;
      firstLanguage = list.resumes[0].language;
    });

    const listReq = httpMock.expectOne((request) =>
      request.url.endsWith('/api/personal-workspace/resumes'),
    );
    expect(listReq.request.method).toBe('GET');
    expect(listReq.request.params.get('page')).toBe('2');
    expect(listReq.request.params.get('pageSize')).toBe('20');
    listReq.flush({
      totalCount: 1,
      totalPages: 1,
      resumes: [resumeDto()],
    });

    expect(firstTitle).toBe('Backend resume');
    expect(firstLanguage).toBe('en');
  });

  it('loads resume detail through the protected endpoint', () => {
    let fullName = '';

    service.getResume(RESUME_ID).subscribe((resume) => {
      fullName = resume.content.profile.fullName;
    });

    const detailReq = httpMock.expectOne((request) =>
      request.url.endsWith(`/api/personal-workspace/resumes/${RESUME_ID}`),
    );
    expect(detailReq.request.method).toBe('GET');
    detailReq.flush(resumeDto());

    expect(fullName).toBe('Candidate Name');
  });

  it('creates, updates, and deletes resumes through protected endpoints', () => {
    const payload = resumePayload();

    service.createResume(payload).subscribe((resume) => {
      expect(resume.id).toBe(RESUME_ID);
    });
    const createReq = httpMock.expectOne((request) =>
      request.url.endsWith('/api/personal-workspace/resumes'),
    );
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.body).toEqual({
      ...payload,
      content: {
        ...payload.content,
        profile: { ...payload.content.profile, photoDataUrl: undefined },
      },
    });
    createReq.flush(resumeDto());

    service.updateResume(RESUME_ID, payload).subscribe((resume) => {
      expect(resume.title).toBe('Backend resume');
    });
    const updateReq = httpMock.expectOne((request) =>
      request.url.endsWith(`/api/personal-workspace/resumes/${RESUME_ID}`),
    );
    expect(updateReq.request.method).toBe('PUT');
    expect(updateReq.request.body).toEqual({
      ...payload,
      content: {
        ...payload.content,
        profile: { ...payload.content.profile, photoDataUrl: undefined },
      },
    });
    updateReq.flush(resumeDto());

    service.deleteResume(RESUME_ID).subscribe();
    const deleteReq = httpMock.expectOne((request) =>
      request.url.endsWith(`/api/personal-workspace/resumes/${RESUME_ID}`),
    );
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush(null);
  });

  it('exports current resume payload as a blob through the protected endpoint', () => {
    const payload = resumePayload();
    let exportedBlob: Blob | null = null;
    let pageCount: number | null = null;

    service.exportResume(RESUME_ID, 'pdf', 'accent', payload).subscribe((download) => {
      exportedBlob = download.blob;
      pageCount = download.pageCount;
    });

    const exportReq = httpMock.expectOne((request) =>
      request.url.endsWith(`/api/personal-workspace/resumes/${RESUME_ID}/export`),
    );
    expect(exportReq.request.method).toBe('POST');
    expect(exportReq.request.responseType).toBe('blob');
    expect(exportReq.request.body).toEqual({
      format: 'pdf',
      theme: 'accent',
      ...payload,
      content: {
        ...payload.content,
        profile: { ...payload.content.profile, photoDataUrl: undefined },
      },
    });
    exportReq.flush(new Blob(['resume'], { type: 'application/pdf' }), {
      headers: { 'X-Resume-Page-Count': '3' },
    });

    expect(exportedBlob?.type).toBe('application/pdf');
    expect(pageCount).toBe(3);
  });

  it('uploads and reads a private resume photo through protected endpoints', () => {
    const photo = new Blob(['jpeg'], { type: 'image/jpeg' });
    service.uploadPhoto(RESUME_ID, photo).subscribe((resume) => {
      expect(resume.id).toBe(RESUME_ID);
    });
    const upload = httpMock.expectOne((request) =>
      request.url.endsWith(`/api/personal-workspace/resumes/${RESUME_ID}/photo`),
    );
    expect(upload.request.method).toBe('POST');
    expect(upload.request.body).toBeInstanceOf(FormData);
    expect((upload.request.body as FormData).get('file')).toBeInstanceOf(Blob);
    upload.flush(resumeDto());

    service.getPhoto(RESUME_ID).subscribe((blob) => {
      expect(blob.type).toBe('image/jpeg');
    });
    const download = httpMock.expectOne((request) =>
      request.url.endsWith(`/api/personal-workspace/resumes/${RESUME_ID}/photo`),
    );
    expect(download.request.method).toBe('GET');
    download.flush(photo);
  });

  it('maps nested resume content without sharing mutable DTO arrays', () => {
    let payloadItems: readonly string[] = [];
    let payloadProjectTechnologies: readonly string[] = [];
    const dto = resumeDto();

    service.getResume(RESUME_ID).subscribe((resume) => {
      payloadItems = resume.content.skills[0].items;
      payloadProjectTechnologies = resume.content.experience[0].projects[0].technologies;
      resume.content.skills[0].items.push('TypeScript');
      resume.content.experience[0].projects[0].technologies.push('Angular');
    });

    const detailReq = httpMock.expectOne((request) =>
      request.url.endsWith(`/api/personal-workspace/resumes/${RESUME_ID}`),
    );
    detailReq.flush(dto);

    expect(payloadItems).toEqual(['Python', 'PostgreSQL', 'TypeScript']);
    expect(payloadProjectTechnologies).toEqual(['Litestar', 'Angular']);
    expect(dto.content.skills[0].items).toEqual(['Python', 'PostgreSQL']);
    expect(dto.content.experience[0].projects[0].technologies).toEqual(['Litestar']);
  });
});

function resumePayload(): ResumePayload {
  return {
    title: 'Backend resume',
    language: 'en',
    content: resumeContent(),
  };
}

function resumeDto(): {
  id: string;
  title: string;
  language: 'en';
  content: ReturnType<typeof resumeContent>;
  createdAt: string;
  updatedAt: string;
} {
  return {
    id: RESUME_ID,
    title: 'Backend resume',
    language: 'en',
    content: resumeContent(),
    createdAt: '2026-01-01T03:04:05+00:00',
    updatedAt: '2026-01-02T03:04:05+00:00',
  };
}

function resumeContent(): ResumePayload['content'] {
  return {
    profile: {
      fullName: 'Candidate Name',
      photoFileId: '',
      photoDataUrl: '',
      role: 'Engineer',
      location: '',
      email: '',
      phone: '',
      websiteUrl: '',
      linkedinUrl: '',
      githubUrl: '',
      telegram: '',
    },
    summary: {
      text: 'Short experience summary.',
    },
    skills: [
      {
        category: 'Backend',
        items: ['Python', 'PostgreSQL'],
      },
    ],
    experience: [
      {
        company: 'Company',
        companyWebsiteUrl: '',
        position: 'Engineer',
        location: '',
        startDate: '2020-01-01',
        endDate: null,
        currentStatus: 'current',
        summary: 'Built a platform.',
        highlights: ['Reduced latency'],
        technologies: ['Python'],
        projects: [
          {
            name: 'Portfolio',
            role: 'Creator',
            teamSize: '',
            scale: '',
            description: 'Site and knowledge base',
            highlights: ['CSR SPA shell'],
            technologies: ['Litestar'],
            url: 'https://example.com',
          },
        ],
      },
    ],
    education: [],
    languages: [],
    certifications: [],
    additionalSections: [],
  };
}
