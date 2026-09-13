import {
  createWikiLinkTargetLookup,
  findMissingWikiLinkTargets,
  parseWikiLinks,
} from './wiki-links';

describe('wiki links', () => {
  it('parses typed slug-only and labelled links', () => {
    expect(
      parseWikiLinks(
        'Read [[articles:typed-articles]] and [[matrix:angular-forms|Angular forms]].',
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
        slug: 'angular-forms',
        label: 'Angular forms',
        raw: '[[matrix:angular-forms|Angular forms]]',
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
      slug: 'angular-forms',
      label: 'Angular forms',
      path: '/en/competency/matrix/questions/angular-forms',
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
  });

  it('reports missing typed targets once', () => {
    const missing = findMissingWikiLinkTargets({
      markdown:
        'Read [[articles:typed-articles]], [[matrix:missing-question]], and [[matrix:missing-question|again]].',
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
              slug: 'known-question',
              title: 'Known question',
              publishStatus: 'Draft',
            },
          ],
        },
      ]),
    });

    expect(missing).toEqual(['matrix:missing-question']);
  });
});
