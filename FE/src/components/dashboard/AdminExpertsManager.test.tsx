import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import AdminExpertsManager from './AdminExpertsManager';

vi.mock('../../api/api', () => ({
  getAdminFeaturedExperts: vi.fn(),
  createFeaturedExpert: vi.fn(),
  updateFeaturedExpert: vi.fn(),
  deleteFeaturedExpert: vi.fn(),
  reorderFeaturedExpert: vi.fn(),
}));

vi.mock('../../utils/notify', () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
  },
}));

vi.mock('../../utils/profileImageUpload', () => ({
  uploadProfilePhotoFile: vi.fn(),
}));

import {
  getAdminFeaturedExperts,
  createFeaturedExpert,
  deleteFeaturedExpert,
  reorderFeaturedExpert,
} from '../../api/api';

const mockedGet = vi.mocked(getAdminFeaturedExperts);
const mockedCreate = vi.mocked(createFeaturedExpert);
const mockedDelete = vi.mocked(deleteFeaturedExpert);
const mockedReorder = vi.mocked(reorderFeaturedExpert);

const seed = [
  {
    id: '1',
    name: 'Dr. Bruce Wang',
    title: 'Professor of Civil Engineering',
    organization: 'UC Berkeley',
    type: 'academic' as const,
    photoUrl: '',
  },
  {
    id: '2',
    name: 'Priya Raman',
    title: 'Principal Strategy Consultant',
    organization: 'AECOM',
    type: 'industry' as const,
    photoUrl: '',
  },
];

function renderManager() {
  const store = configureStore({ reducer: { alert: (s = {}) => s } });
  return render(
    <Provider store={store}>
      <AdminExpertsManager />
    </Provider>,
  );
}

describe('AdminExpertsManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGet.mockResolvedValue(seed);
  });

  it('renders the admin table and add modal required-field errors', async () => {
    renderManager();
    expect(await screen.findByText('Dr. Bruce Wang')).toBeInTheDocument();
    expect(screen.getByText('Priya Raman')).toBeInTheDocument();
    expect(screen.getByText('Academic')).toBeInTheDocument();
    expect(screen.getByText('Industry')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /add expert/i }));
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
    expect(await screen.findByText('Name is required.')).toBeInTheDocument();
    expect(screen.getByText('Title is required.')).toBeInTheDocument();
    expect(screen.getByText('Organization is required.')).toBeInTheDocument();
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('adds an expert and toasts success', async () => {
    mockedCreate.mockResolvedValue({ result: 'SUCCESS' });
    mockedGet.mockResolvedValueOnce(seed).mockResolvedValueOnce([
      ...seed,
      {
        id: '3',
        name: 'Test Mentor',
        title: 'Advisor',
        organization: 'WisdomLinked',
        type: 'industry',
        photoUrl: '',
      },
    ]);
    renderManager();
    await screen.findByText('Dr. Bruce Wang');
    fireEvent.click(screen.getByRole('button', { name: /add expert/i }));
    fireEvent.change(screen.getByPlaceholderText('Dr. Bruce Wang'), { target: { value: 'Test Mentor' } });
    fireEvent.change(screen.getByPlaceholderText('Professor of Computer Science'), {
      target: { value: 'Advisor' },
    });
    fireEvent.change(screen.getByPlaceholderText('UC Berkeley'), { target: { value: 'WisdomLinked' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
    await waitFor(() => expect(mockedCreate).toHaveBeenCalled());
    expect(await screen.findByText('Test Mentor')).toBeInTheDocument();
  });

  it('confirms before removing an expert', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockedDelete.mockResolvedValue({ result: 'SUCCESS' });
    mockedGet.mockResolvedValueOnce(seed).mockResolvedValueOnce([seed[1]]);
    renderManager();
    await screen.findByText('Dr. Bruce Wang');
    fireEvent.click(screen.getAllByTitle('Remove')[0]);
    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith('1'));
    confirmSpy.mockRestore();
  });

  it('reorders with up/down', async () => {
    mockedReorder.mockResolvedValue({
      result: 'SUCCESS',
      experts: [seed[1], seed[0]],
    });
    renderManager();
    await screen.findByText('Dr. Bruce Wang');
    fireEvent.click(screen.getAllByTitle('Move down')[0]);
    await waitFor(() => expect(mockedReorder).toHaveBeenCalledWith('1', 'down'));
  });
});
