import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { stageHeadingId, useActiveStage } from './useActiveStage';

const IDS = ['one', 'two', 'three'];

let observerCallback: IntersectionObserverCallback;

function Harness() {
  const { activeId, scrollToStage } = useActiveStage(IDS);
  return (
    <div>
      <output data-testid="active">{activeId}</output>
      {IDS.map((id) => (
        <section key={id} id={id}>
          <h2 id={stageHeadingId(id)} tabIndex={-1}>
            {id}
          </h2>
          <button type="button" onClick={() => scrollToStage(id)}>
            go {id}
          </button>
        </section>
      ))}
    </div>
  );
}

function mockReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes('reduce'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as any;
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  (globalThis as any).IntersectionObserver = vi.fn((cb: IntersectionObserverCallback) => {
    observerCallback = cb;
    return { observe: vi.fn(), disconnect: vi.fn(), unobserve: vi.fn() };
  });
});

afterEach(() => {
  delete (globalThis as any).IntersectionObserver;
});

describe('useActiveStage', () => {
  it('marks the latest stage in the reading band as active', () => {
    mockReducedMotion(false);
    render(<Harness />);
    expect(screen.getByTestId('active')).toHaveTextContent('one');
    const report = (id: string, isIntersecting: boolean) =>
      act(() => {
        observerCallback(
          [{ target: document.getElementById(id)!, isIntersecting }] as any,
          {} as IntersectionObserver,
        );
      });
    report('two', true);
    report('three', true);
    expect(screen.getByTestId('active')).toHaveTextContent('three');
    report('three', false);
    expect(screen.getByTestId('active')).toHaveTextContent('two');
  });

  it('scrolls smoothly, focuses the heading and updates the hash', () => {
    mockReducedMotion(false);
    render(<Harness />);
    act(() => screen.getByText('go three').click());
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(document.activeElement).toBe(document.getElementById(stageHeadingId('three')));
    expect(window.location.hash).toBe('#three');
    expect(screen.getByTestId('active')).toHaveTextContent('three');
  });

  it('jumps without animation when reduced motion is preferred', () => {
    mockReducedMotion(true);
    render(<Harness />);
    act(() => screen.getByText('go two').click());
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
  });
});
