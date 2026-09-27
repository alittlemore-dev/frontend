import {
  createWikiLinkTargetLookup,
  findMissingWikiLinkTargets,
  parseWikiLinks,
  replaceWikiLinksWithPlainText,
} from './wiki-links';

describe('wiki links', () => {
  it('parses article and sheet-scoped matrix links', () => {
    expect(
      parseWikiLinks(
        'Read [[articles:typed-articles]] and [[matrix:angular:angular-forms|Angular forms]].',
      ),
    ).toEqual([
      {
        type: 'articles',
        slug: 'typed-articles',
        label: 'typed-articles',
        raw: '[[articles:typed-articles]]',
      },
      {
        type: 'matrix',
        slug: 'angular:angular-forms',
        label: 'Angular forms',
        raw: '[[matrix:angular:angular-forms|Angular forms]]',
      },
    ]);
  });

  it.each([
    {
      type: 'articles' as const,
      slug: 'typed-articles',
      label: 'Typed article',
      path: '/en/competency/articles/typed-articles',
    },
    {
      type: 'matrix' as const,
      slug: 'angular:angular-forms',
      label: 'Angular forms',
      path: '/en/competency/matrix/questions/angular/angular-forms',
    },
  ])('parses an escaped label separator for $type links', (link) => {
    const markdown = `[[${link.type}:${link.slug}\\|${link.label}]]`;

    expect(parseWikiLinks(markdown)).toEqual([
      {
        type: link.type,
        slug: link.slug,
        label: link.label,
        raw: markdown,
      },
    ]);
  });

  it('ignores legacy untyped and unknown-prefixed wiki links', () => {
    expect(
      parseWikiLinks('Read [[typed-articles]], [[unknown:typed-articles]], and [[articles:OK]].'),
    ).toEqual([]);
    expect(
      parseWikiLinks(
        '[[articles:folder/article]] [[matrix:question]] [[matrix:angular/question]] [[matrix:too:many:segments]]',
      ),
    ).toEqual([]);
  });

  it('reports missing typed targets once', () => {
    const missing = findMissingWikiLinkTargets({
      markdown:
        'Read [[articles:typed-articles]], [[matrix:python:missing-question]], and [[matrix:python:missing-question|again]].',
      availableTargets: createWikiLinkTargetLookup([
        {
          type: 'articles',
          items: [
            {
              slug: 'typed-articles',
              title: 'Typed articles',
              publishStatus: 'Published',
            },
          ],
        },
        {
          type: 'matrix',
          items: [
            {
              slug: 'python:known-question',
              title: 'Known question',
              publishStatus: 'Draft',
            },
          ],
        },
      ]),
    });

    expect(missing).toEqual(['matrix:python:missing-question']);
  });

  it('uses labels for sheet-scoped links in plain text and leaves old formats untouched', () => {
    expect(
      replaceWikiLinksWithPlainText(
        '[[matrix:python:question|Python question]] [[matrix:question|Old]]',
      ),
    ).toBe('Python question [[matrix:question|Old]]');
  });
});
