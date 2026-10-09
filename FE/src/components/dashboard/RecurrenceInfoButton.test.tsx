import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RecurrenceInfoButton from './RecurrenceInfoButton';

const open = (lines = ['Repeats weekly · 12 sessions', 'Runs Oct 1 – Dec 26']) => {
  render(<RecurrenceInfoButton title="Recurring seminar" lines={lines} />);
  return screen.getByRole('button', { name: 'Recurring seminar schedule' });
};

describe('RecurrenceInfoButton', () => {
  beforeEach(() => {
    vi.stubGlobal('innerWidth', 1100);
    vi.stubGlobal('innerHeight', 750);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  it('shows nothing until it is hovered', () => {
    open();

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.queryByText('Recurring seminar')).not.toBeInTheDocument();
  });

  it('shows the schedule on hover', () => {
    fireEvent.mouseEnter(open());

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByText('Recurring seminar')).toBeInTheDocument();
    expect(screen.getByText('Repeats weekly · 12 sessions')).toBeInTheDocument();
    expect(screen.getByText('Runs Oct 1 – Dec 26')).toBeInTheDocument();
  });

  it('hides it again when the pointer leaves', () => {
    const button = open();
    fireEvent.mouseEnter(button);
    fireEvent.mouseLeave(button);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows the schedule on keyboard focus, so it is not hover-only', () => {
    fireEvent.focus(open());

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('opens on a tap, which is the only way to reach it on a phone', () => {
    fireEvent.click(open());

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('closes on a second tap', () => {
    const button = open();
    fireEvent.click(button);
    fireEvent.click(button);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('keeps the first touch tap open when the browser sends hover and focus before click', () => {
    const button = open();
    fireEvent.pointerDown(button, { pointerType: 'touch' });
    fireEvent.mouseEnter(button);
    fireEvent.focus(button);
    fireEvent.click(button);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.pointerDown(button, { pointerType: 'touch' });
    fireEvent.click(button);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('closes on Escape', () => {
    const button = open();
    fireEvent.focus(button);
    fireEvent.keyDown(button, { key: 'Escape' });

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('reports its open state to assistive tech', () => {
    const button = open();
    expect(button).toHaveAttribute('aria-expanded', 'false');

    fireEvent.mouseEnter(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('does not let the tap reach the title button it sits beside', () => {
    const onParentClick = vi.fn();
    render(
      <div onClick={onParentClick}>
        <RecurrenceInfoButton title="Recurring seminar" lines={['Repeats weekly']} />
      </div>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Recurring seminar schedule' }));

    expect(onParentClick).not.toHaveBeenCalled();
  });

  it('renders only the lines it was given', () => {
    fireEvent.mouseEnter(open(['Repeats weekly']));

    expect(screen.getByText('Repeats weekly')).toBeInTheDocument();
    expect(screen.queryByText(/Runs/)).not.toBeInTheDocument();
  });

  it('opens to the right and follows the icon when its container scrolls', () => {
    const button = open();
    const rect = { left: 200, right: 214, top: 150, bottom: 164, width: 14, height: 14 };
    vi.spyOn(button, 'getBoundingClientRect').mockImplementation(() => rect as DOMRect);
    fireEvent.focus(button);
    const panel = screen.getByRole('tooltip');
    expect(Number.parseFloat(panel.style.left)).toBeGreaterThan(rect.right);
    expect(Number.parseFloat(panel.style.top)).toBe(rect.top);

    rect.top -= 30;
    rect.bottom -= 30;
    fireEvent.scroll(window);
    expect(Number.parseFloat(panel.style.top)).toBe(rect.top);
    fireEvent.blur(button);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('repositions after resizing from desktop to phone', () => {
    const button = open();
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
      left: 200, right: 214, top: 80, bottom: 94, width: 14, height: 14,
    } as DOMRect);
    fireEvent.focus(button);
    vi.stubGlobal('innerWidth', 390);
    fireEvent.resize(window);
    const panel = screen.getByRole('tooltip');
    expect(Number.parseFloat(panel.style.left) + Number.parseFloat(panel.style.width)).toBeLessThanOrEqual(382);
    expect(Number.parseFloat(panel.style.top)).toBeGreaterThan(94);
  });

  it.each([390, 1100])('keeps the full panel above the bottom edge at width %i', width => {
    vi.stubGlobal('innerWidth', width);
    vi.stubGlobal('innerHeight', 500);
    const button = open();
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
      left: 200, right: 214, top: 465, bottom: 479, width: 14, height: 14,
    } as DOMRect);
    fireEvent.focus(button);
    const panel = screen.getByRole('tooltip');
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({ height: 100 } as DOMRect);
    fireEvent.resize(window);
    const top = Number.parseFloat(panel.style.top);
    expect(top).toBeGreaterThanOrEqual(8);
    expect(top + 100).toBeLessThanOrEqual(492);
  });

  it('keeps the panel on screen at phone width rather than centring off the edge', () => {
    const button = open();
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
      bottom: 100, left: 370, width: 14, height: 14, top: 86, right: 384, x: 370, y: 86,
      toJSON: () => ({}),
    } as DOMRect);
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });

    fireEvent.mouseEnter(button);

    const panel = screen.getByRole('tooltip');
    const left = Number.parseFloat(panel.style.left);
    expect(left).toBeGreaterThanOrEqual(8);
    expect(left + Number.parseFloat(panel.style.width)).toBeLessThanOrEqual(390);
  });
});
