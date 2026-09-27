import { CSP_NONCE, PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MarkdownEditorComponent as DesignSystemMarkdownEditorComponent } from '@alittlemore.dev/design-system/markdown-editor';
import { firstValueFrom, of } from 'rxjs';
import { provideI18nTesting } from '../../testing/i18n-testing';
import { WikiLinkTargetsService } from '../wiki-links/wiki-link-targets.service';
import { createWikiLinkTargetRegistry } from '../wiki-links/wiki-links';
import { EditorImageUploadService } from './editor-image-upload.service';
import { MarkdownEditorComponent } from './markdown-editor.component';

describe('application Markdown editor integration', () => {
  let fixture: ComponentFixture<MarkdownEditorComponent>;
  const uploadEditorImage = jest.fn();
  const getTargets = jest.fn();

  async function create(platform = 'browser'): Promise<void> {
    uploadEditorImage.mockReturnValue(of('/api/files/public/image.png'));
    getTargets.mockReturnValue(of(createWikiLinkTargetRegistry([])));
    await TestBed.configureTestingModule({
      imports: [MarkdownEditorComponent],
      providers: [
        provideI18nTesting(),
        { provide: CSP_NONCE, useValue: 'editor-integration-nonce' },
        { provide: PLATFORM_ID, useValue: platform },
        { provide: EditorImageUploadService, useValue: { uploadEditorImage } },
        { provide: WikiLinkTargetsService, useValue: { getTargets } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(MarkdownEditorComponent);
    fixture.componentRef.setInput('value', 'Read [[matrix:angular:angular-forms|Angular forms]].');
    fixture.componentRef.setInput('language', 'ru');
    fixture.componentRef.setInput('accessibleLabel', 'Article body');
    fixture.componentRef.setInput('imageUploadsEnabled', true);
    fixture.detectChanges();
  }

  afterEach(() => {
    fixture?.destroy();
    jest.clearAllMocks();
  });

  it('renders translated controls and resolves preview links using the content language', async () => {
    await create();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe(
      'Режим Markdown-редактора',
    );
    expect(host.querySelector('[role="textbox"]')?.getAttribute('aria-label')).toBe('Article body');
    expect(getTargets).toHaveBeenCalledWith('ru');
    fixture.componentRef.setInput('language', 'en');
    fixture.detectChanges();
    expect(getTargets).toHaveBeenCalledWith('en');
    host.querySelector<HTMLButtonElement>('[data-testid="markdown-editor-preview-tab"]')!.click();
    fixture.detectChanges();
    expect(host.querySelector('a')?.getAttribute('href')).toBe(
      '/en/competency/matrix/questions/angular/angular-forms',
    );
  });

  it('offers sheet-scoped matrix targets in editor suggestions', async () => {
    await create();
    getTargets.mockReturnValue(
      of(
        createWikiLinkTargetRegistry([
          {
            type: 'matrix',
            items: [
              {
                slug: 'python:how-to-write-function',
                title: 'Как написать функцию',
                publishStatus: 'Published',
              },
            ],
          },
        ]),
      ),
    );
    const editor = fixture.debugElement.query(By.directive(DesignSystemMarkdownEditorComponent))
      .componentInstance as DesignSystemMarkdownEditorComponent;
    const config = editor.wikiLinks();

    expect(config).not.toBeNull();
    expect(await firstValueFrom(config!.loadTargets())).toEqual([
      {
        namespace: 'matrix',
        targets: [
          {
            key: 'python:how-to-write-function',
            label: 'Как написать функцию',
            description: null,
            badge: 'Опубликовано',
          },
        ],
      },
    ]);
  });

  it('maps image transport results into the emitted Markdown document', async () => {
    await create();
    const changed = jest.fn();
    fixture.componentInstance.valueChange.subscribe(changed);
    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['image'], 'test.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();
    expect(uploadEditorImage).toHaveBeenCalledWith(file);
    expect(changed).toHaveBeenCalledWith(expect.stringContaining('/api/files/public/image.png'));
  });

  it('disables upload integration where the application forbids inline images', async () => {
    await create();
    fixture.componentRef.setInput('imageUploadsEnabled', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input[type="file"]')).toBeNull();
    expect(uploadEditorImage).not.toHaveBeenCalled();
  });

  it('renders on the server without editor setup, target loading or image requests', async () => {
    await create('server');
    expect(fixture.nativeElement.querySelector('[role="tablist"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.cm-editor')).toBeNull();
    expect(getTargets).not.toHaveBeenCalled();
    expect(uploadEditorImage).not.toHaveBeenCalled();
  });
});
