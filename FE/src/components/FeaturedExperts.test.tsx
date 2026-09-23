import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import FeaturedExperts, { resolveFeaturedPhotoSrc } from './FeaturedExperts';

vi.mock('../api/api', () => ({
  getFeaturedExperts: vi.fn(),
}));

import { getFeaturedExperts } from '../api/api';

const mockedGet = vi.mocked(getFeaturedExperts);

describe('resolveFeaturedPhotoSrc', () => {
  it('passes through http(s), root-relative, and data URLs', () => {
    expect(resolveFeaturedPhotoSrc('https://cdn.example/p.jpg')).toBe('https://cdn.example/p.jpg');
    expect(resolveFeaturedPhotoSrc('/uploads/p.jpg')).toBe('/uploads/p.jpg');
    expect(resolveFeaturedPhotoSrc('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
  });

  it('maps stored filenames to the image-fetch endpoint', () => {
    expect(resolveFeaturedPhotoSrc('photo 1.png')).toBe(
      '/api/image-fetch?file=photo%201.png&folder=small',
    );
  });
});

describe('FeaturedExperts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders API experts when the list is non-empty', async () => {
    mockedGet.mockResolvedValue([
      {
        id: '1',
        name: 'Ada Lovelace',
        title: 'Analyst',
        organization: 'Analytical Engine',
        type: 'academic',
        photoUrl: '',
      },
    ]);
    render(<FeaturedExperts onViewAll={() => undefined} />);
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.queryByText('Dr. Bruce Wang')).not.toBeInTheDocument();
  });

  it('keeps the mock list when the API is empty or fails', async () => {
    mockedGet.mockResolvedValue([]);
    render(<FeaturedExperts onViewAll={() => undefined} />);
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());
    expect(screen.getByRole('heading', { name: 'Learn From Leaders Across Fields' })).toBeInTheDocument();
    expect(screen.queryByText(/Transportation Engineering/i)).not.toBeInTheDocument();
    expect(screen.getByText('Dr. Bruce Wang')).toBeInTheDocument();
    expect(screen.getByText('Priya Raman')).toBeInTheDocument();
  });
});
