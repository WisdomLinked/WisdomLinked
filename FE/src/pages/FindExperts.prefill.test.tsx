import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FindExpertsPage from './FindExperts';

const { doFilterExperts, doGetKeywordsAndServices } = vi.hoisted(() => ({
  doFilterExperts: vi.fn(),
  doGetKeywordsAndServices: vi.fn(),
}));

vi.mock('../api/api', () => ({
  doFilterExperts: (...args: unknown[]) => doFilterExperts(...args),
  doGetKeywordsAndServices: (...args: unknown[]) => doGetKeywordsAndServices(...args),
  profileImageFetch: vi.fn(async () => null),
}));

describe('FindExperts global search prefill', () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    doFilterExperts.mockReset();
    doGetKeywordsAndServices.mockReset();
    doFilterExperts.mockResolvedValue({ result: [] });
    doGetKeywordsAndServices.mockResolvedValue({
      keywords: [{ _id: 'k1', value: 'Biology' }],
      services: [],
    });
  });

  it('prefills the search query and leaves the major filter in place', async () => {
    const props = {
      followedMentorIds: [] as string[],
      followerCounts: {},
      onToggleFollow: () => {},
      initialQuery: 'biology',
    };
    const view = render(<FindExpertsPage {...props} />);

    await waitFor(() => {
      expect(doFilterExperts).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'biology', keywords: [] }),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'All majors' }));
    fireEvent.click(screen.getByRole('option', { name: 'Biology' }));

    await waitFor(() => {
      expect(doFilterExperts).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'biology',
          keywords: [{ _id: 'k1' }],
        }),
      );
    });

    view.rerender(<FindExpertsPage {...props} initialQuery="chemistry" />);

    expect(screen.getByRole('button', { name: 'Biology' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search by name/i)).toHaveValue('chemistry');

    await waitFor(() => {
      expect(doFilterExperts).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'chemistry',
          keywords: [{ _id: 'k1' }],
        }),
      );
    });
  });
});
