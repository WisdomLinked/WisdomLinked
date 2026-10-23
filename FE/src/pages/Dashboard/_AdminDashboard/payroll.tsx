import React, { useEffect, useMemo, useState } from 'react';
import { listPayrollMonth, recordPayrollCheque, updatePayrollCheque } from '../../../api/api';
import { DASHBOARD_PAGE_TITLE } from '../../../components/dashboard/pageTitle';
import { formatDollarsFromCents } from '../../../utils/bookingPrice';

type Cheque = {
  _id: string;
  amountCents: number;
  chequeNumber: string;
  chequeDate: string;
};

type PayrollRow = {
  expertId: string;
  expertName: string;
  expertEmail: string;
  liveNetCents: number;
  status: 'paid' | 'unpaid';
  differenceCents: number;
  cheque: Cheque | null;
};

type PayrollResponse = {
  year: number;
  month: number;
  timeZone?: string;
  rows?: PayrollRow[];
};

function utcToday(): string {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${now.getUTCFullYear()}-${month}-${day}`;
}

function monthValue(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function chequeDateValue(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

function differenceCopy(row: PayrollRow): string {
  if (!row.cheque || row.differenceCents === 0) return '';
  const gap = Math.abs(row.differenceCents);
  const direction = row.differenceCents < 0 ? 'less' : 'more';
  return `Live net is ${formatDollarsFromCents(gap)} ${direction} than the cheque of ${formatDollarsFromCents(row.cheque.amountCents)}.`;
}

export default function AdminPayroll() {
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { chequeNumber: string; chequeDate: string }>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');

  const load = async (nextYear = year, nextMonth = month) => {
    setLoading(true);
    setError('');
    const data = await listPayrollMonth(nextYear, nextMonth) as PayrollResponse | false;
    setLoading(false);
    if (!data || !Array.isArray(data.rows)) {
      setRows([]);
      setError('Could not load payroll.');
      return;
    }
    setRows(data.rows);
    setDrafts((current) => {
      const next = { ...current };
      for (const row of data.rows || []) {
        if (next[row.expertId]) continue;
        next[row.expertId] = {
          chequeNumber: row.cheque?.chequeNumber || '',
          chequeDate: chequeDateValue(row.cheque?.chequeDate) || utcToday(),
        };
      }
      return next;
    });
  };

  useEffect(() => {
    void load(year, month);
    // Reload when the selected UTC month changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const label = useMemo(() => monthValue(year, month), [year, month]);

  const save = async (row: PayrollRow) => {
    const draft = drafts[row.expertId] || { chequeNumber: '', chequeDate: '' };
    setSavingId(row.expertId);
    setError('');
    setNotice('');
    const result = row.cheque
      ? await updatePayrollCheque(row.cheque._id, {
          chequeNumber: draft.chequeNumber,
          chequeDate: draft.chequeDate,
        })
      : await recordPayrollCheque({
          expertId: row.expertId,
          year,
          month,
          chequeNumber: draft.chequeNumber,
          chequeDate: draft.chequeDate,
        });
    setSavingId('');
    if (!result) {
      setError('Could not save the cheque.');
      return;
    }
    setNotice(row.cheque ? 'Cheque details updated. The amount is unchanged.' : 'Cheque recorded.');
    setDrafts((current) => {
      const next = { ...current };
      delete next[row.expertId];
      return next;
    });
    await load(year, month);
  };

  return (
    <div className="px-4 py-7 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <h1 className={DASHBOARD_PAGE_TITLE}>Payroll</h1>
          <p className="mt-1 text-sm text-wl-muted">
            Experts are paid by cheque. The amount is the expert net of completed sessions in the selected UTC month. Stripe does not pay this out.
          </p>
        </header>

        <label className="block max-w-xs">
          <span className="text-sm font-medium text-wl-ink">Payroll month (UTC)</span>
          <p className="mt-0.5 text-[13px] text-wl-muted">
            The month is the UTC calendar month of the payment date shown on the audit.
          </p>
          <input
            type="month"
            value={label}
            onChange={(event) => {
              const [nextYear, nextMonth] = event.target.value.split('-').map(Number);
              if (!nextYear || !nextMonth) return;
              setDrafts({});
              setYear(nextYear);
              setMonth(nextMonth);
              setNotice('');
            }}
            className="mt-1 h-9 rounded-[10px] border border-wl-line bg-white px-3 text-sm text-wl-ink"
          />
        </label>

        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        {notice ? <p className="text-sm text-emerald-800">{notice}</p> : null}

        <div className="overflow-x-auto rounded-2xl border border-wl-line bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-wl-line text-xs uppercase tracking-wider text-wl-muted">
                <th className="px-4 py-3 font-medium">Expert</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Cheque number</th>
                <th className="px-4 py-3 font-medium">Cheque date</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-wl-muted" colSpan={6}>Loading payroll…</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-wl-muted" colSpan={6}>No experts to pay for this UTC month.</td>
                </tr>
              ) : rows.map((row) => {
                const draft = drafts[row.expertId] || { chequeNumber: '', chequeDate: utcToday() };
                const note = differenceCopy(row);
                return (
                  <tr key={row.expertId} className="border-b border-wl-line align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-wl-ink">{row.expertName}</p>
                      <p className="text-xs text-wl-muted">{row.expertEmail}</p>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-wl-ink">
                      <p>{formatDollarsFromCents(row.liveNetCents)}</p>
                      {row.cheque ? (
                        <p className="text-xs text-wl-muted">Cheque {formatDollarsFromCents(row.cheque.amountCents)}</p>
                      ) : null}
                      {note ? <p className="mt-1 max-w-[220px] text-xs text-amber-800">{note}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-wl-ink">{row.status === 'paid' ? 'Paid' : 'Unpaid'}</td>
                    <td className="px-4 py-3">
                      <input
                        aria-label={`Cheque number for ${row.expertName}`}
                        value={draft.chequeNumber}
                        onChange={(event) => setDrafts((current) => ({
                          ...current,
                          [row.expertId]: { ...draft, chequeNumber: event.target.value },
                        }))}
                        className="h-9 w-36 rounded-[10px] border border-wl-line bg-white px-3 text-sm text-wl-ink"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        aria-label={`Cheque date for ${row.expertName}`}
                        type="date"
                        value={draft.chequeDate}
                        onChange={(event) => setDrafts((current) => ({
                          ...current,
                          [row.expertId]: { ...draft, chequeDate: event.target.value },
                        }))}
                        className="h-9 rounded-[10px] border border-wl-line bg-white px-3 text-sm text-wl-ink"
                      />
                    </td>
                    <td className="px-4 py-3">
                      {row.status === 'unpaid' && !(row.liveNetCents > 0) ? null : (
                        <button
                          type="button"
                          disabled={savingId === row.expertId}
                          onClick={() => { void save(row); }}
                          className="h-9 rounded-full bg-wl-brand px-4 text-sm font-medium text-white disabled:opacity-50"
                        >
                          {savingId === row.expertId ? 'Saving…' : row.cheque ? 'Update cheque' : 'Record cheque'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
