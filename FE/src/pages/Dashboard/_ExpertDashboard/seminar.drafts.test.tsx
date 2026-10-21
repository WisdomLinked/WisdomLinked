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

function show(selectedSeminar?: ReturnType<typeof seminar>, enrolledCount = 0, onSaved?: (status: string) => void) {
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
          onSaved={onSaved}
        />
      </MemoryRouter>
    </Provider>,
  );
  return onAfterSeminarSave;
}

const draftButton = () => screen.queryByRole('button', { name: 'Save as Draft' });
const next = () => fireEvent.click(screen.getByRole('button', { name: 'Next' }));
const approvalCheckbox = () =>
  screen.getByRole('checkbox', { name: /I have the approval from all the participants/ });
/** The dialog's Publish button (the editor's own one is rendered first). */
const confirmPublishButton = () => {
  const buttons = screen.getAllByRole('button', { name: 'Publish Seminar' });
  return buttons[buttons.length - 1];
};

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
      { quietAccountRestriction: true },
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
    fireEvent.click(approvalCheckbox());
    fireEvent.click(confirmPublishButton());
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

describe('participant approval before publishing changes to a seminar with students', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateGroupChat.mockResolvedValue({ result: {} });
  });

  const openConfirm = () => {
    show(seminar('active'), 2);
    next();
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Publish Seminar' }));
  };

  it('starts unticked with Publish disabled, and saves nothing until ticked', () => {
    openConfirm();
    expect(approvalCheckbox()).not.toBeChecked();
    expect(confirmPublishButton()).toBeDisabled();
    fireEvent.click(confirmPublishButton());
    expect(updateGroupChat).not.toHaveBeenCalled();
    expect(screen.getByText('Publish these changes?')).toBeInTheDocument();
  });

  it('enables Publish once ticked and disables it again when unticked', () => {
    openConfirm();
    fireEvent.click(approvalCheckbox());
    expect(confirmPublishButton()).toBeEnabled();
    fireEvent.click(approvalCheckbox());
    expect(confirmPublishButton()).toBeDisabled();
  });

  it('ticks when the approval text itself is clicked', () => {
    openConfirm();
    fireEvent.click(screen.getByText(/I have the approval from all the participants/));
    expect(approvalCheckbox()).toBeChecked();
  });

  it('publishes the changes once approval is ticked', async () => {
    openConfirm();
    fireEvent.click(approvalCheckbox());
    fireEvent.click(confirmPublishButton());
    await waitFor(() => expect(updateGroupChat).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: 'seminar-1', status: 'active' }),
    ));
    expect(updateGroupChat).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Publish these changes?')).not.toBeInTheDocument();
  });

  it('asks again after Cancel', () => {
    openConfirm();
    fireEvent.click(approvalCheckbox());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Publish these changes?')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Publish Seminar' }));
    expect(approvalCheckbox()).not.toBeChecked();
    expect(confirmPublishButton()).toBeDisabled();
    expect(updateGroupChat).not.toHaveBeenCalled();
  });

  it('asks again after closing by clicking outside the dialog', () => {
    openConfirm();
    fireEvent.click(approvalCheckbox());
    const backdrop = screen.getByText('Publish these changes?').parentElement!.parentElement!;
    fireEvent.click(backdrop);
    expect(screen.queryByText('Publish these changes?')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Publish Seminar' }));
    expect(approvalCheckbox()).not.toBeChecked();
    expect(updateGroupChat).not.toHaveBeenCalled();
  });

  it('asks again on the next publish after a successful one', async () => {
    openConfirm();
    fireEvent.click(approvalCheckbox());
    fireEvent.click(confirmPublishButton());
    await waitFor(() => expect(updateGroupChat).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Publish Seminar' }));
    expect(approvalCheckbox()).not.toBeChecked();
    expect(confirmPublishButton()).toBeDisabled();
  });

  it('does not ask for approval when no students have joined', async () => {
    const afterSave = show(seminar('active'), 0);
    next();
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Publish Seminar' }));
    expect(screen.queryByText('Publish these changes?')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /approval/ })).not.toBeInTheDocument();
    await waitFor(() => expect(afterSave).toHaveBeenCalledWith('active'));
  });
});

describe('onSaved (used by the chat "Edit Seminar Details" popup to close itself)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateGroupChat.mockResolvedValue({ result: {} });
  });

  it('is told about a successful publish, alongside the usual post-save step', async () => {
    const onSaved = vi.fn();
    const afterSave = show(seminar('active'), 0, onSaved);
    next();
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Publish Seminar' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('active'));
    expect(afterSave).toHaveBeenCalledWith('active');
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('is told about a successful publish after participant approval', async () => {
    const onSaved = vi.fn();
    show(seminar('active'), 2, onSaved);
    next();
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Publish Seminar' }));
    expect(onSaved).not.toHaveBeenCalled();
    fireEvent.click(approvalCheckbox());
    fireEvent.click(confirmPublishButton());
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('active'));
  });

  it('is not told when saving fails, so the editor stays open', async () => {
    updateGroupChat.mockResolvedValue(false);
    const onSaved = vi.fn();
    show(seminar('active'), 0, onSaved);
    next();
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Publish Seminar' }));
    await waitFor(() => expect(updateGroupChat).toHaveBeenCalled());
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('is not told when the network fails', async () => {
    updateGroupChat.mockRejectedValueOnce(new Error('Offline'));
    const onSaved = vi.fn();
    show(seminar('active'), 0, onSaved);
    next();
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Publish Seminar' }));
    await waitFor(() => expect(updateGroupChat).toHaveBeenCalled());
    expect(onSaved).not.toHaveBeenCalled();
  });
});

describe('editing a seminar that is already free', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateGroupChat.mockResolvedValue({ result: {} });
  });

  const freeMessage = () => screen.queryByText('This seminar will be free for all attendees.');
  const priceError = () => screen.queryByText('Price must be greater than 0.');

  it('opens with Free switched on and publishes as free without touching it', async () => {
    show({ ...seminar('active'), price: 0 });
    next();
    next();
    expect(freeMessage()).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Publish Seminar' }));
    await waitFor(() => expect(updateGroupChat).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: 'seminar-1', price: 0, status: 'active' }),
    ));
    expect(priceError()).not.toBeInTheDocument();
  });

  it('keeps Free off for a paid seminar', () => {
    show(seminar('active'));
    next();
    next();
    expect(freeMessage()).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('25')).toBeInTheDocument();
  });

  it('keeps Free off for a draft saved at price 0', async () => {
    show({ ...seminar('draft'), price: 0 });
    next();
    next();
    expect(freeMessage()).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Publish Seminar' }));
    expect(await screen.findByText('Price must be greater than 0.')).toBeInTheDocument();
    expect(updateGroupChat).not.toHaveBeenCalled();
  });

  it('keeps Free off when the seminar has no price', () => {
    const { price, ...noPrice } = seminar('active');
    show(noPrice as any);
    next();
    next();
    expect(freeMessage()).not.toBeInTheDocument();
  });
});
