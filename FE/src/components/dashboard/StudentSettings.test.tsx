import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import StudentSettings from './StudentSettings';

vi.mock('../../api/api', () => ({
  doUpdateProfile: vi.fn(async () => true),
}));

import { doUpdateProfile } from '../../api/api';

const store = configureStore({
  reducer: {
    auth: () => ({
      userDetails: { timeZone: 'America/New_York' },
    }),
  },
});

describe('StudentSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists timeZone on save', async () => {
    render(
      <Provider store={store}>
        <StudentSettings />
      </Provider>,
    );

    const select = screen.getByLabelText('Time zone') as HTMLSelectElement;
    expect(select.value).toBe('America/New_York');

    fireEvent.change(select, { target: { value: 'Asia/Kolkata' } });
    fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    await waitFor(() => {
      expect(doUpdateProfile).toHaveBeenCalledWith({ timeZone: 'Asia/Kolkata' });
    });
  });
});
