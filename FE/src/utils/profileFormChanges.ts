import { arraysEqual } from '../actions/common';

const keywordToKey = (item: unknown): string => {
  if (typeof item === 'string') return item.trim().toLowerCase();
  const doc = item as { value?: string; label?: string; name?: string } | null;
  return String(doc?.value ?? doc?.label ?? doc?.name ?? '').trim().toLowerCase();
};

export function majorsChanged(
  selected: unknown[] | undefined,
  keywords: unknown[] | undefined,
  customKeywords: unknown[] | undefined,
): boolean {
  const a = (selected || []).map(keywordToKey).filter(Boolean).sort();
  const b = [...(keywords || []), ...(customKeywords || [])].map(keywordToKey).filter(Boolean).sort();
  if (a.length !== b.length) return true;
  return a.some((v, i) => v !== b[i]);
}

/** Compare country/state/city objects from CountrySelect. */
export function profileLocationChanged(
  saved: { name?: string } | null | undefined,
  current: { name?: string } | null | undefined,
): boolean {
  return (saved?.name ?? '') !== (current?.name ?? '');
}

export type ExpertProfileFormSnapshot = {
  imageSrc: unknown;
  oldImageSrc: unknown;
  name: string;
  title: string;
  description: string;
  selectedKeywords: unknown[];
  selectedServices: unknown[];
  country: { name?: string } | null | undefined;
  state: { name?: string } | null | undefined;
  city: { name?: string } | null | undefined;
  phoneNumber: string;
  userDetails: {
    username?: string;
    title?: string;
    description?: string;
    keywords?: unknown[];
    customKeywords?: unknown[];
    services?: unknown[];
    country?: { name?: string };
    state?: { name?: string };
    city?: { name?: string };
    phoneNumber?: string;
  };
};

export function hasExpertProfilePhotoChanges(
  imageSrc: unknown,
  oldImageSrc: unknown,
): boolean {
  return !!imageSrc && imageSrc !== oldImageSrc;
}

export function hasExpertProfileUnsavedChanges(
  form: ExpertProfileFormSnapshot,
): boolean {
  const u = form.userDetails;
  return (
    form.name !== (u.username ?? '') ||
    form.title !== (u.title ?? '') ||
    form.description !== (u.description ?? '') ||
    majorsChanged(form.selectedKeywords, u.keywords, u.customKeywords) ||
    !arraysEqual(form.selectedServices || [], u.services || []) ||
    profileLocationChanged(u.country, form.country) ||
    profileLocationChanged(u.state, form.state) ||
    profileLocationChanged(u.city, form.city) ||
    form.phoneNumber !== (u.phoneNumber ?? '')
  );
}

export type CustomerProfileFormSnapshot = {
  imageSrc: unknown;
  originalImageSrc: unknown;
  name: string;
  selectedKeywords: unknown[];
  selectedServices: unknown[];
  country: { name?: string } | null | undefined;
  state: { name?: string } | null | undefined;
  city: { name?: string } | null | undefined;
  phoneNumber: string;
  userDetails: {
    username?: string;
    keywords?: unknown[];
    customKeywords?: unknown[];
    services?: unknown[];
    country?: { name?: string };
    state?: { name?: string };
    city?: { name?: string };
    phoneNumber?: string;
  };
};

export function hasCustomerProfilePhotoChanges(
  imageSrc: unknown,
  originalImageSrc: unknown,
): boolean {
  return !!imageSrc && imageSrc !== originalImageSrc;
}

export function hasCustomerProfileUnsavedChanges(
  form: CustomerProfileFormSnapshot,
): boolean {
  const u = form.userDetails;
  return (
    form.name !== (u.username ?? '') ||
    majorsChanged(form.selectedKeywords, u.keywords, u.customKeywords) ||
    !arraysEqual(form.selectedServices || [], u.services || []) ||
    profileLocationChanged(u.country, form.country) ||
    profileLocationChanged(u.state, form.state) ||
    profileLocationChanged(u.city, form.city) ||
    form.phoneNumber !== (u.phoneNumber ?? '')
  );
}
