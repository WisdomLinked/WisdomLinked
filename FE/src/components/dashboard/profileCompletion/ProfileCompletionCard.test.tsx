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
    expect(screen.getByText('Finish your student profile')).toBeInTheDocument();
    expect(screen.getByText('3 of 6')).toBeInTheDocument();
    expect(screen.getByText('0 of 3 complete')).toBeInTheDocument();
    // Percent appears once under the bar (not also as a large header figure).
    expect(screen.getAllByText('20%')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Finish section: Academic background' }));
    expect(onSectionAction).toHaveBeenCalledWith('#profile-academic');
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
    expect(screen.getByText('Finish your student profile')).toBeInTheDocument();
    expect(screen.getByText('3 of 6')).toBeInTheDocument();
    expect(screen.getByText('0 of 3 complete')).toBeInTheDocument();
    expect(screen.getAllByText('20%')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Finish section: Academic background' }));
    expect(onOpenSection).toHaveBeenCalledWith('#profile-academic');
  });

  it('hides automatically when the profile is fully complete', () => {
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

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('Complete your profile')).not.toBeInTheDocument();
  });
});
