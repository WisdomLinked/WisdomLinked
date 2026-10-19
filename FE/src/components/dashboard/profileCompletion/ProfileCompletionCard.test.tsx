import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ProfileCompletionCard from './ProfileCompletionCard';
import StudentProfileCompletionCard from './StudentProfileCompletionCard';

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
            progressBadge: '3 of 6',
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

    expect(screen.getByRole('progressbar', { name: 'Profile completion' })).toHaveAttribute(
      'aria-valuenow',
      '20',
    );
    expect(screen.getByText('3 of 6')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Finish section' }));
    expect(onSectionAction).toHaveBeenCalledWith('#profile-academic');
  });

  it('shows dismiss when complete', () => {
    const onDismiss = vi.fn();
    render(
      <ProfileCompletionCard
        title="Your profile is complete"
        helperText="Thanks"
        percent={100}
        complete
        onDismiss={onDismiss}
        onSectionAction={vi.fn()}
        sections={[
          {
            id: 'resume',
            label: 'Resume',
            description: 'Done',
            weight: 30,
            filled: 1,
            total: 1,
            isComplete: true,
            href: '#profile-resume',
            actionLabel: 'Upload resume',
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss profile completion card' }));
    expect(onDismiss).toHaveBeenCalled();
  });
});

describe('StudentProfileCompletionCard', () => {
  it('renders from the authenticated student and opens a section', () => {
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

    expect(screen.getByRole('progressbar', { name: 'Profile completion' })).toHaveAttribute(
      'aria-valuenow',
      '20',
    );
    expect(screen.getByText('3 of 6')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Finish section' }));
    expect(onOpenSection).toHaveBeenCalledWith('#profile-academic');
  });
});
