import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserDialogShell from './UserDialogShell';

const setup = (children?: React.ReactNode) => {
  const onDismiss = vi.fn();
  render(
    <UserDialogShell labelledBy="title" onDismiss={onDismiss}>
      <h2 id="title">Title</h2>
      {children ?? (
        <>
          <p>Some text</p>
          <textarea aria-label="Box" />
          <button type="button">One</button>
          <button type="button">Two</button>
        </>
      )}
    </UserDialogShell>,
  );
  return { onDismiss, actor: userEvent.setup(), dialog: screen.getByRole('dialog', { name: 'Title' }) };
};

const afterOpenWindow = () => {
  const now = Date.now();
  vi.spyOn(Date, 'now').mockReturnValue(now + 1000);
};

describe('UserDialogShell', () => {
  afterEach(() => vi.restoreAllMocks());

  it('a press and release on the backdrop closes it', () => {
    const { onDismiss, dialog } = setup();
    afterOpenWindow();
    fireEvent.mouseDown(dialog);
    fireEvent.click(dialog);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('a drag from inside that ends on the backdrop does not close it', () => {
    const { onDismiss, dialog } = setup();
    afterOpenWindow();
    fireEvent.mouseDown(screen.getByRole('textbox'));
    fireEvent.click(dialog);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('the second click of a double click does not close it', () => {
    const { onDismiss, dialog } = setup();
    fireEvent.mouseDown(dialog);
    fireEvent.click(dialog);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('the backdrop works exactly when the double-click window ends', () => {
    const { onDismiss, dialog } = setup();
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now + 300);
    fireEvent.mouseDown(dialog);
    fireEvent.click(dialog);
    expect(onDismiss).not.toHaveBeenCalled();
    clock.mockReturnValue(now + 1000);
    fireEvent.mouseDown(dialog);
    fireEvent.click(dialog);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('a click inside does not close it', async () => {
    const { actor, onDismiss } = setup();
    afterOpenWindow();
    await actor.click(screen.getByText('Some text'));
    await actor.click(screen.getByRole('textbox'));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('pressing the backdrop leaves the cursor where it was; pressing inside behaves normally', () => {
    const { dialog } = setup();
    expect(fireEvent.mouseDown(dialog)).toBe(false);
    expect(fireEvent.mouseDown(screen.getByRole('textbox'))).toBe(true);
  });

  it('Escape closes it, even after clicking plain text inside', async () => {
    const { actor, onDismiss } = setup();
    await actor.click(screen.getByText('Some text'));
    expect(document.activeElement).toBe(screen.getByRole('dialog').firstElementChild);
    await actor.keyboard('{Escape}');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('Tab goes round inside it, both ways', async () => {
    const { actor } = setup();
    const box = screen.getByRole('textbox');
    const two = screen.getByRole('button', { name: 'Two' });
    two.focus();
    await actor.tab();
    expect(box).toHaveFocus();
    await actor.tab({ shift: true });
    expect(two).toHaveFocus();
  });

  it('Shift+Tab from the box itself after clicking text goes to the last control', async () => {
    const { actor } = setup();
    await actor.click(screen.getByText('Some text'));
    await actor.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Two' })).toHaveFocus();
  });

  it('Tab skips disabled controls when going round', async () => {
    const { actor } = setup(
      <>
        <button type="button">First</button>
        <button type="button">Middle</button>
        <button type="button" disabled>
          Off
        </button>
      </>,
    );
    screen.getByRole('button', { name: 'Middle' }).focus();
    await actor.tab();
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
  });

  it('Tab stays put when there is nothing to focus', () => {
    setup(<p>Only text</p>);
    expect(fireEvent.keyDown(screen.getByRole('dialog').firstElementChild as Element, { key: 'Tab' })).toBe(false);
  });

  it('cannot grow past the screen, and scrolls instead', () => {
    const { dialog } = setup();
    expect(dialog.firstElementChild).toHaveClass('max-h-full', 'overflow-y-auto', 'max-w-sm');
  });
});
