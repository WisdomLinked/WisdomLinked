import type { MentorCardProps } from '../components/MentorCard';
import { profileImageFetch } from '../api/api';
import { canonicalLabelsFromMixedServiceEntries } from '../constants/serviceOptions';
import {
  isDisplayImageUrl,
  resolveProfileImageSrc,
  type ProfileImageFetcher,
} from './profileImage';

export function mapExpertToMentor(expert: any): MentorCardProps {
  const kw = (expert.keywords || []).map((k: any) => k?.value).filter(Boolean);
  const svc = canonicalLabelsFromMixedServiceEntries(expert.services);
  const field = kw[0] || 'General';
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
    experience:
      typeof expert.rating === 'number' && expert.rating > 0
        ? `${expert.rating.toFixed(1)}★`
        : '—',
    services: svc,
    image: isDisplayImageUrl(rawImage) ? String(rawImage).trim() : null,
    isNew,
    resume: expert.resume ? String(expert.resume) : null,
  };
}

export async function mapExpertToMentorWithImage(
  expert: any,
  size: 'small' | 'medium' = 'small',
  fetchProfileImage: ProfileImageFetcher = profileImageFetch as ProfileImageFetcher,
): Promise<MentorCardProps> {
  const base = mapExpertToMentor(expert);
  if (base.image) return base;

  const src = await resolveProfileImageSrc(expert.image, size, fetchProfileImage);
  return { ...base, image: src };
}
