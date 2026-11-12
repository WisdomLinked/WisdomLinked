import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DemographicsSection from './DemographicsSection';

const { doGetAdminDemographics } = vi.hoisted(() => ({
  doGetAdminDemographics: vi.fn(),
}));

vi.mock('../../../api/api', () => ({ doGetAdminDemographics }));

describe('DemographicsSection', () => {
  beforeEach(() => {
    doGetAdminDemographics.mockReset();
    doGetAdminDemographics.mockResolvedValue({
      status: 'SUCCESS',
      data: {
        totals: { experts: 2, students: 3 },
        locations: [
          { country: 'United States', experts: 1, students: 1 },
          { country: 'Canada', experts: 1, students: 0 },
        ],
        locationMissing: { experts: 0, students: 2 },
        services: [
          { key: 'study_abroad', label: 'Study Abroad', students: 2 },
          { key: 'work_abroad', label: 'Work Abroad', students: 1 },
          { key: 'research_guidance', label: 'Research Guidance', students: 0 },
        ],
        servicesMissing: 1,
      },
    });
  });

  it('renders demographics under the analytics range and filters locations', async () => {
    render(<DemographicsSection rangeKey="6m" />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Demographics' })).toBeInTheDocument());
    expect(screen.getByText('Where users are and what students need')).toBeInTheDocument();
    expect(screen.getByText('Study Abroad')).toBeInTheDocument();
    expect(doGetAdminDemographics).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Students' }));
    expect(screen.getByRole('button', { name: 'Students' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/2 students haven't added a location/i)).toBeInTheDocument();
  });

  it('shows retry when the demographics request fails', async () => {
    doGetAdminDemographics.mockResolvedValueOnce({ status: 'FAILED' });
    render(<DemographicsSection rangeKey="all" />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/could not load/i));
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(doGetAdminDemographics).toHaveBeenCalledTimes(2));
  });
});
