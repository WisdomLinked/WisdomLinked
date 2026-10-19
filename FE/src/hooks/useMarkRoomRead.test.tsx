import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { flushOwedChatReads, useMarkRoomRead } from './useMarkRoomRead';
import { MARK_READ_DEBOUNCE_MS, MARK_READ_MIN_GAP_MS } from '../utils/markReadSchedule';

type Props = {
  roomId: string | null;
  owed: boolean;
  activity?: unknown;
  report: (rid: string) => Promise<boolean>;
  onExit?: (rid: string) => void;
};

const Harness = ({ roomId, owed, activity, report, onExit }: Props) => {
  useMarkRoomRead(roomId, owed, activity, report, onExit);
  return null;
};

const settle = () => act(async () => {
  await Promise.resolve();
  await Promise.resolve();
});

describe('useMarkRoomRead', () => {
  let report: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    report = vi.fn(async () => true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports the read once the debounce runs out', async () => {
    render(<Harness roomId="A" owed activity={1} report={report} />);
    act(() => { vi.advanceTimersByTime(MARK_READ_DEBOUNCE_MS - 1); });
    expect(report).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith('A');
  });

  it('does nothing while the newest message is the user\'s own', () => {
    const { unmount } = render(<Harness roomId="A" owed={false} activity={1} report={report} />);
    act(() => { vi.advanceTimersByTime(MARK_READ_MIN_GAP_MS * 2); });
    unmount();
    expect(report).not.toHaveBeenCalled();
  });

  it('sends the read immediately when the user leaves before the debounce', () => {
    const { unmount } = render(<Harness roomId="A" owed activity={1} report={report} />);
    act(() => { vi.advanceTimersByTime(400); });
    unmount();
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith('A');
    act(() => { vi.advanceTimersByTime(MARK_READ_MIN_GAP_MS); });
    expect(report).toHaveBeenCalledTimes(1);
  });

  it('sends the previous room immediately when switching chats, then the new one after its own delay', () => {
    const { rerender } = render(<Harness roomId="A" owed activity="a" report={report} />);
    act(() => { vi.advanceTimersByTime(300); });
    rerender(<Harness roomId="B" owed activity="b" report={report} />);
    expect(report.mock.calls).toEqual([['A']]);
    act(() => { vi.advanceTimersByTime(MARK_READ_DEBOUNCE_MS); });
    expect(report.mock.calls).toEqual([['A'], ['B']]);
  });

  it('keeps the read owed when the user replies before the debounce', () => {
    const { rerender } = render(<Harness roomId="A" owed activity={1} report={report} />);
    act(() => { vi.advanceTimersByTime(300); });
    rerender(<Harness roomId="A" owed={false} activity={2} report={report} />);
    act(() => { vi.advanceTimersByTime(MARK_READ_DEBOUNCE_MS); });
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith('A');
  });

  it('reading two chats in a row: the second is still sent when the user leaves inside the rate-limit window', async () => {
    const { rerender, unmount } = render(<Harness roomId="DM" owed activity="dm" report={report} />);
    act(() => { vi.advanceTimersByTime(MARK_READ_DEBOUNCE_MS); });
    await settle();
    rerender(<Harness roomId="SEM" owed activity="sem" report={report} />);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(report.mock.calls).toEqual([['DM']]);
    unmount();
    expect(report.mock.calls).toEqual([['DM'], ['SEM']]);
  });

  it('still waits out the rate-limit window while the user stays in the chat', async () => {
    const { rerender } = render(<Harness roomId="DM" owed activity="dm" report={report} />);
    act(() => { vi.advanceTimersByTime(MARK_READ_DEBOUNCE_MS); });
    await settle();
    rerender(<Harness roomId="SEM" owed activity="sem" report={report} />);
    // The window runs from the moment the DM read was accepted, which is when the switch happened.
    act(() => { vi.advanceTimersByTime(MARK_READ_MIN_GAP_MS - 1); });
    expect(report.mock.calls).toEqual([['DM']]);
    act(() => { vi.advanceTimersByTime(1); });
    expect(report.mock.calls).toEqual([['DM'], ['SEM']]);
  });

  it('new incoming messages restart the debounce instead of sending one report each', () => {
    const { rerender } = render(<Harness roomId="A" owed activity={1} report={report} />);
    act(() => { vi.advanceTimersByTime(800); });
    rerender(<Harness roomId="A" owed activity={2} report={report} />);
    act(() => { vi.advanceTimersByTime(800); });
    rerender(<Harness roomId="A" owed activity={3} report={report} />);
    act(() => { vi.advanceTimersByTime(MARK_READ_DEBOUNCE_MS); });
    expect(report).toHaveBeenCalledTimes(1);
  });

  it('does not send again on leaving once the read has already gone out', () => {
    const { unmount } = render(<Harness roomId="A" owed activity={1} report={report} />);
    act(() => { vi.advanceTimersByTime(MARK_READ_DEBOUNCE_MS); });
    unmount();
    expect(report).toHaveBeenCalledTimes(1);
  });

  it('leaving a chat with nothing owed sends nothing', () => {
    const { rerender, unmount } = render(<Harness roomId="A" owed={false} activity={1} report={report} />);
    rerender(<Harness roomId="B" owed={false} activity={2} report={report} />);
    unmount();
    expect(report).not.toHaveBeenCalled();
  });

  it('a rejected report does not start the rate-limit window', async () => {
    report.mockResolvedValueOnce(false);
    const { rerender } = render(<Harness roomId="A" owed activity="a" report={report} />);
    act(() => { vi.advanceTimersByTime(MARK_READ_DEBOUNCE_MS); });
    await settle();
    rerender(<Harness roomId="B" owed activity="b" report={report} />);
    act(() => { vi.advanceTimersByTime(MARK_READ_DEBOUNCE_MS); });
    expect(report.mock.calls).toEqual([['A'], ['B']]);
  });

  it('a report that throws is swallowed', async () => {
    report.mockRejectedValueOnce(new Error('network'));
    render(<Harness roomId="A" owed activity={1} report={report} />);
    act(() => { vi.advanceTimersByTime(MARK_READ_DEBOUNCE_MS); });
    await settle();
    expect(report).toHaveBeenCalledTimes(1);
  });
describe('when the page is hidden or closed', () => {
    const setVisibility = (state: 'hidden' | 'visible') => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    afterEach(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    });

    it('sends an owed read through the exit reporter on pagehide, and only once', () => {
      const onExit = vi.fn();
      const { unmount } = render(<Harness roomId="A" owed activity={1} report={report} onExit={onExit} />);
      act(() => { vi.advanceTimersByTime(300); });
      act(() => { window.dispatchEvent(new Event('pagehide')); });
      expect(onExit.mock.calls).toEqual([['A']]);
      act(() => { vi.advanceTimersByTime(MARK_READ_MIN_GAP_MS); });
      unmount();
      expect(report).not.toHaveBeenCalled();
      expect(onExit).toHaveBeenCalledTimes(1);
    });

    it('sends an owed read when the tab becomes hidden', () => {
      const onExit = vi.fn();
      render(<Harness roomId="A" owed activity={1} report={report} onExit={onExit} />);
      act(() => { setVisibility('hidden'); });
      expect(onExit.mock.calls).toEqual([['A']]);
    });

    it('does nothing when the tab becomes visible again', () => {
      const onExit = vi.fn();
      render(<Harness roomId="A" owed activity={1} report={report} onExit={onExit} />);
      act(() => { setVisibility('visible'); });
      expect(onExit).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(MARK_READ_DEBOUNCE_MS); });
      expect(report.mock.calls).toEqual([['A']]);
    });

    it('sends nothing on exit when no read is owed', () => {
      const onExit = vi.fn();
      render(<Harness roomId="A" owed={false} activity={1} report={report} onExit={onExit} />);
      act(() => { window.dispatchEvent(new Event('pagehide')); });
      expect(onExit).not.toHaveBeenCalled();
      expect(report).not.toHaveBeenCalled();
    });

    it('sends nothing on exit once the read already went out', () => {
      const onExit = vi.fn();
      render(<Harness roomId="A" owed activity={1} report={report} onExit={onExit} />);
      act(() => { vi.advanceTimersByTime(MARK_READ_DEBOUNCE_MS); });
      act(() => { window.dispatchEvent(new Event('pagehide')); });
      expect(report).toHaveBeenCalledTimes(1);
      expect(onExit).not.toHaveBeenCalled();
    });

    it('falls back to the normal report when no exit reporter is given', () => {
      render(<Harness roomId="A" owed activity={1} report={report} />);
      act(() => { window.dispatchEvent(new Event('pagehide')); });
      expect(report.mock.calls).toEqual([['A']]);
    });

  });

  describe('flushOwedChatReads (logout)', () => {
    it('sends a read that is still waiting and resolves once it is answered', async () => {
      let answer: (ok: boolean) => void = () => undefined;
      report = vi.fn(() => new Promise<boolean>(resolve => { answer = resolve; }));
      render(<Harness roomId="A" owed activity={1} report={report} />);
      act(() => { vi.advanceTimersByTime(300); });

      let done = false;
      const flushed = flushOwedChatReads().then(() => { done = true; });
      expect(report).toHaveBeenCalledTimes(1);
      expect(report).toHaveBeenCalledWith('A');
      await settle();
      expect(done).toBe(false);

      answer(true);
      await act(async () => { await flushed; });
      expect(done).toBe(true);

      // The read is not sent a second time when its original delay runs out.
      act(() => { vi.advanceTimersByTime(MARK_READ_MIN_GAP_MS); });
      expect(report).toHaveBeenCalledTimes(1);
    });

    it('resolves at once when nothing is waiting', async () => {
      render(<Harness roomId="A" owed={false} activity={1} report={report} />);
      await act(async () => { await flushOwedChatReads(); });
      expect(report).not.toHaveBeenCalled();
    });

    it('does not hold logout up for longer than its timeout', async () => {
      report = vi.fn(() => new Promise<boolean>(() => undefined));
      render(<Harness roomId="A" owed activity={1} report={report} />);
      let done = false;
      const flushed = flushOwedChatReads(2000).then(() => { done = true; });
      await act(async () => { vi.advanceTimersByTime(1999); });
      expect(done).toBe(false);
      await act(async () => { vi.advanceTimersByTime(1); await flushed; });
      expect(done).toBe(true);
    });

    it('a failed send does not reject, so logout always continues', async () => {
      report = vi.fn(async () => { throw new Error('network'); });
      render(<Harness roomId="A" owed activity={1} report={report} />);
      await act(async () => { await flushOwedChatReads(); });
      expect(report).toHaveBeenCalledTimes(1);
    });

    it('forgets a chat that has been closed', async () => {
      const { unmount } = render(<Harness roomId="A" owed activity={1} report={report} />);
      unmount();
      expect(report).toHaveBeenCalledTimes(1);
      await act(async () => { await flushOwedChatReads(); });
      expect(report).toHaveBeenCalledTimes(1);
    });
  });
});
