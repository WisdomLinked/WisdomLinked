import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useBackToDashboard } from './useBackToDashboard';

const navigateMock = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

const Harness = ({ activeItem, onGoToDashboard }: { activeItem: string; onGoToDashboard: () => void }) => {
  useBackToDashboard(activeItem, onGoToDashboard);
  return <div>dashboard</div>;
};

const popBack = () => act(() => {
  window.dispatchEvent(new PopStateEvent('popstate'));
});

describe('useBackToDashboard', () => {
  let pushSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    navigateMock.mockClear();
    pushSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
  });

  afterEach(() => {
    pushSpy.mockRestore();
  });

  it('puts one spare history entry in place on mount', () => {
    render(<Harness activeItem="dashboard" onGoToDashboard={() => {}} />);
    expect(pushSpy).toHaveBeenCalledTimes(1);
  });

  it('returns to the dashboard tab instead of leaving, when another tab is open', () => {
    const goToDashboard = vi.fn();
    render(<Harness activeItem="chat" onGoToDashboard={goToDashboard} />);
    pushSpy.mockClear();

    popBack();

    expect(goToDashboard).toHaveBeenCalledTimes(1);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('re-arms the spare entry so the next back press is caught too', () => {
    render(<Harness activeItem="chat" onGoToDashboard={() => {}} />);
    pushSpy.mockClear();

    popBack();

    expect(pushSpy).toHaveBeenCalledTimes(1);
  });

  it('goes to the login page when back is pressed on the dashboard tab', () => {
    const goToDashboard = vi.fn();
    render(<Harness activeItem="dashboard" onGoToDashboard={goToDashboard} />);

    popBack();

    expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true });
    expect(goToDashboard).not.toHaveBeenCalled();
  });

  it('reads the tab open at the moment back is pressed, not the one it mounted with', () => {
    const goToDashboard = vi.fn();
    const { rerender } = render(<Harness activeItem="chat" onGoToDashboard={goToDashboard} />);

    rerender(<Harness activeItem="dashboard" onGoToDashboard={goToDashboard} />);
    popBack();

    expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true });
    expect(goToDashboard).not.toHaveBeenCalled();
  });

  it('stops listening once the dashboard unmounts', () => {
    const goToDashboard = vi.fn();
    const { unmount } = render(<Harness activeItem="chat" onGoToDashboard={goToDashboard} />);

    unmount();
    popBack();

    expect(goToDashboard).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('adds only one spare entry when the tab changes repeatedly', () => {
    const { rerender } = render(<Harness activeItem="dashboard" onGoToDashboard={() => {}} />);
    pushSpy.mockClear();

    ['chat', 'seminars', 'calendar', 'dashboard'].forEach((tab) => {
      rerender(<Harness activeItem={tab} onGoToDashboard={() => {}} />);
    });

    expect(pushSpy).not.toHaveBeenCalled();
  });
});
