import { mockGuides } from '../data/guides/mockGuides';
import type { Guide } from '../data/guides/types';

export type { Guide, GuideSection, GuideIcon } from '../data/guides/types';

export function selectPublishedGuides(guides: Guide[]): Guide[] {
  return guides
    .filter(guide => guide.published)
    .map(guide => ({
      ...guide,
      sections: [...guide.sections].sort((a, b) => a.order - b.order),
    }))
    .sort((a, b) => a.order - b.order);
}

/**
 * Public guide list.
 * Future: `const res = await api.get('resources'); return selectPublishedGuides(res.data);`
 */
export async function getGuides(): Promise<Guide[]> {
  return selectPublishedGuides(mockGuides);
}

/**
 * Public guide by slug, or null if missing / unpublished.
 * Future: `const res = await api.get(\`resources/${slug}\`); return res.data;`
 */
export async function getGuideBySlug(slug: string): Promise<Guide | null> {
  const normalized = String(slug || '').trim();
  if (!normalized) return null;
  const match = selectPublishedGuides(mockGuides).find(guide => guide.slug === normalized);
  return match || null;
}
