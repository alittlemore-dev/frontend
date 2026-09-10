import { TestBed } from '@angular/core/testing';
import { WikiLinkRendererService } from './wiki-link-renderer.service';

describe('WikiLinkRendererService', () => {
  let service: WikiLinkRendererService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [WikiLinkRendererService],
    });
    service = TestBed.inject(WikiLinkRendererService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders typed wiki links as sanitized localized internal links', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const html = service.render(
      'Read <img src=x onerror="alert(1)"> and [[articles:typed-articles|typed article]].',
      'en',
    );

    expect(html).toContain('<a href="/en/articles/typed-articles">typed article</a>');
    expect(html).not.toContain('onerror');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('strips script tags, event handlers, and executable URL schemes from rendered markdown', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const html = service.render(
      [
        'Text before.',
        '<script>alert("script")</script>',
        '<img src=x onerror="alert(1)">',
        '<a href="javascript:alert(2)">bad link</a>',
      ].join('\n'),
      'en',
    );

    expect(html).not.toContain('<script');
    expect(html).not.toContain('</script>');
    expect(html).not.toContain('alert("script")');
    expect(html).not.toContain('onerror');
    expect(html).not.toMatch(/href=["']javascript:/i);
    expect(html).toContain('bad link');
    expect(warnSpy).toHaveBeenCalled();
  });
});
