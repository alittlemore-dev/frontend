import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideI18nTesting } from '../../testing/i18n-testing';
import { MarkdownEditorComponent } from './workspace-markdown-editor.component';

describe('workspace Markdown editor integration', () => {
  let fixture: ComponentFixture<MarkdownEditorComponent>;
  const upload = jest.fn();
  const loadPreview = jest.fn();

  beforeEach(async () => {
    upload.mockReturnValue(
      of({ markdownUrl: '/api/knowledge/files/private/content#fileId=private' }),
    );
    loadPreview.mockReturnValue(of(new Blob(['private image'], { type: 'image/webp' })));
    await TestBed.configureTestingModule({
      imports: [MarkdownEditorComponent],
      providers: [provideI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(MarkdownEditorComponent);
    fixture.componentRef.setInput('value', 'Private note');
    fixture.componentRef.setInput('language', 'ru');
    fixture.componentRef.setInput('accessibleLabel', 'Private description');
    fixture.componentRef.setInput('imageCapability', {
      acceptedMimeTypes: ['image/png'],
      upload,
      loadPreview,
    });
    fixture.componentRef.setInput('uploadInteractionsDisabled', false);
    fixture.componentRef.setInput('imagePreviewRevision', 0);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    jest.clearAllMocks();
  });

  it('maps private upload results to stable Markdown and forwards upload pending state', () => {
    const changed = jest.fn();
    const pending = jest.fn();
    fixture.componentInstance.valueChange.subscribe(changed);
    fixture.componentInstance.imageUploadPendingChange.subscribe(pending);
    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['image'], 'private.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();
    expect(upload).toHaveBeenCalledWith(file);
    expect(changed).toHaveBeenCalledWith(
      expect.stringContaining('/api/knowledge/files/private/content#fileId=private'),
    );
    expect(pending).toHaveBeenLastCalledWith(false);
  });

  it('resolves protected previews through the bound loader and refreshes attachment revisions', () => {
    const createDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    const revokeDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: () => 'blob:private-preview',
    });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
    try {
      const source = '/api/knowledge/files/private/content#fileId=private';
      fixture.componentRef.setInput('value', `![Private photo](${source})`);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      host.querySelector<HTMLButtonElement>('[data-testid="markdown-editor-preview-tab"]')!.click();
      fixture.detectChanges();
      expect(loadPreview).toHaveBeenCalledWith(source);
      expect(
        host
          .querySelector('[data-testid="markdown-editor-preview-content"] img')
          ?.getAttribute('src'),
      ).toBe('blob:private-preview');
      loadPreview.mockClear();
      fixture.componentRef.setInput('imagePreviewRevision', 1);
      fixture.detectChanges();
      expect(loadPreview).toHaveBeenCalledWith(source);
    } finally {
      fixture.destroy();
      if (createDescriptor) Object.defineProperty(URL, 'createObjectURL', createDescriptor);
      else Reflect.deleteProperty(URL, 'createObjectURL');
      if (revokeDescriptor) Object.defineProperty(URL, 'revokeObjectURL', revokeDescriptor);
      else Reflect.deleteProperty(URL, 'revokeObjectURL');
    }
  });

  it('disables uploading when the domain has no bound image capability', () => {
    fixture.componentRef.setInput('imageCapability', null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input[type="file"]')).toBeNull();
    expect(upload).not.toHaveBeenCalled();
    expect(loadPreview).not.toHaveBeenCalled();
  });

  it('blocks new upload interactions while the document is saving', () => {
    fixture.componentRef.setInput('uploadInteractionsDisabled', true);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });
});
