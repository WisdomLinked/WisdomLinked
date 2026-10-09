import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SelectionWithCheckBox from './SelectionWithCheckBox';

const options = [
  { value: 'ReviewQueue', label: 'Needs review' },
  { value: 'User', label: 'All users' },
  { value: 'PendingUser', label: 'Pending email verify' },
];

function openMenu(container: HTMLElement) {
  const input = container.querySelector('input[role="combobox"]') as HTMLElement;
  fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' });
}

function boxes() {
  return screen
    .getAllByRole('option')
    .map((option) => ({
      label: option.textContent?.trim() ?? '',
      checked: (option.querySelector('input[type="checkbox"]') as HTMLInputElement)?.checked,
    }));
}

function show(props: Partial<React.ComponentProps<typeof SelectionWithCheckBox>> = {}) {
  const set_selectedOptions = vi.fn();
  const utils = render(
    <SelectionWithCheckBox
      options={options}
      selectedOptions={options[0]}
      set_selectedOptions={set_selectedOptions}
      placeholder="Choose"
      isMulti={false}
      {...props}
    />,
  );
  openMenu(utils.container);
  return { ...utils, set_selectedOptions };
}

describe('SelectionWithCheckBox', () => {
  it('ticks the option that is actually selected', () => {
    show();
    expect(boxes()).toEqual([
      { label: 'Needs review', checked: true },
      { label: 'All users', checked: false },
      { label: 'Pending email verify', checked: false },
    ]);
  });

  // The regression this component existed with for a long time: the tick was set once
  // when the menu opened and then never moved, so it showed the PREVIOUS selection.
  it('moves the tick when the selection changes while the menu stays open', () => {
    const { rerender, container } = show();
    expect(boxes()[0].checked).toBe(true);

    rerender(
      <SelectionWithCheckBox
        options={options}
        selectedOptions={options[1]}
        set_selectedOptions={vi.fn()}
        placeholder="Choose"
        isMulti={false}
      />,
    );
    expect(container.querySelectorAll('[role="option"]').length).toBeGreaterThan(0);

    expect(boxes()).toEqual([
      { label: 'Needs review', checked: false },
      { label: 'All users', checked: true },
      { label: 'Pending email verify', checked: false },
    ]);
  });

  it('reports the option that was clicked', () => {
    const { set_selectedOptions } = show();
    fireEvent.click(screen.getByText('All users'));
    expect(set_selectedOptions).toHaveBeenCalledTimes(1);
    expect(set_selectedOptions.mock.calls[0][0]).toMatchObject({ value: 'User' });
  });

  it('still selects when the click lands on the tick itself', () => {
    const { set_selectedOptions } = show();
    const box = screen
      .getAllByRole('option')
      .find((o) => o.textContent?.includes('All users'))!
      .querySelector('input[type="checkbox"]') as HTMLInputElement;

    fireEvent.click(box);
    expect(set_selectedOptions).toHaveBeenCalledTimes(1);
    expect(set_selectedOptions.mock.calls[0][0]).toMatchObject({ value: 'User' });
  });

  it('ticks every selected option in multi-select mode', () => {
    show({ isMulti: true, selectedOptions: [options[0], options[2]] });
    expect(boxes()).toEqual([
      { label: 'Needs review', checked: true },
      { label: 'All users', checked: false },
      { label: 'Pending email verify', checked: true },
    ]);
  });

  it('ticks nothing when nothing is selected', () => {
    show({ selectedOptions: null });
    expect(boxes().every((b) => b.checked === false)).toBe(true);
  });

  it('keeps the tick out of the keyboard and screen-reader path, since the row carries the state', () => {
    show();
    const box = screen
      .getAllByRole('option')[0]
      .querySelector('input[type="checkbox"]') as HTMLInputElement;

    expect(box.tabIndex).toBe(-1);
    expect(box.getAttribute('aria-hidden')).toBe('true');
    expect(box.readOnly).toBe(true);
  });
});
