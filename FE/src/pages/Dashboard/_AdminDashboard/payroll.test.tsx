import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../api/api', () => ({
  listPayrollMonth: vi.fn(),
  recordPayrollCheque: vi.fn(),
  updatePayrollCheque: vi.fn(),
  listPayrollCheques: vi.fn(),
}));

import { listPayrollCheques, listPayrollMonth, recordPayrollCheque, updatePayrollCheque } from '../../../api/api';
import AdminPayroll from './payroll';

const unpaid = {
  expertId: 'e1',
  expertName: 'Ada Expert',
  expertEmail: 'ada@x.com',
  liveNetCents: 4000,
  status: 'unpaid',
  differenceCents: 0,
  cheque: null,
};
const paid = {
  expertId: 'e2',
  expertName: 'Ben Paid',
  expertEmail: 'ben@x.com',
  liveNetCents: 2000,
  status: 'paid',
  differenceCents: 0,
  cheque: { _id: 'c2', amountCents: 2000, numberType: 'cheque', chequeNumber: '500', chequeDate: '2026-10-23T00:00:00.000Z' },
};
const paidByReference = {
  ...paid,
  expertId: 'e3',
  expertName: 'Cy Reference',
  expertEmail: 'cy@x.com',
  differenceCents: -500,
  cheque: { _id: 'c3', amountCents: 2500, numberType: 'reference', chequeNumber: 'TXN-9', chequeDate: '2026-10-24T00:00:00.000Z' },
};
const paidBeforeTypes = {
  ...paid,
  expertId: 'e4',
  expertName: 'Dee Old',
  expertEmail: 'dee@x.com',
  cheque: { _id: 'c4', amountCents: 2000, chequeNumber: 'OLD-4', chequeDate: '2026-10-25T00:00:00.000Z' },
};

const mockedList = vi.mocked(listPayrollMonth);
const mockedRecord = vi.mocked(recordPayrollCheque);
const mockedUpdate = vi.mocked(updatePayrollCheque);
const mockedCheques = vi.mocked(listPayrollCheques);

const respondWith = (rows: unknown[]) => mockedList.mockResolvedValue({ year: 2026, month: 10, rows });
const showButton = (name: string) => screen.findByRole('button', { name: `Show payment details for ${name}` });
const open = async (name: string) => userEvent.click(await showButton(name));

describe('AdminPayroll', () => {
  beforeEach(() => {
    mockedList.mockReset();
    mockedRecord.mockReset();
    mockedUpdate.mockReset();
    mockedCheques.mockReset();
    mockedCheques.mockResolvedValue({ cheques: [] });
    respondWith([unpaid, paid]);
    mockedRecord.mockResolvedValue({ emailSent: true, emailStatus: 'sent' });
    mockedUpdate.mockResolvedValue({ status: 'paid' });
  });

  it('keeps the entry form closed, with no record buttons in the rows, until a row is opened', async () => {
    render(<AdminPayroll />);
    await showButton('Ada Expert');
    expect(screen.queryByRole('button', { name: /Record cheque|Update cheque/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Submit' })).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('opens and closes from the arrow and from anywhere on the row, without doing both at once', async () => {
    render(<AdminPayroll />);
    const arrow = await showButton('Ada Expert');
    expect(arrow).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(arrow);
    const opened = screen.getByRole('button', { name: 'Hide payment details for Ada Expert' });
    expect(opened).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById(opened.getAttribute('aria-controls') as string)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeTruthy();

    await userEvent.click(screen.getByText('ada@x.com'));
    expect(screen.queryByRole('button', { name: 'Submit' })).toBeNull();

    await userEvent.click(screen.getByText('ada@x.com'));
    expect(screen.getByRole('button', { name: 'Submit' })).toBeTruthy();
  });

  it('can be opened from the keyboard', async () => {
    render(<AdminPayroll />);
    (await showButton('Ada Expert')).focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Submit' })).toBeTruthy();
  });

  it('does not toggle the row when text in it is being selected', async () => {
    render(<AdminPayroll />);
    await showButton('Ada Expert');
    const selection = vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => 'ada@x.com' } as Selection);
    fireEvent.click(screen.getByText('ada@x.com'));
    selection.mockRestore();
    expect(screen.queryByRole('button', { name: 'Submit' })).toBeNull();
  });

  it('records a cheque number by default', async () => {
    render(<AdminPayroll />);
    await open('Ada Expert');
    expect(screen.getByRole('combobox', { name: 'Number type for Ada Expert' })).toHaveValue('cheque');
    await userEvent.type(screen.getByRole('textbox', { name: 'Cheque number for Ada Expert' }), '1001');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(mockedRecord).toHaveBeenCalledTimes(1));
    expect(mockedRecord.mock.calls[0][0]).toMatchObject({
      expertId: 'e1',
      numberType: 'cheque',
      chequeNumber: '1001',
    });
    expect(await screen.findByText('Cheque recorded.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Submit' })).toBeNull();
    expect(mockedList).toHaveBeenCalledTimes(2);
  });

  it('records a reference number when it is chosen, and keeps what was typed when switching', async () => {
    render(<AdminPayroll />);
    await open('Ada Expert');
    await userEvent.type(screen.getByRole('textbox', { name: 'Cheque number for Ada Expert' }), 'TXN-1');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Number type for Ada Expert' }), 'reference');
    const box = screen.getByRole('textbox', { name: 'Reference number for Ada Expert' });
    expect(box).toHaveValue('TXN-1');
    expect(box).toHaveAttribute('placeholder', 'Enter reference number');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(mockedRecord).toHaveBeenCalledTimes(1));
    expect(mockedRecord.mock.calls[0][0]).toMatchObject({ numberType: 'reference', chequeNumber: 'TXN-1' });
    expect(await screen.findByText('Payment recorded.')).toBeTruthy();
  });

  it('asks for the number before sending anything', async () => {
    render(<AdminPayroll />);
    await open('Ada Expert');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Number type for Ada Expert' }), 'reference');
    await userEvent.type(screen.getByRole('textbox', { name: 'Reference number for Ada Expert' }), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Enter the reference number for Ada Expert.')).toBeTruthy();
    expect(mockedRecord).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeTruthy();
  });

  it('asks for the date before sending anything', async () => {
    render(<AdminPayroll />);
    await open('Ada Expert');
    await userEvent.type(screen.getByRole('textbox', { name: 'Cheque number for Ada Expert' }), '1001');
    fireEvent.change(screen.getByLabelText('Payment date for Ada Expert'), { target: { value: '' } });
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Choose the full payment date for Ada Expert.')).toBeTruthy();
    expect(mockedRecord).not.toHaveBeenCalled();
  });

  it('refuses a half-typed year', async () => {
    render(<AdminPayroll />);
    await open('Ada Expert');
    await userEvent.type(screen.getByRole('textbox', { name: 'Cheque number for Ada Expert' }), '1001');
    fireEvent.change(screen.getByLabelText('Payment date for Ada Expert'), { target: { value: '0202-11-05' } });
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Choose the full payment date for Ada Expert.')).toBeTruthy();
    expect(mockedRecord).not.toHaveBeenCalled();
  });

  it('never saves from the Enter key, because saving emails the expert', async () => {
    render(<AdminPayroll />);
    await open('Ada Expert');
    await userEvent.type(screen.getByRole('textbox', { name: 'Cheque number for Ada Expert' }), '1001{Enter}');
    await userEvent.type(screen.getByLabelText('Payment date for Ada Expert'), '{Enter}');
    expect(mockedRecord).not.toHaveBeenCalled();
  });

  it('keeps each row locked while it saves, even when another row is saving too', async () => {
    respondWith([unpaid, { ...unpaid, expertId: 'e5', expertName: 'Eve Unpaid', expertEmail: 'eve@x.com' }]);
    const finishers: Array<(value: unknown) => void> = [];
    mockedRecord.mockImplementation(() => new Promise(resolve => { finishers.push(resolve); }) as any);
    render(<AdminPayroll />);
    await open('Ada Expert');
    await open('Eve Unpaid');
    await userEvent.type(screen.getByRole('textbox', { name: 'Cheque number for Ada Expert' }), 'A1');
    await userEvent.type(screen.getByRole('textbox', { name: 'Cheque number for Eve Unpaid' }), 'E1');
    const [first, second] = screen.getAllByRole('button', { name: 'Submit' });
    await userEvent.click(first);
    await userEvent.click(second);
    expect(mockedRecord).toHaveBeenCalledTimes(2);
    const saving = screen.getAllByRole('button', { name: 'Saving…' });
    expect(saving).toHaveLength(2);
    saving.forEach(button => expect(button).toBeDisabled());

    finishers[1]({ emailSent: true });
    await screen.findByText('Cheque recorded.');
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(mockedRecord).toHaveBeenCalledTimes(2);
    finishers[0]({ emailSent: true });
  });

  it('does not interrupt a number being typed in another row when a save finishes', async () => {
    render(<AdminPayroll />);
    await open('Ada Expert');
    await open('Ben Paid');
    await userEvent.type(screen.getByRole('textbox', { name: 'Cheque number for Ada Expert' }), '1001');
    const other = screen.getByRole('textbox', { name: 'Cheque number for Ben Paid' });
    let finishList: (value: unknown) => void = () => undefined;
    mockedList.mockImplementation(() => new Promise(resolve => { finishList = resolve; }) as any);
    fireEvent.click(screen.getAllByRole('button', { name: 'Submit' })[0]);
    await waitFor(() => expect(mockedList).toHaveBeenCalled());
    await screen.findByText('Cheque recorded.');
    expect(screen.queryByText('Loading payroll…')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Cheque number for Ben Paid' })).toBe(other);
    finishList({ year: 2026, month: 10, rows: [unpaid, paid] });
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Cheque number for Ben Paid' })).toBe(other));
  });

  it('keeps the table when the refresh after a save fails', async () => {
    render(<AdminPayroll />);
    await open('Ada Expert');
    await userEvent.type(screen.getByRole('textbox', { name: 'Cheque number for Ada Expert' }), '1001');
    mockedList.mockResolvedValue(false);
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Saved, but the list could not be refreshed. Reload the page to see it.')).toBeTruthy();
    expect(screen.getByText('Ada Expert')).toBeTruthy();
  });

  it('ignores a slow answer for a month the admin has already left', async () => {
    render(<AdminPayroll />);
    await showButton('Ada Expert');
    const august = { ...unpaid, expertId: 'e8', expertName: 'August Amy' };
    const september = { ...unpaid, expertId: 'e9', expertName: 'September Sam' };
    let finishAugust: (value: unknown) => void = () => undefined;
    mockedList.mockImplementation(((_year: number, month: number) => (
      month === 8
        ? new Promise(resolve => { finishAugust = resolve; })
        : Promise.resolve({ year: 2026, month, rows: [september] })
    )) as any);
    fireEvent.change(screen.getByLabelText(/Payroll month/), { target: { value: '2026-08' } });
    fireEvent.change(screen.getByLabelText(/Payroll month/), { target: { value: '2026-09' } });
    await screen.findByText('September Sam');
    await act(async () => {
      finishAugust({ year: 2026, month: 8, rows: [august] });
      await new Promise(resolve => setTimeout(resolve, 20));
    });
    expect(screen.queryByText('August Amy')).toBeNull();
    expect(screen.getByText('September Sam')).toBeTruthy();
  });

  it('does not bring back the old rows when a save finishes while the next month is still loading', async () => {
    render(<AdminPayroll />);
    await open('Ada Expert');
    await userEvent.type(screen.getByRole('textbox', { name: 'Cheque number for Ada Expert' }), '1001');
    let finishSave: (value: unknown) => void = () => undefined;
    mockedRecord.mockImplementation(() => new Promise(resolve => { finishSave = resolve; }) as any);
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    let finishMonth: (value: unknown) => void = () => undefined;
    mockedList.mockImplementation((() => new Promise(resolve => { finishMonth = resolve; })) as any);
    fireEvent.change(screen.getByLabelText(/Payroll month/), { target: { value: '2026-09' } });
    expect(await screen.findByText('Loading payroll…')).toBeTruthy();
    await act(async () => {
      finishSave({ emailSent: true });
      await new Promise(resolve => setTimeout(resolve, 20));
    });
    expect(screen.getByText('Loading payroll…')).toBeTruthy();
    expect(screen.queryByText('Ada Expert')).toBeNull();
    await act(async () => {
      finishMonth({ year: 2026, month: 9, rows: [{ ...unpaid, expertId: 'e9', expertName: 'September Sam' }] });
      await new Promise(resolve => setTimeout(resolve, 20));
    });
    expect(screen.getByText('September Sam')).toBeTruthy();
    expect(screen.queryByText('Loading payroll…')).toBeNull();
  });

  it('shows the month on screen after a save that finishes once the admin has moved on', async () => {
    render(<AdminPayroll />);
    await open('Ada Expert');
    await userEvent.type(screen.getByRole('textbox', { name: 'Cheque number for Ada Expert' }), '1001');
    let finishSave: (value: unknown) => void = () => undefined;
    mockedRecord.mockImplementation(() => new Promise(resolve => { finishSave = resolve; }) as any);
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    const september = { ...unpaid, expertId: 'e9', expertName: 'September Sam' };
    mockedList.mockImplementation(((_year: number, month: number) => Promise.resolve({
      year: 2026,
      month,
      rows: month === 9 ? [september] : [unpaid],
    })) as any);
    fireEvent.change(screen.getByLabelText(/Payroll month/), { target: { value: '2026-09' } });
    await screen.findByText('September Sam');
    await act(async () => {
      finishSave({ emailSent: true });
      await new Promise(resolve => setTimeout(resolve, 20));
    });
    expect(mockedRecord.mock.calls[0][0]).toMatchObject({ expertId: 'e1' });
    expect(screen.getByText('September Sam')).toBeTruthy();
    expect(screen.queryByText('Ada Expert')).toBeNull();
  });

  it('keeps the row open with the typed number when saving fails', async () => {
    mockedRecord.mockResolvedValue(false);
    render(<AdminPayroll />);
    await open('Ada Expert');
    await userEvent.type(screen.getByRole('textbox', { name: 'Cheque number for Ada Expert' }), '1001');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Could not save the cheque.')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Cheque number for Ada Expert' })).toHaveValue('1001');
  });

  it('cannot be submitted twice while saving', async () => {
    let finish: (value: unknown) => void = () => undefined;
    mockedRecord.mockImplementation(() => new Promise(resolve => { finish = resolve; }) as any);
    render(<AdminPayroll />);
    await open('Ada Expert');
    await userEvent.type(screen.getByRole('textbox', { name: 'Cheque number for Ada Expert' }), '1001');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    const saving = screen.getByRole('button', { name: 'Saving…' });
    expect(saving).toBeDisabled();
    await userEvent.click(saving);
    expect(mockedRecord).toHaveBeenCalledTimes(1);
    finish({ emailSent: true });
    await screen.findByText('Cheque recorded.');
  });

  it('shows the saved details in the row and updates them from the same form', async () => {
    render(<AdminPayroll />);
    const row = (await screen.findByText('Ben Paid')).closest('tr') as HTMLElement;
    expect(within(row).getByText('500')).toBeTruthy();
    expect(within(row).getByText('Oct 23, 2026')).toBeTruthy();
    expect(within(row).getByText('Cheque $20.00')).toBeTruthy();

    await open('Ben Paid');
    const box = screen.getByRole('textbox', { name: 'Cheque number for Ben Paid' });
    expect(box).toHaveValue('500');
    expect(screen.getByLabelText('Payment date for Ben Paid')).toHaveValue('2026-10-23');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Number type for Ben Paid' }), 'reference');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledTimes(1));
    expect(mockedUpdate).toHaveBeenCalledWith('c2', { numberType: 'reference', chequeNumber: '500', chequeDate: '2026-10-23' });
    expect(mockedRecord).not.toHaveBeenCalled();
    expect(await screen.findByText('Payment details updated. The amount is unchanged.')).toBeTruthy();
  });

  it('marks a reference number as one, and treats a record with no type as a cheque', async () => {
    respondWith([paidByReference, paidBeforeTypes]);
    render(<AdminPayroll />);
    expect(await screen.findByText('Reference TXN-9')).toBeTruthy();
    expect(screen.getByText('Paid $25.00')).toBeTruthy();
    expect(screen.getByText(/than the payment of \$25\.00/)).toBeTruthy();
    expect(screen.getByText('OLD-4')).toBeTruthy();

    await open('Cy Reference');
    expect(screen.getByRole('combobox', { name: 'Number type for Cy Reference' })).toHaveValue('reference');
    await open('Dee Old');
    expect(screen.getByRole('combobox', { name: 'Number type for Dee Old' })).toHaveValue('cheque');
  });

  it('lets several rows stay open and keeps each one\'s typed number', async () => {
    render(<AdminPayroll />);
    await open('Ada Expert');
    await open('Ben Paid');
    await userEvent.type(screen.getByRole('textbox', { name: 'Cheque number for Ada Expert' }), '77');
    expect(screen.getAllByRole('button', { name: 'Submit' })).toHaveLength(2);
    expect(screen.getByRole('textbox', { name: 'Cheque number for Ben Paid' })).toHaveValue('500');

    await userEvent.click(screen.getByRole('button', { name: 'Hide payment details for Ada Expert' }));
    await open('Ada Expert');
    expect(screen.getByRole('textbox', { name: 'Cheque number for Ada Expert' })).toHaveValue('77');
  });

  it('closes open rows and forgets typed numbers when the month changes', async () => {
    render(<AdminPayroll />);
    await open('Ada Expert');
    await userEvent.type(screen.getByRole('textbox', { name: 'Cheque number for Ada Expert' }), '77');
    fireEvent.change(screen.getByLabelText(/Payroll month/), { target: { value: '2026-09' } });
    await waitFor(() => expect(mockedList).toHaveBeenCalledWith(2026, 9));
    expect(screen.queryByRole('button', { name: 'Submit' })).toBeNull();
    await open('Ada Expert');
    expect(screen.getByRole('textbox', { name: 'Cheque number for Ada Expert' })).toHaveValue('');
  });

  it('offers no Submit for a row with nothing to pay', async () => {
    respondWith([{ ...unpaid, liveNetCents: 0 }]);
    render(<AdminPayroll />);
    await open('Ada Expert');
    expect(screen.queryByRole('button', { name: 'Submit' })).toBeNull();
  });
});

const payouts = [
  { _id: 'p1', expertId: 'x1', expertName: 'Ada Lovelace', expertEmail: 'ada@lab.com', year: 2026, month: 10, amountCents: 4000, numberType: 'cheque', chequeNumber: '88421', chequeDate: '2026-11-02T00:00:00.000Z' },
  { _id: 'p2', expertId: 'x2', expertName: 'Grace Hopper', expertEmail: 'grace@navy.mil', year: 2026, month: 9, amountCents: 1500, numberType: 'reference', chequeNumber: 'TXN-77', chequeDate: '2026-10-15T00:00:00.000Z' },
  { _id: 'p3', expertId: 'x3', expertName: 'Old Record', expertEmail: 'old@x.com', year: 2026, month: 7, amountCents: 900, chequeNumber: '1200', chequeDate: '2026-08-01T00:00:00.000Z' },
];

const paidOut = () => within(screen.getByRole('region', { name: 'Paid out' }));
const paidOutRows = () => paidOut().queryAllByRole('row').slice(1).map(row => within(row).getAllByRole('cell')[0].textContent);

describe('AdminPayroll paid-out section', () => {
  beforeEach(() => {
    mockedList.mockReset();
    mockedRecord.mockReset();
    mockedCheques.mockReset();
    respondWith([unpaid, paid]);
    mockedRecord.mockResolvedValue({ emailSent: true, emailStatus: 'sent' });
    mockedCheques.mockResolvedValue({ cheques: payouts });
  });

  it('shows every payout below the monthly table, with the moved columns', async () => {
    render(<AdminPayroll />);
    await showButton('Ada Expert');
    expect(await paidOut().findByText('88421')).toBeTruthy();
    const monthTable = screen.getAllByRole('table')[0];
    expect(monthTable.compareDocumentPosition(screen.getByTestId('paid-out-cheques'))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(paidOut().getByText('October 2026')).toBeTruthy();
    expect(paidOut().getByText('$40.00')).toBeTruthy();
    expect(paidOut().getByText('Nov 2, 2026')).toBeTruthy();
    expect(paidOut().getByText('Reference TXN-77')).toBeTruthy();
    expect(paidOut().getByText('1200')).toBeTruthy();
    expect(paidOut().getByText('Showing 3 of 3 payouts')).toBeTruthy();
  });

  it('filters by expert name or email, ignoring case', async () => {
    render(<AdminPayroll />);
    await paidOut().findByText('88421');
    fireEvent.change(screen.getByLabelText('Expert'), { target: { value: 'GRACE' } });
    expect(paidOutRows()).toEqual(['Grace Hopper']);
    fireEvent.change(screen.getByLabelText('Expert'), { target: { value: 'lab.com' } });
    expect(paidOutRows()).toEqual(['Ada Lovelace']);
    expect(paidOut().getByText(/Showing 1 of 3 payouts · 1 filter active/)).toBeTruthy();
  });

  it('filters by cheque or reference number', async () => {
    render(<AdminPayroll />);
    await paidOut().findByText('88421');
    fireEvent.change(screen.getByLabelText('Cheque / reference number'), { target: { value: 'txn' } });
    expect(paidOutRows()).toEqual(['Grace Hopper']);
    fireEvent.change(screen.getByLabelText('Cheque / reference number'), { target: { value: '12' } });
    expect(paidOutRows()).toEqual(['Old Record']);
  });

  it('filters by payment date, counting both From and To days', async () => {
    render(<AdminPayroll />);
    await paidOut().findByText('88421');
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-15' } });
    expect(paidOutRows()).toEqual(['Ada Lovelace', 'Grace Hopper']);
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-15' } });
    expect(paidOutRows()).toEqual(['Grace Hopper']);
  });

  it('says when nothing matches and clears every filter at once', async () => {
    render(<AdminPayroll />);
    await paidOut().findByText('88421');
    fireEvent.change(screen.getByLabelText('Expert'), { target: { value: 'ada' } });
    fireEvent.change(screen.getByLabelText('Cheque / reference number'), { target: { value: 'TXN' } });
    expect(paidOut().getByText(/No payouts match these filters/)).toBeTruthy();
    await userEvent.click(paidOut().getAllByRole('button', { name: 'Clear filters' })[0]);
    expect(paidOutRows()).toHaveLength(3);
    expect(screen.getByLabelText('Expert')).toHaveValue('');
    expect(screen.getByLabelText('Cheque / reference number')).toHaveValue('');
  });

  it('leaves the monthly table alone when filtering', async () => {
    render(<AdminPayroll />);
    await paidOut().findByText('88421');
    fireEvent.change(screen.getByLabelText('Expert'), { target: { value: 'nobody' } });
    expect(screen.getByText('Ada Expert')).toBeTruthy();
    expect(screen.getByText('Ben Paid')).toBeTruthy();
    expect(mockedList).toHaveBeenCalledTimes(1);
  });

  it('reloads the paid-out list after a payout is saved, and not after a failed save', async () => {
    render(<AdminPayroll />);
    await open('Ada Expert');
    await waitFor(() => expect(mockedCheques).toHaveBeenCalledTimes(1));

    mockedRecord.mockResolvedValueOnce(false);
    await userEvent.type(screen.getByRole('textbox', { name: 'Cheque number for Ada Expert' }), '1001');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await screen.findByText('Could not save the cheque.');
    expect(mockedCheques).toHaveBeenCalledTimes(1);

    mockedCheques.mockResolvedValue({
      cheques: [...payouts, { _id: 'p4', expertId: 'e1', expertName: 'Ada Expert', expertEmail: 'ada@x.com', year: 2026, month: 10, amountCents: 4000, chequeNumber: '1001', chequeDate: '2026-11-05T00:00:00.000Z' }],
    });
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await paidOut().findByText('1001')).toBeTruthy();
    expect(mockedCheques).toHaveBeenCalledTimes(2);
  });

  it('keeps the list on screen and says so when a reload fails', async () => {
    render(<AdminPayroll />);
    await open('Ada Expert');
    await paidOut().findByText('88421');
    mockedCheques.mockResolvedValue(false);
    await userEvent.type(screen.getByRole('textbox', { name: 'Cheque number for Ada Expert' }), '1001');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await paidOut().findByText(/Could not load the paid-out list/)).toBeTruthy();
    expect(paidOut().getByText('88421')).toBeTruthy();
  });

  it('says when there are no payouts yet, and when the list cannot be loaded', async () => {
    mockedCheques.mockResolvedValue({ cheques: [] });
    const { unmount } = render(<AdminPayroll />);
    expect(await paidOut().findByText('No payouts recorded yet.')).toBeTruthy();
    unmount();

    mockedCheques.mockResolvedValue(false);
    render(<AdminPayroll />);
    expect(await paidOut().findByText(/Could not load the paid-out list/)).toBeTruthy();
    expect(paidOut().queryByText('No payouts recorded yet.')).toBeNull();
    expect(await screen.findByText('Ada Expert')).toBeTruthy();
  });
});
