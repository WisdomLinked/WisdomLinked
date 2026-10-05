import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PhoneField from './PhoneField';
import { initialPhoneCountry, toE164 } from '../../utils/phone';

function Harness({ stored = '', profileCountry = 'AL' }: { stored?: string; profileCountry?: string }) {
  const [value, setValue] = useState(toE164(stored) ?? '');
  const [country, setCountry] = useState<string>(initialPhoneCountry(stored, profileCountry));
  return (
    <>
      <PhoneField value={value} onChange={setValue} country={country} onCountryChange={setCountry} />
      <button type="button" onClick={() => setValue(toE164(stored) ?? '')}>
        Reset
      </button>
      <output data-testid="value">{value}</output>
      <output data-testid="country">{country}</output>
    </>
  );
}

const input = () => screen.getByLabelText('Phone number') as HTMLInputElement;
const trigger = () => screen.getByRole('button', { name: /^Phone country:/ });

describe('PhoneField', () => {
  it('loads a stored US number with its flag and code', () => {
    render(<Harness stored="+12025550123" />);
    expect(trigger()).toHaveAccessibleName('Phone country: United States');
    expect(input()).toHaveValue('+1 202 555 0123');
  });

  it('loads a stored Indian number with its flag and code', () => {
    render(<Harness stored="919876543210" />);
    expect(trigger()).toHaveAccessibleName('Phone country: India');
    expect(input()).toHaveValue('+91 98765 43210');
  });

  it('loads a number whose country cannot be determined under its calling code', () => {
    render(<Harness stored="15454545454" />);
    expect(trigger()).toHaveAccessibleName('Phone country: United States');
    expect(input()).toHaveValue('+1 545 454 5454');
  });

  it('shows only the locked code plus an example placeholder when empty, without a value', () => {
    render(<Harness />);
    expect(trigger()).toHaveAccessibleName('Phone country: Albania');
    expect(input()).toHaveValue('+355');
    expect(screen.getByText(/^6\d/)).toHaveClass('text-slate-400');
    expect(screen.getByTestId('value')).toBeEmptyDOMElement();
  });

  it('keyboard: pick a country, code appears, focus moves to the input, value stays empty', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    trigger().focus();
    await user.keyboard('{Enter}');
    await user.keyboard('united states');
    await user.keyboard('{ArrowDown}{ArrowUp}{Enter}');
    expect(trigger()).toHaveAccessibleName('Phone country: United States');
    expect(input()).toHaveFocus();
    expect(input()).toHaveValue('+1');
    expect(screen.getByText('201 555 0123')).toBeInTheDocument();
    expect(screen.getByTestId('value')).toBeEmptyDOMElement();
    expect(screen.getByTestId('country')).toHaveTextContent('US');

    await user.keyboard('2025550123');
    expect(input()).toHaveValue('+1 202 555 0123');
    expect(screen.getByTestId('value')).toHaveTextContent('+12025550123');
    expect(screen.queryByText('201 555 0123')).not.toBeInTheDocument();
  });

  it('keeps the national digits and swaps only the code when the country changes', async () => {
    const user = userEvent.setup();
    render(<Harness stored="+12025550123" />);
    await user.click(trigger());
    await user.keyboard('india +91{Enter}');
    expect(input()).toHaveValue('+91 20 2555 0123');
    expect(trigger()).toHaveAccessibleName('Phone country: India');
    expect(input()).toHaveFocus();
    expect(screen.getByTestId('value')).toHaveTextContent('+912025550123');
  });

  it('does not let Backspace remove the calling code', async () => {
    const user = userEvent.setup();
    render(<Harness stored="+355" />);
    await user.click(input());
    await user.keyboard('{End}{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}');
    expect(input()).toHaveValue('+355');
    expect(trigger()).toHaveAccessibleName('Phone country: Albania');
  });

  it('switches country when a full international number is pasted', () => {
    render(<Harness />);
    fireEvent.paste(input(), { clipboardData: { getData: () => '+44 20 7946 0958' } });
    expect(trigger()).toHaveAccessibleName('Phone country: United Kingdom');
    expect(input()).toHaveValue('+44 20 7946 0958');
    expect(screen.getByTestId('value')).toHaveTextContent('+442079460958');
    expect(screen.getByTestId('country')).toHaveTextContent('GB');
  });

  it('keeps a picked phone country through a reset of an empty field', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(trigger());
    await user.keyboard('japan{Enter}');
    await user.keyboard('9012345678');
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('value')).toBeEmptyDOMElement();
    expect(trigger()).toHaveAccessibleName('Phone country: Japan');
    expect(input()).toHaveValue('+81');
  });
});
