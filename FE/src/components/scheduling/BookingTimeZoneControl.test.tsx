import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BookingTimeZoneControl from './BookingTimeZoneControl';

describe('BookingTimeZoneControl', () => {
  it('offers mine and custom modes, with no expert option', () => {
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
    expect(screen.queryByRole('button', { name: /Expert/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Choose timezone/i }));
    expect(onModeChange).toHaveBeenCalledWith('custom');
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
