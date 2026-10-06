import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import ExpertSeminar from './seminar';

const { createGroupChat, updateGroupChat } = vi.hoisted(() => ({
  createGroupChat: vi.fn(),
  updateGroupChat: vi.fn(),
}));
vi.mock('../../../api/api', () => ({
  createGroupChat,
  updateGroupChat,
  uploadSeminarCover: vi.fn(),
  doGetKeywordsAndServices: vi.fn(async () => ({ keywords: [], services: [] })),
}));
vi.mock('../../../actions/authActions', () => ({
  updateMe: () => ({ type: 'test/refresh' }),
}));
vi.mock('../../../actions/appActions', () => ({ SetLoadingStatus: vi.fn() }));
vi.mock('../../../utils/notify', () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

const seminar = (status?: string) => ({
  groupId: 'seminar-1',
  groupName: 'Career planning',
  description: 'Plan your next career step.',
  status,
  start: '2099-10-08T18:00:00',
  end: '2099-10-08T19:00:00',
  price: 25,
});

function show(selectedSeminar?: ReturnType<typeof seminar>, enrolledCount = 0) {
  const onAfterSeminarSave = vi.fn();
  const store = configureStore({
    reducer: { auth: () => ({ userDetails: { _id: 'host', groupChats: [], events: [] } }) },
  });
  render(
    <Provider store={store}>
      <MemoryRouter>
        <ExpertSeminar
          selectedSeminar={selectedSeminar}
          enrolledCount={enrolledCount}
          onAfterSeminarSave={onAfterSeminarSave}
        />
      </MemoryRouter>
    </Provider>,
  );
  return onAfterSeminarSave;
}

const draftButton = () => screen.queryByRole('button', { name: 'Save as Draft' });
const next = () => fireEvent.click(screen.getByRole('button', { name: 'Next' }));

describe('seminar draft availability in the shared tab/chat editor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createGroupChat.mockResolvedValue({ createdGroupChatId: 'created-1' });
    updateGroupChat.mockResolvedValue({ result: {} });
  });

  it('saves a new draft and keeps subsequent saves on the same seminar', async () => {
    const afterSave = show();
    fireEvent.change(screen.getByPlaceholderText(/Breaking into Product Management/), {
      target: { value: 'My unfinished seminar' },
    });
    fireEvent.click(draftButton()!);
    await waitFor(() => expect(createGroupChat).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'draft', name: 'My unfinished seminar' }),
    ));
    await waitFor(() => expect(afterSave).toHaveBeenCalledWith('draft'));
    expect(draftButton()).toBeInTheDocument();
    fireEvent.click(draftButton()!);
    await waitFor(() => expect(updateGroupChat).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: 'created-1', status: 'draft' }),
    ));
    expect(createGroupChat).toHaveBeenCalledTimes(1);
  });

  it.each(['draft', 'pending'])('still saves an existing %s seminar as a draft', async status => {
    show(seminar(status));
    fireEvent.click(draftButton()!);
    await waitFor(() => expect(updateGroupChat).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: 'seminar-1', status: 'draft' }),
    ));
  });

  it.each([0, 2])('hides drafts on every editing step for a published seminar with %i students', enrolled => {
    show(seminar('active'), enrolled);
    expect(draftButton()).not.toBeInTheDocument();
    next();
    expect(draftButton()).not.toBeInTheDocument();
    next();
    expect(draftButton()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish Seminar' })).toBeInTheDocument();
  });

  it.each(['cancelled', undefined])('does not offer drafts for an existing seminar with status %s', async status => {
    await act(async () => { show(seminar(status)); });
    expect(draftButton()).not.toBeInTheDocument();
  });

  it('still saves edits to a published seminar as published', async () => {
    const afterSave = show(seminar('active'));
    next();
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Publish Seminar' }));
    await waitFor(() => expect(afterSave).toHaveBeenCalledWith('active'));
    expect(updateGroupChat).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: 'seminar-1', status: 'active' }),
    );
  });

  it('removes the draft option immediately after successfully publishing a draft', async () => {
    const afterSave = show(seminar('draft'));
    next();
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Publish Seminar' }));
    await waitFor(() => expect(afterSave).toHaveBeenCalledWith('active'));
    expect(draftButton()).not.toBeInTheDocument();
  });

  it('retains the confirmation before updating a seminar with enrolled students', async () => {
    const afterSave = show(seminar('active'), 2);
    next();
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Publish Seminar' }));
    expect(screen.getByText('Publish these changes?')).toBeInTheDocument();
    expect(updateGroupChat).not.toHaveBeenCalled();
    const publishButtons = screen.getAllByRole('button', { name: 'Publish Seminar' });
    fireEvent.click(publishButtons[publishButtons.length - 1]);
    await waitFor(() => expect(afterSave).toHaveBeenCalledWith('active'));
    expect(draftButton()).not.toBeInTheDocument();
  });

  it('keeps the draft option if publishing fails', async () => {
    updateGroupChat.mockResolvedValue(false);
    show(seminar('draft'));
    next();
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Publish Seminar' }));
    await waitFor(() => expect(updateGroupChat).toHaveBeenCalled());
    expect(draftButton()).toBeInTheDocument();
  });

  it('rejects an empty draft without sending a save request', async () => {
    await act(async () => { show(); });
    fireEvent.click(draftButton()!);
    expect(screen.getByText('Add a title to save a draft.')).toBeInTheDocument();
    expect(createGroupChat).not.toHaveBeenCalled();
    expect(updateGroupChat).not.toHaveBeenCalled();
  });

  it('allows retrying a draft after a network error during publishing', async () => {
    updateGroupChat.mockRejectedValueOnce(new Error('Offline'));
    const afterSave = show(seminar('draft'));
    next();
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Publish Seminar' }));
    await waitFor(() => expect(updateGroupChat).toHaveBeenCalledTimes(1));
    expect(afterSave).not.toHaveBeenCalled();
    fireEvent.click(draftButton()!);
    await waitFor(() => expect(afterSave).toHaveBeenCalledWith('draft'));
  });
});
