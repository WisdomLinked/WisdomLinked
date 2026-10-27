import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ProfileCompletionCard from './ProfileCompletionCard';
import StudentProfileCompletionCard from './StudentProfileCompletionCard';

const { getRequiredContracts } = vi.hoisted(() => ({
  getRequiredContracts: vi.fn(),
}));

vi.mock('../../../api/termsApi', () => ({
  getRequiredContracts,
}));

describe('ProfileCompletionCard', () => {
  it('shows section actions and a partial academic badge', () => {
    const onSectionAction = vi.fn();
    render(
      <ProfileCompletionCard
        title="Complete your profile"
        helperText="Helper"
        percent={20}
        onSectionAction={onSectionAction}
        sections={[
          {
            id: 'academic',
            label: 'Academic background',
            description: 'Degree and school',
            weight: 40,
            filled: 3,
            total: 6,
            isComplete: false,
            href: '#profile-academic',
            actionLabel: 'Finish section',
            progressBadge: '3 of 6 fields',
          },
          {
            id: 'preferences',
            label: 'Preferences and services',
            description: 'Services',
            weight: 30,
            filled: 0,
            total: 2,
            isComplete: false,
            href: '#profile-preferences',
            actionLabel: 'Add preferences',
          },
          {
            id: 'resume',
            label: 'Resume',
            description: 'Upload',
            weight: 30,
            filled: 0,
            total: 1,
            isComplete: false,
            href: '#profile-resume',
            actionLabel: 'Upload resume',
          },
        ]}
      />,
    );

    const bar = screen.getByRole('progressbar', { name: 'Profile completion' });
    expect(bar).toHaveAttribute('aria-valuenow', '20');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(screen.getByTestId('progress-fill')).toHaveStyle({ width: '20%' });
    expect(screen.getByText('Finish your student profile')).toBeInTheDocument();
    expect(screen.getByText('3 of 6 fields')).toBeInTheDocument();
    expect(screen.getByText('0 of 3 sections complete')).toBeInTheDocument();
    // Percent appears once under the bar (not also as a large header figure).
    expect(screen.getAllByText('20%')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Finish section: Academic background' }));
    expect(onSectionAction).toHaveBeenCalledWith('#profile-academic');
  });

  it('lists the unfinished section first with a finish button and quiet edit links on done rows', () => {
    const onSectionAction = vi.fn();
    render(
      <ProfileCompletionCard
        title="Complete your profile"
        helperText="Helper"
        percent={80}
        onSectionAction={onSectionAction}
        sections={[
          {
            id: 'preferences',
            label: 'Preferences and services',
            description: 'Services',
            weight: 1,
            filled: 2,
            total: 2,
            isComplete: true,
            href: '#profile-preferences',
            actionLabel: 'Add preferences',
            reviewLabel: 'Edit',
          },
          {
            id: 'academic',
            label: 'Academic background',
            description: 'Degree and school',
            weight: 1,
            filled: 4,
            total: 6,
            isComplete: false,
            href: '#profile-academic',
            actionLabel: 'Finish section',
            progressBadge: '4 of 6 fields',
          },
          {
            id: 'terms',
            label: 'Terms',
            description: 'Sign the current student agreement.',
            weight: 1,
            filled: 1,
            total: 1,
            isComplete: true,
            href: '#terms-agreement',
            actionLabel: 'Sign',
            reviewLabel: 'View',
          },
        ]}
      />,
    );

    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Academic background');
    expect(items[0]).toHaveTextContent('4 of 6 fields');
    expect(screen.getByText('2 of 3 sections complete')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish section: Academic background' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit: Preferences and services' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View: Terms' })).toBeInTheDocument();
  });

});

describe('StudentProfileCompletionCard', () => {
  beforeEach(() => {
    getRequiredContracts.mockReset();
    // Unsigned current student agreement, so the Terms row stays on the card.
    getRequiredContracts.mockResolvedValue([
      { audience: 'customer', version: 1, html: '<p>Student terms</p>', contentHash: 'abc' },
    ]);
  });

  it('renders from the authenticated student and opens a section', async () => {
    const onOpenSection = vi.fn();
    const store = configureStore({
      reducer: {
        auth: () => ({
          userDetails: {
            _id: 's1',
            degreeSought: 'PhD',
            intendedIntake: 'Fall 2027',
            currentUniversity: 'HUST',
          },
        }),
      },
    });

    render(
      <Provider store={store}>
        <StudentProfileCompletionCard onOpenSection={onOpenSection} />
      </Provider>,
    );

    await waitFor(() => {
      expect(getRequiredContracts).toHaveBeenCalled();
    });

    const bar = screen.getByRole('progressbar', { name: 'Profile completion' });
    expect(bar).toHaveAttribute('aria-valuenow', '30');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(screen.getByTestId('progress-fill')).toHaveStyle({ width: '30%' });
    expect(screen.getByText('Finish your student profile')).toBeInTheDocument();
    expect(screen.getByText('3 of 6 fields')).toBeInTheDocument();
    expect(screen.getByText('0 of 4 sections complete')).toBeInTheDocument();
    expect(screen.getByText('Terms')).toBeInTheDocument();
    expect(screen.getAllByText('30%')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Finish section: Academic background' }));
    expect(onOpenSection).toHaveBeenCalledWith('#profile-academic');
  });

  it('hides automatically when the profile is fully complete', async () => {
    // No customer contract left to sign: the current student agreement is signed.
    getRequiredContracts.mockResolvedValue([]);
    const store = configureStore({
      reducer: {
        auth: () => ({
          userDetails: {
            _id: 's1',
            degreeSought: "Master's",
            intendedIntake: 'Fall 2027',
            currentUniversity: 'HUST',
            gpa: '3.8',
            targetUniversities: 'MIT',
            country: 'China',
            services: ['Study Abroad'],
            keywords: ['Computer Science'],
            resume: 'resumes/cv.pdf',
          },
        }),
      },
    });

    const { container } = render(
      <Provider store={store}>
        <StudentProfileCompletionCard onOpenSection={vi.fn()} />
      </Provider>,
    );

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
    expect(screen.queryByText('Complete your profile')).not.toBeInTheDocument();
  });
});
