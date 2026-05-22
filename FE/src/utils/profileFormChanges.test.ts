import { describe, expect, it } from 'vitest';
import {
  hasCustomerProfilePhotoChanges,
  hasCustomerProfileUnsavedChanges,
  hasExpertProfilePhotoChanges,
  hasExpertProfileUnsavedChanges,
  profileLocationChanged,
} from './profileFormChanges';

describe('profileFormChanges', () => {
  it('detects location name changes', () => {
    expect(profileLocationChanged({ name: 'USA' }, { name: 'Canada' })).toBe(true);
    expect(profileLocationChanged({ name: 'USA' }, { name: 'USA' })).toBe(false);
  });

  it('detects expert photo change separately from form fields', () => {
    expect(hasExpertProfilePhotoChanges('data:new', 'data:old')).toBe(true);
    expect(
      hasExpertProfileUnsavedChanges({
        imageSrc: 'data:new',
        oldImageSrc: 'data:old',
        name: 'Jane',
        title: 'Dr',
        description: 'Bio',
        selectedKeywords: [],
        selectedServices: [],
        country: { name: 'USA' },
        state: null,
        city: null,
        phoneNumber: '1',
        userDetails: {
          username: 'Jane',
          title: 'Dr',
          description: 'Bio',
          phoneNumber: '1',
          country: { name: 'USA' },
        },
      }),
    ).toBe(false);
  });

  it('detects customer photo change separately from form fields', () => {
    expect(hasCustomerProfilePhotoChanges('data:new', 'data:old')).toBe(true);
    expect(hasCustomerProfilePhotoChanges('same', 'same')).toBe(false);
  });

  it('detects expert form field changes', () => {
    expect(
      hasExpertProfileUnsavedChanges({
        imageSrc: 'x',
        oldImageSrc: 'x',
        name: 'Changed',
        title: 'Dr',
        description: 'Bio',
        selectedKeywords: [],
        selectedServices: [],
        country: { name: 'USA' },
        state: null,
        city: null,
        phoneNumber: '1',
        userDetails: {
          username: 'Jane',
          title: 'Dr',
          description: 'Bio',
          phoneNumber: '1',
          country: { name: 'USA' },
        },
      }),
    ).toBe(true);
  });

  it('detects customer phone number changes', () => {
    expect(
      hasCustomerProfileUnsavedChanges({
        imageSrc: 'x',
        originalImageSrc: 'x',
        name: 'Bob',
        selectedKeywords: [],
        selectedServices: [{ _id: '1' }],
        country: { name: 'USA' },
        state: null,
        city: null,
        phoneNumber: '100',
        userDetails: {
          username: 'Bob',
          keywords: [],
          services: [{ _id: '1' }],
          country: { name: 'USA' },
          phoneNumber: '99',
        },
      }),
    ).toBe(true);
  });

  it('detects no customer changes when form matches saved user', () => {
    const user = {
      username: 'Bob',
      keywords: ['a'],
      services: [{ _id: '1' }],
      country: { name: 'USA' },
      phoneNumber: '99',
    };
    expect(
      hasCustomerProfileUnsavedChanges({
        imageSrc: 'x',
        originalImageSrc: 'x',
        name: 'Bob',
        selectedKeywords: ['a'],
        selectedServices: [{ _id: '1' }],
        country: { name: 'USA' },
        state: null,
        city: null,
        phoneNumber: '99',
        userDetails: user,
      }),
    ).toBe(false);
  });
});
