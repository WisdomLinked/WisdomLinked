import { describe, expect, it, vi } from 'vitest';
import { mapExpertToMentor, mapExpertToMentorWithImage } from './mapExpertToMentor';

const expert = {
  _id: 'expert-1',
  username: 'Dr. Smith',
  title: 'Professor',
  description: 'University lab',
  keywords: [{ value: 'CS' }],
  services: [],
  rating: 4.5,
  image: 'storage-key-abc',
  createdAt: new Date().toISOString(),
};

describe('mapExpertToMentor', () => {
  it('sets image null for non-displayable refs', () => {
    const m = mapExpertToMentor(expert);
    expect(m.image).toBeNull();
    expect(m.name).toBe('Dr. Smith');
  });

  it('keeps direct https image URLs', () => {
    const m = mapExpertToMentor({ ...expert, image: 'https://cdn.example.com/a.png' });
    expect(m.image).toBe('https://cdn.example.com/a.png');
  });

  it('passes through expert status for booking guards', () => {
    expect(mapExpertToMentor({ ...expert, status: 'active' }).status).toBe('active');
    expect(mapExpertToMentor({ ...expert, status: 'review' }).status).toBe('review');
    expect(mapExpertToMentor(expert).status).toBeUndefined();
  });

  it('lists official keywords first, then custom majors as unverified', () => {
    const m = mapExpertToMentor({
      ...expert,
      keywords: [{ value: 'Aerospace Engineering' }],
      customKeywords: ['Quantum Photonics'],
    });
    expect(m.majors).toEqual([
      { label: 'Aerospace Engineering', custom: false },
      { label: 'Quantum Photonics', custom: true },
    ]);
    expect(m.field).toBe('Aerospace Engineering');
  });

  it('treats a custom keyword matching a baseline major as official and dedupes', () => {
    const m = mapExpertToMentor({
      ...expert,
      keywords: [{ value: 'Software Engineering' }],
      customKeywords: ['software engineering', 'Software Engineering', '  '],
    });
    expect(m.majors).toEqual([{ label: 'Software Engineering', custom: false }]);
  });

  it('falls back to General when no majors are present', () => {
    const m = mapExpertToMentor({ ...expert, keywords: [], customKeywords: [] });
    expect(m.majors).toEqual([]);
    expect(m.field).toBe('General');
  });
});

describe('mapExpertToMentorWithImage', () => {
  it('resolves storage ref via profileImageFetch', async () => {
    const fetcher = vi.fn().mockResolvedValue('data:image/png;base64,xyz');
    const m = await mapExpertToMentorWithImage(expert, 'small', fetcher);
    expect(fetcher).toHaveBeenCalledWith('storage-key-abc', 'small');
    expect(m.image).toBe('data:image/png;base64,xyz');
  });

  it('skips fetch when image is already a display URL', async () => {
    const fetcher = vi.fn();
    const m = await mapExpertToMentorWithImage(
      { ...expert, image: 'https://cdn.example.com/b.png' },
      'small',
      fetcher,
    );
    expect(fetcher).not.toHaveBeenCalled();
    expect(m.image).toBe('https://cdn.example.com/b.png');
  });
});
