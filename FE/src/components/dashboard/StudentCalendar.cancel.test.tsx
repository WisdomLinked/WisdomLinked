import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

import StudentCalendar, { type Meeting } from './StudentCalendar';

vi.mock('../../pages/Dashboard/seminarDetails', () => ({
  default: () => <div data-testid="seminar-details" />,
}));

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;

const when = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

const pending = (overrides: Partial<Meeting> = {}): Meeting => ({
  id: 'req-1',
  title: 'Thesis review',
  date: ymd(when),
  time: '09:00',
  with: 'Mentor: purna00',
  peerName: 'purna00',
  location: 'Online · WisdomLinked Room',
  type: 'session',
  status: 'pending',
  canCancel: true,
  ...overrides,
});

const openDay = () => {
  if (when.getMonth() !== new Date().getMonth()) {
    fireEvent.click(screen.getByLabelText('Next month'));
  }
  fireEvent.click(screen.getByText('09:00 · Thesis review'));
  expect(screen.getByText(ymd(when))).toBeTruthy();
};

const dayModal = () =>
  within(screen.getByText(ymd(when)).closest('div.fixed') as HTMLElement);

describe('StudentCalendar pending request cancel', () => {
  it('shows Cancel under the Pending 1-1 chip for a cancellable request', () => {
    render(<StudentCalendar meetings={[pending()]} onCancelRequest={vi.fn()} />);
    openDay();

    const chip = dayModal().getByText('Pending 1-1');
    const cancel = screen.getByRole('button', { name: 'Cancel this request' });
    expect(chip.parentElement).toBe(cancel.parentElement);
    expect(chip.compareDocumentPosition(cancel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps the button to the chip size and the shared rose colour', () => {
    render(<StudentCalendar meetings={[pending()]} onCancelRequest={vi.fn()} />);
    openDay();

    const cls = screen.getByRole('button', { name: 'Cancel this request' }).className;
    expect(cls).toContain('text-[10px]');
    expect(cls).toContain('px-2');
    expect(cls).toContain('py-px');
    expect(cls).toContain('rounded-full');
    expect(cls).toContain('text-rose-600');
    expect(cls).not.toMatch(/(bg|text)-red-\d/);
  });

  it('asks for confirmation before cancelling, and Keep backs out', () => {
    const onCancel = vi.fn();
    render(<StudentCalendar meetings={[pending()]} onCancelRequest={onCancel} />);
    openDay();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel this request' }));
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));

    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancel this request' })).toBeTruthy();
  });

  it('cancels on confirm, keeps the day open and tells the student', async () => {
    const onCancel = vi.fn().mockResolvedValue(true);
    const m = pending();
    render(<StudentCalendar meetings={[m]} onCancelRequest={onCancel} />);
    openDay();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel this request' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancel' }));

    expect(onCancel).toHaveBeenCalledWith(m);
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('has been cancelled'),
    );
    expect(screen.queryByTestId('seminar-details')).toBeNull();
    expect(screen.getByText(ymd(when))).toBeTruthy();
  });

  it('shows no success message when the cancel fails', async () => {
    const onCancel = vi.fn().mockResolvedValue(false);
    render(<StudentCalendar meetings={[pending()]} onCancelRequest={onCancel} />);
    openDay();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel this request' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancel' }));

    await waitFor(() => expect(onCancel).toHaveBeenCalled());
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Confirm cancel' }) as HTMLButtonElement).disabled).toBe(false),
    );
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('does not open the session details when Cancel is clicked', () => {
    render(<StudentCalendar meetings={[pending()]} onCancelRequest={vi.fn()} />);
    openDay();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel this request' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText(ymd(when))).toBeTruthy();
  });

  it('hides Cancel when the request is not cancellable', () => {
    render(<StudentCalendar meetings={[pending({ canCancel: false })]} onCancelRequest={vi.fn()} />);
    openDay();
    expect(dayModal().getByText('Pending 1-1')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cancel this request' })).toBeNull();
  });

  it('hides Cancel when no handler is wired', () => {
    render(<StudentCalendar meetings={[pending()]} />);
    openDay();
    expect(screen.queryByRole('button', { name: 'Cancel this request' })).toBeNull();
  });

  it('never shows Cancel in expert mode', () => {
    render(
      <StudentCalendar mode="expert" meetings={[pending()]} onCancelRequest={vi.fn()} onSelectMeeting={vi.fn()} />,
    );
    openDay();
    expect(screen.queryByRole('button', { name: 'Cancel this request' })).toBeNull();
  });
});
