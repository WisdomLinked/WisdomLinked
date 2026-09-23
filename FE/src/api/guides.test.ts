import { describe, expect, it } from 'vitest';
import { getGuideBySlug, getGuides, selectPublishedGuides } from './guides';
import type { Guide } from '../data/guides/types';

const sample: Guide[] = [
  {
    id: 'a',
    slug: 'hidden',
    title: 'Hidden',
    description: 'Nope',
    icon: 'award',
    order: 0,
    published: false,
    sections: [{ id: 's', title: 'S', content: 'Hi', order: 1 }],
  },
  {
    id: 'b',
    slug: 'visible',
    title: 'Visible',
    description: 'Yes',
    icon: 'graduation',
    order: 2,
    published: true,
    sections: [
      { id: 'late', title: 'Late', content: 'B', order: 2 },
      { id: 'early', title: 'Early', content: 'A', order: 1 },
    ],
  },
];

describe('selectPublishedGuides', () => {
  it('omits unpublished guides and sorts by order', () => {
    const rows = selectPublishedGuides(sample);
    expect(rows.map(g => g.slug)).toEqual(['visible']);
    expect(rows[0].sections.map(s => s.id)).toEqual(['early', 'late']);
  });
});

describe('getGuides / getGuideBySlug', () => {
  it('returns the dummy published guides', async () => {
    const rows = await getGuides();
    expect(rows.map(g => g.slug)).toEqual(['graduate-school-guide', 'scholarship-guide']);
  });

  it('returns a published slug and null for unknown or unpublished', async () => {
    const found = await getGuideBySlug('graduate-school-guide');
    expect(found?.title).toBe('Graduate School Guide');
    expect(found?.sections[0].title).toBe('Choosing a Program');
    expect(await getGuideBySlug('does-not-exist')).toBeNull();
    expect(await getGuideBySlug('hidden')).toBeNull();
  });
});
