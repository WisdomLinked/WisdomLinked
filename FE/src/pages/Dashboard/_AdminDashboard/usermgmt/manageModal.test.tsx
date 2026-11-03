import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';

const seen: Array<{ form: string; userDetails: any; save: (u: any) => void }> = [];

vi.mock('../../../../api/api', () => ({ doGetFullUserDataByEmail: vi.fn() }));
vi.mock('../../_ExpertDashboard/profile', () => ({
  default: (props: any) => {
    seen.push({ form: 'expert', userDetails: props.userDetails, save: props.updateOneUser });
    return <div>expert form: {props.userDetails?.title}</div>;
  },
}));
vi.mock('../../_CustomerDashboard/profile', () => ({
  default: (props: any) => {
    seen.push({ form: 'customer', userDetails: props.userDetails, save: props.updateOneUser });
    return <div>student form: {props.userDetails?.username}</div>;
  },
}));

import { doGetFullUserDataByEmail } from '../../../../api/api';
import ManageModal from './manageModal';

const mockedFetch = vi.mocked(doGetFullUserDataByEmail);

describe('Manage dialog', () => {
  beforeEach(() => {
    seen.length = 0;
    mockedFetch.mockReset();
  });

  it.each([
    ['customer', { email: 's@x.com', role: 'customer', username: 'Old name' }, { username: 'New name' }, 'student form: New name'],
    ['expert', { email: 'e@x.com', role: 'expert', title: 'Old title' }, { title: 'New title' }, 'expert form: New title'],
  ])('after a %s save the form is given the saved details, so Save has nothing left to do', async (_role, stored, change, shown) => {
    mockedFetch.mockResolvedValue({ result: stored });
    const updateOneUser = vi.fn();
    render(<ManageModal selectedUser={{ email: stored.email }} updateOneUser={updateOneUser} closeModal={() => undefined} />);
    await waitFor(() => expect(seen.length).toBeGreaterThan(0));

    const saved = { ...stored, ...change };
    act(() => seen[seen.length - 1].save(saved));

    expect(await screen.findByText(shown)).toBeTruthy();
    expect(seen[seen.length - 1].userDetails).toEqual(saved);
    expect(updateOneUser).toHaveBeenCalledWith(saved);
  });
});
