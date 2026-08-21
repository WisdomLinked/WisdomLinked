import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import StudentExpertBookingPicker from './StudentExpertBookingPicker';

const ROW_H = 100;
const COL_W = 100;

const store = configureStore({
  reducer: { auth: () => ({ userDetails: { _id: 's1', timeZone: 'UTC' } }) },
});

const expert = {
  _id: 'expert-1',
  timeSlots: Array.from({ length: 48 }, (_, i) => i),
  price: 60,
  timeZone: 'UTC',
  bookingNoticeHours: 24,
  events: [],
  groupChats: [
    {
      _id: 'gc1',
      type: 'seminar',
      name: 'Seminar',
      start: new Date('2026-06-18T02:00:00.000Z'),
      end: new Date('2026-06-18T03:00:00.000Z'),
    },
  ],
  pendingGroupChats: [],
};

function layout() {
  const rows = Array.from(document.querySelectorAll('.rbc-row-bg')) as HTMLElement[];
  rows.forEach((row, i) => {
    const top = i * ROW_H;
    row.getBoundingClientRect = () =>
      ({
        top,
        left: 0,
        right: 7 * COL_W,
        bottom: top + ROW_H,
        width: 7 * COL_W,
        height: ROW_H,
        x: 0,
        y: top,
        toJSON: () => ({}),
      }) as DOMRect;
    Object.defineProperty(row, 'offsetWidth', { value: 7 * COL_W, configurable: true });
    Object.defineProperty(row, 'offsetHeight', { value: ROW_H, configurable: true });
  });
  (document as any).elementFromPoint = (x: number, y: number) => {
    const row = rows[Math.floor(y / ROW_H)];
    if (!row) return document.body;
    return (row.children[Math.floor(x / COL_W)] as HTMLElement) ?? row;
  };
  return rows;
}

function clickAt(x: number, y: number, targetOverride?: HTMLElement) {
  const target = targetOverride ?? ((document as any).elementFromPoint(x, y) as HTMLElement);
  for (const type of ['mousedown', 'mouseup', 'click']) {
    const e = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      button: 0,
    });
    Object.defineProperty(e, 'pageX', { value: x });
    Object.defineProperty(e, 'pageY', { value: y });
    act(() => {
      target.dispatchEvent(e);
    });
  }
  act(() => {
    vi.advanceTimersByTime(20);
  });
}

const monthLabel = () => document.querySelector('.rbc-toolbar-label')!.textContent;
const timeModalOpen = () => !!screen.queryByText('Choose a time');
const cancelModal = () =>
  act(() => {
    screen.getByRole('button', { name: 'Cancel' }).click();
  });

function renderPicker() {
  render(
    <Provider store={store}>
      <StudentExpertBookingPicker expert={expert} onSlotSelected={vi.fn()} />
    </Provider>,
  );
}

describe('StudentExpertBookingPicker calendar clicks', { timeout: 20_000 }, () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-06-10T12:00:00.000Z'));
  });

  afterEach(() => vi.useRealTimers());

  it('reopens the time modal when the same day is clicked again', () => {
    renderPicker();
    layout();

    clickAt(3 * COL_W + 50, 3 * ROW_H + 50);
    expect(timeModalOpen()).toBe(true);

    cancelModal();
    expect(timeModalOpen()).toBe(false);

    layout();
    clickAt(3 * COL_W + 50, 3 * ROW_H + 50);
    expect(timeModalOpen()).toBe(true);
  });

  it('stays on the navigated month after the time modal closes', () => {
    renderPicker();
    act(() => {
      screen.getByRole('button', { name: 'Next' }).click();
    });
    expect(monthLabel()).toBe('July 2026');

    layout();
    clickAt(3 * COL_W + 50, 3 * ROW_H + 50);
    expect(timeModalOpen()).toBe(true);

    cancelModal();
    expect(monthLabel()).toBe('July 2026');
  });

  it('opens the day when the click lands on a session chip', () => {
    renderPicker();
    layout();
    const chip = document.querySelector('.rbc-event') as HTMLElement;
    expect(chip).toBeTruthy();

    clickAt(4 * COL_W + 50, 2 * ROW_H + 50, chip);
    expect(timeModalOpen()).toBe(true);
  });
});
