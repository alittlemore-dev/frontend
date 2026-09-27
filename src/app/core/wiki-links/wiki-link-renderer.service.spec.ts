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
    const html = service.render(
      'Read <img src=x onerror="alert(1)"> and [[articles:typed-articles|typed article]].',
      'en',
    );

    expect(html).toContain('<a href="/en/competency/articles/typed-articles">typed article</a>');
    expect(html).not.toContain('onerror');
  });

  it('renders sheet-scoped matrix links and leaves old wiki formats as text', () => {
    const html = service.render(
      '[[matrix:python:how-to-write-function|Python]] and [[matrix:how-to-write-function|Old]] and [[matrix:python/how-to-write-function|Slash]]',
      'ru',
    );

    expect(html).toContain('href="/ru/competency/matrix/questions/python/how-to-write-function"');
    expect(html).toContain('[[matrix:how-to-write-function|Old]]');
    expect(html).toContain('[[matrix:python/how-to-write-function|Slash]]');
    expect(html.match(/<a /g)).toHaveLength(1);
  });

  it('strips script tags, event handlers, and executable URL schemes from rendered markdown', () => {
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
    expect(html).toContain('Text before.');
    expect(html).not.toContain('bad link');
  });
});
