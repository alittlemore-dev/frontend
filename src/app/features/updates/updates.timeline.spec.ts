import { groupUpdateEntries, UPDATES_TIMELINE_ENTRIES } from './updates.timeline';

describe('updates timeline', () => {
  it('groups localized flat entries by month in reverse chronological order', () => {
    const groups = groupUpdateEntries(
      [
        {
          id: 'older',
          month: '2026-05',
          order: 20,
          title: { ru: 'Старое', en: 'Older' },
          summary: { ru: 'Старое описание', en: 'Older summary' },
          tagIds: ['content'],
        },
        {
          id: 'newer-second',
          month: '2026-07',
          order: 20,
          title: { ru: 'Новое второе', en: 'Newer second' },
          summary: { ru: 'Новое второе описание', en: 'Newer second summary' },
          tagIds: ['frontend'],
        },
        {
          id: 'newer-first',
          month: '2026-07',
          order: 10,
          title: { ru: 'Новое первое', en: 'Newer first' },
          summary: { ru: 'Новое первое описание', en: 'Newer first summary' },
          tagIds: ['frontend'],
        },
      ],
      'ru',
      'ru-RU',
    );

    expect(groups.map((group) => group.datetime)).toEqual(['2026-07', '2026-05']);
    expect(groups[0]?.label).toBe('Июль 2026');
    expect(groups[0]?.entries.map((entry) => entry.id)).toEqual(['newer-first', 'newer-second']);
    expect(groups[1]?.entries.map((entry) => entry.id)).toEqual(['older']);
    expect(groups[0]?.entries[0]?.title).toBe('Новое первое');
    expect(groups[0]?.entries[0]?.summary).toBe('Новое первое описание');
    expect(groups[0]?.entries[0]?.tagKeys).toEqual(['updates.tag.frontend']);
  });

  it('localizes entry text and month labels without per-month i18n keys', () => {
    const groups = groupUpdateEntries(
      [
        {
          id: 'release',
          month: '2026-07',
          order: 10,
          title: { ru: 'Релиз', en: 'Release' },
          summary: { ru: 'Описание релиза', en: 'Release summary' },
          tagIds: ['delivery'],
        },
      ],
      'en',
      'en-US',
    );

    expect(groups).toEqual([
      {
        datetime: '2026-07',
        label: 'July 2026',
        entries: [
          {
            id: 'release',
            title: 'Release',
            summary: 'Release summary',
            tagKeys: ['updates.tag.delivery'],
          },
        ],
      },
    ]);
  });

  it('keeps entries as typed localized authored content instead of backend i18n keys', () => {
    expect(UPDATES_TIMELINE_ENTRIES.length).toBeGreaterThan(0);

    for (const entry of UPDATES_TIMELINE_ENTRIES) {
      const entryRecord = entry as unknown as Record<string, unknown>;

      expect(entry.id).toMatch(/^[a-z0-9-]+$/);
      expect(entry.month).toMatch(/^\d{4}-\d{2}$/);
      expect(Number.isFinite(entry.order)).toBe(true);
      expect(entry.title.ru).toBeTruthy();
      expect(entry.title.en).toBeTruthy();
      expect(entry.summary.ru).toBeTruthy();
      expect(entry.summary.en).toBeTruthy();
      expect(entry.tagIds.length).toBeGreaterThan(0);
      expect('titleKey' in entryRecord).toBe(false);
      expect('summaryKey' in entryRecord).toBe(false);
    }
  });
});
