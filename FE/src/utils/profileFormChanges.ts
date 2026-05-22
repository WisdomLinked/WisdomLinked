import { arraysEqual } from '../actions/common';

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
    !arraysEqual(form.selectedKeywords || [], u.keywords || []) ||
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
    !arraysEqual(form.selectedKeywords || [], u.keywords || []) ||
    !arraysEqual(form.selectedServices || [], u.services || []) ||
    profileLocationChanged(u.country, form.country) ||
    profileLocationChanged(u.state, form.state) ||
    profileLocationChanged(u.city, form.city) ||
    form.phoneNumber !== (u.phoneNumber ?? '')
  );
}
