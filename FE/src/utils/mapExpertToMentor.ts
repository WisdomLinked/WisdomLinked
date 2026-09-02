import type { ExpertCardProps } from '../components/ExpertCard';
import { profileImageFetch } from '../api/api';
import { canonicalLabelsFromMixedServiceEntries } from '../constants/serviceOptions';
import { isBaselineMajor } from '../constants/majorOptions';
import {
  isDisplayImageUrl,
  resolveProfileImageSrc,
  type ProfileImageFetcher,
} from './profileImage';

export function mapExpertToMentor(expert: any): ExpertCardProps {
  const seen = new Set<string>();
  const majors: { label: string; custom: boolean }[] = [];
  const pushMajor = (raw: any, custom: boolean) => {
    const label = String(raw ?? '').trim();
    if (!label) return;
    const key = label.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    majors.push({ label, custom: custom && !isBaselineMajor(label) });
  };
  (expert.keywords || []).forEach((k: any) => pushMajor(k?.value, false));
  (expert.customKeywords || []).forEach((c: any) => pushMajor(c, true));

  const svc = canonicalLabelsFromMixedServiceEntries(expert.services);
  const field = majors[0]?.label || 'General';
  const created = expert.createdAt ? new Date(expert.createdAt).getTime() : 0;
  const isNew = created > 0 && Date.now() - created < 30 * 24 * 60 * 60 * 1000;
  const rawImage = expert.image;
  return {
    id: String(expert._id),
    name: expert.username || expert.email || 'Expert',
    title: expert.title || 'Expert',
    institution:
      (expert.description && String(expert.description).slice(0, 80)) ||
      expert.specialNote ||
      'WisdomLinked expert',
    field,
    majors,
    experience:
      typeof expert.rating === 'number' && expert.rating > 0
        ? `${expert.rating.toFixed(1)}★`
        : '—',
    services: svc,
    image: isDisplayImageUrl(rawImage) ? String(rawImage).trim() : null,
    isNew,
    resume: expert.resume ? String(expert.resume) : null,
    status: expert.status ? String(expert.status) : undefined,
    followerCount:
      typeof expert.followerCount === 'number'
        ? expert.followerCount
        : Array.isArray(expert.followers)
          ? expert.followers.length
          : 0,
    isFollowing: !!expert.isFollowing,
  };
}

export async function mapExpertToMentorWithImage(
  expert: any,
  size: 'small' | 'medium' = 'small',
  fetchProfileImage: ProfileImageFetcher = profileImageFetch as ProfileImageFetcher,
): Promise<ExpertCardProps> {
  const base = mapExpertToMentor(expert);
  if (base.image) return base;

  const src = await resolveProfileImageSrc(expert.image, size, fetchProfileImage);
  return { ...base, image: src };
}
