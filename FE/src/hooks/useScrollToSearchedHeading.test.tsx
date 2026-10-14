import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React, { useState } from 'react';
import { act, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { findHeading, useScrollToSearchedHeading } from './useScrollToSearchedHeading';

function Page({ lateHeading = false }: { lateHeading?: boolean }) {
  useScrollToSearchedHeading();
  const [shown, setShown] = useState(!lateHeading);
  (window as any).__showHeading = () => setShown(true);
  return (
    <div>
      <h1>Learn from the people who&apos;ve already made it.</h1>
      {shown ? (
        <h2>
          Connect to Knowledge <span>Across the Globe</span>
        </h2>
      ) : null}
    </div>
  );
}

const renderAt = (state: unknown, lateHeading = false) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: '/', state }]}>
      <Page lateHeading={lateHeading} />
    </MemoryRouter>,
  );

describe('findHeading', () => {
  it('matches heading text across nested markup, spacing and case', () => {
    document.body.innerHTML = '<h2>Connect to   Knowledge <span>Across the Globe</span></h2><h3>Other</h3>';
    expect(findHeading('connect to knowledge across the globe')?.tagName).toBe('H2');
    expect(findHeading('Other')?.tagName).toBe('H3');
  });

  it('finds nothing for a missing or empty title', () => {
    document.body.innerHTML = '<h2>Pricing</h2>';
    expect(findHeading('Guidelines')).toBeNull();
    expect(findHeading('')).toBeNull();
  });
});

describe('useScrollToSearchedHeading', () => {
  let scrollTo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    scrollTo = vi.fn();
    window.scrollTo = scrollTo as any;
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('scrolls to the heading a search result named', () => {
    renderAt({ searchHeading: 'Connect to Knowledge Across the Globe' });
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the page was not opened from a search result', () => {
    renderAt(null);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('waits for a heading that renders late', () => {
    renderAt({ searchHeading: 'Connect to Knowledge Across the Globe' }, true);
    expect(scrollTo).not.toHaveBeenCalled();
    act(() => {
      (window as any).__showHeading();
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('gives up quietly when the heading never appears', () => {
    renderAt({ searchHeading: 'A heading that is not on this page' });
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
