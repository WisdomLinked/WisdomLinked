import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ContactFormModal from './ContactFormModal';

const { doContactUs } = vi.hoisted(() => ({ doContactUs: vi.fn() }));
vi.mock('../api/api', () => ({ doContactUs }));

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText('e.g. Sarah Chen'), 'Sarah Chen');
  await user.type(screen.getByPlaceholderText('you@example.com'), 'sarah@example.com');
  await user.type(screen.getByPlaceholderText('e.g. Graduate school application'), 'Admissions');
  await user.type(screen.getByPlaceholderText(/Brief message/), 'Hello');
}

describe('ContactFormModal phone', () => {
  it('uses the shared phone field with the full country list', async () => {
    const user = userEvent.setup();
    render(<ContactFormModal onClose={() => {}} />);
    expect(screen.getByLabelText('Contact number')).toHaveAttribute('id', 'contact-phone');
    await user.click(screen.getByRole('button', { name: /^Phone country:/ }));
    await user.keyboard('iceland');
    expect(screen.getByRole('option', { name: /Iceland/ })).toBeInTheDocument();
  });

  it('shows the profile validation message for a short number', async () => {
    const user = userEvent.setup();
    render(<ContactFormModal onClose={() => {}} />);
    await fillRequired(user);
    await user.type(screen.getByLabelText('Contact number'), '202');
    await user.click(screen.getByRole('button', { name: /Send/ }));
    expect(screen.getByText('Enter a valid phone number')).toBeInTheDocument();
    expect(doContactUs).not.toHaveBeenCalled();
  });

  it('submits the calling code and national digits separately', async () => {
    const user = userEvent.setup();
    render(<ContactFormModal onClose={() => {}} />);
    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: /^Phone country:/ }));
    await user.keyboard('united kingdom{Enter}');
    await user.keyboard('2071838750');
    await user.click(screen.getByRole('button', { name: /Send/ }));
    expect(doContactUs).toHaveBeenCalledWith(
      expect.objectContaining({ countryCode: '+44', contactNumber: '2071838750' }),
    );
  });
});
