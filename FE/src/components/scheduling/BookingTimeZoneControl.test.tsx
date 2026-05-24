import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BookingTimeZoneControl from './BookingTimeZoneControl';

describe('BookingTimeZoneControl', () => {
  it('defaults to mine mode and switches to expert', () => {
    const onModeChange = vi.fn();
    render(
      <BookingTimeZoneControl
        mode="mine"
        customTimeZone="UTC"
        expertTimeZone="America/New_York"
        studentTimeZone="Asia/Kolkata"
        onModeChange={onModeChange}
        onCustomTimeZoneChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Expert/i }));
    expect(onModeChange).toHaveBeenCalledWith('expert');
  });

  it('shows timezone select in custom mode', () => {
    render(
      <BookingTimeZoneControl
        mode="custom"
        customTimeZone="UTC"
        expertTimeZone="America/New_York"
        onModeChange={vi.fn()}
        onCustomTimeZoneChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Choose timezone')).toBeInTheDocument();
  });
});
