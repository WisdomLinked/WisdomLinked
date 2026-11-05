import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { listPayrollMonth, recordPayrollCheque, updatePayrollCheque } from '../../../api/api';
import { DASHBOARD_PAGE_TITLE } from '../../../components/dashboard/pageTitle';
import { formatDollarsFromCents } from '../../../utils/bookingPrice';
import {
  PAYOUT_NUMBER_LABELS,
  payoutNumberText,
  payoutNumberType,
  type PayoutNumberType,
} from '../../../utils/payoutNumber';

type Cheque = {
  _id: string;
  amountCents: number;
  numberType?: PayoutNumberType;
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

type PayoutDraft = {
  numberType: PayoutNumberType;
  chequeNumber: string;
  chequeDate: string;
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

function chequeDateText(value?: string): string {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' });
}

/** While a year is being typed the box holds 0002, 0020, 0202 before 2026. */
function isFinishedDate(value: string): boolean {
  return /^(19|2\d)\d{2}-\d{2}-\d{2}$/.test(value);
}

function draftFor(row: PayrollRow): PayoutDraft {
  return {
    numberType: payoutNumberType(row.cheque?.numberType),
    chequeNumber: row.cheque?.chequeNumber || '',
    chequeDate: chequeDateValue(row.cheque?.chequeDate) || utcToday(),
  };
}

function payoutWord(numberType?: PayoutNumberType): string {
  return numberType === 'reference' ? 'payment' : 'cheque';
}

function recordNotice(result: { emailSent?: boolean; emailStatus?: string }, numberType: PayoutNumberType): string {
  const word = payoutWord(numberType);
  if (result.emailStatus === 'no_email') {
    return `The ${word} was recorded. This expert has no email address, so no payout email was sent.`;
  }
  if (result.emailSent === false) {
    return `The ${word} was recorded and the email could not be sent.`;
  }
  return numberType === 'reference' ? 'Payment recorded.' : 'Cheque recorded.';
}

function differenceCopy(row: PayrollRow): string {
  if (!row.cheque || row.differenceCents === 0) return '';
  const gap = Math.abs(row.differenceCents);
  const direction = row.differenceCents < 0 ? 'less' : 'more';
  return `Live net is ${formatDollarsFromCents(gap)} ${direction} than the ${payoutWord(row.cheque.numberType)} of ${formatDollarsFromCents(row.cheque.amountCents)}.`;
}

export default function AdminPayroll() {
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, PayoutDraft>>({});
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingIds, setSavingIds] = useState<string[]>([]);
  const loadSeq = useRef(0);
  const monthLoadInFlight = useRef(false);
  const selectedMonth = useRef({ year, month });
  selectedMonth.current = { year, month };

  const load = async (nextYear = year, nextMonth = month) => {
    const seq = ++loadSeq.current;
    monthLoadInFlight.current = true;
    setLoading(true);
    setError('');
    const data = await listPayrollMonth(nextYear, nextMonth) as PayrollResponse | false;
    // A slower answer for a month the admin has left must not fill the table under the new month.
    if (seq !== loadSeq.current) return;
    monthLoadInFlight.current = false;
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
        next[row.expertId] = draftFor(row);
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

  /** After a save: the table stays on screen, so a number being typed in another row is not interrupted. */
  const refresh = async () => {
    // The month being loaded right now is about to replace the table anyway.
    if (monthLoadInFlight.current) return;
    const seq = ++loadSeq.current;
    const { year: shownYear, month: shownMonth } = selectedMonth.current;
    const data = await listPayrollMonth(shownYear, shownMonth) as PayrollResponse | false;
    if (seq !== loadSeq.current) return;
    if (!data || !Array.isArray(data.rows)) {
      setError('Saved, but the list could not be refreshed. Reload the page to see it.');
      return;
    }
    setRows(data.rows);
  };

  const toggleRow = (expertId: string) => {
    setExpandedIds((current) => (
      current.includes(expertId) ? current.filter((id) => id !== expertId) : [...current, expertId]
    ));
  };

  const save = async (row: PayrollRow) => {
    const draft = drafts[row.expertId] || draftFor(row);
    const { numberType } = draft;
    if (savingIds.includes(row.expertId)) return;
    setError('');
    setNotice('');
    if (!draft.chequeNumber.trim()) {
      setError(`Enter the ${PAYOUT_NUMBER_LABELS[numberType].toLowerCase()} for ${row.expertName}.`);
      return;
    }
    if (!isFinishedDate(draft.chequeDate)) {
      setError(`Choose the full payment date for ${row.expertName}.`);
      return;
    }
    setSavingIds((current) => [...current, row.expertId]);
    const result = row.cheque
      ? await updatePayrollCheque(row.cheque._id, {
          numberType,
          chequeNumber: draft.chequeNumber,
          chequeDate: draft.chequeDate,
        })
      : await recordPayrollCheque({
          expertId: row.expertId,
          year,
          month,
          numberType,
          chequeNumber: draft.chequeNumber,
          chequeDate: draft.chequeDate,
        });
    setSavingIds((current) => current.filter((id) => id !== row.expertId));
    if (!result) {
      setError(`Could not save the ${payoutWord(numberType)}.`);
      return;
    }
    setNotice(
      row.cheque
        ? `${numberType === 'reference' ? 'Payment' : 'Cheque'} details updated. The amount is unchanged.`
        : recordNotice(result, numberType),
    );
    setDrafts((current) => {
      const next = { ...current };
      delete next[row.expertId];
      return next;
    });
    setExpandedIds((current) => current.filter((id) => id !== row.expertId));
    await refresh();
  };

  return (
    <div className="px-4 py-7 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <h1 className={DASHBOARD_PAGE_TITLE}>Payroll</h1>
          <p className="mt-1 text-sm text-wl-muted">
            Experts are paid by cheque or by a payment with a reference number. The amount is the expert net of completed sessions in the selected UTC month. Stripe does not pay this out.
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
              setExpandedIds([]);
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
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="border-b border-wl-line text-xs uppercase tracking-wider text-wl-muted">
                <th className="px-4 py-3 font-medium">Expert</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Cheque / reference number</th>
                <th className="px-4 py-3 font-medium">Payment date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-wl-muted" colSpan={5}>Loading payroll…</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-wl-muted" colSpan={5}>No experts to pay for this UTC month.</td>
                </tr>
              ) : rows.map((row) => {
                const draft = drafts[row.expertId] || draftFor(row);
                const note = differenceCopy(row);
                const expanded = expandedIds.includes(row.expertId);
                const panelId = `payroll-payout-${row.expertId}`;
                const setDraft = (change: Partial<PayoutDraft>) => setDrafts((current) => ({
                  ...current,
                  [row.expertId]: { ...draft, ...change },
                }));
                return (
                  <React.Fragment key={row.expertId}>
                    <tr
                      className={`cursor-pointer align-top hover:bg-wl-page ${expanded ? '' : 'border-b border-wl-line'}`}
                      onClick={() => {
                        // Selecting an email or an amount to copy is not a click on the row.
                        if (window.getSelection()?.toString()) return;
                        toggleRow(row.expertId);
                      }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            aria-expanded={expanded}
                            aria-controls={panelId}
                            aria-label={`${expanded ? 'Hide' : 'Show'} payment details for ${row.expertName}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleRow(row.expertId);
                            }}
                            className="mt-0.5 shrink-0 rounded text-wl-muted hover:text-wl-ink"
                          >
                            <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`} aria-hidden />
                          </button>
                          <div className="min-w-0">
                            <p className="font-medium text-wl-ink">{row.expertName}</p>
                            <p className="text-xs text-wl-muted">{row.expertEmail}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-wl-ink">
                        <p>{formatDollarsFromCents(row.liveNetCents)}</p>
                        {row.cheque ? (
                          <p className="text-xs text-wl-muted">
                            {row.cheque.numberType === 'reference' ? 'Paid' : 'Cheque'} {formatDollarsFromCents(row.cheque.amountCents)}
                          </p>
                        ) : null}
                        {note ? <p className="mt-1 max-w-[220px] text-xs text-amber-800">{note}</p> : null}
                      </td>
                      <td className="px-4 py-3 text-wl-ink">{row.status === 'paid' ? 'Paid' : 'Unpaid'}</td>
                      <td className="max-w-[220px] break-all px-4 py-3 text-wl-ink">{row.cheque ? payoutNumberText(row.cheque) : '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-wl-ink">
                        {row.cheque ? chequeDateText(row.cheque.chequeDate) : '—'}
                      </td>
                    </tr>
                    {expanded ? (
                      <tr id={panelId} className="border-b border-wl-line">
                        <td className="px-4 pb-4 pt-1" colSpan={5}>
                          {/* The table scrolls sideways on phones; this stays in view and wraps instead. */}
                          <div className="sticky left-4 flex max-w-[calc(100vw-4rem)] flex-wrap items-center gap-3 sm:pl-6">
                            <select
                              aria-label={`Number type for ${row.expertName}`}
                              value={draft.numberType}
                              onChange={(event) => setDraft({ numberType: event.target.value as PayoutNumberType })}
                              className="h-9 rounded-[10px] border border-wl-line bg-white px-2 text-sm text-wl-ink"
                            >
                              <option value="cheque">{PAYOUT_NUMBER_LABELS.cheque}</option>
                              <option value="reference">{PAYOUT_NUMBER_LABELS.reference}</option>
                            </select>
                            <input
                              aria-label={`${PAYOUT_NUMBER_LABELS[draft.numberType]} for ${row.expertName}`}
                              placeholder={`Enter ${PAYOUT_NUMBER_LABELS[draft.numberType].toLowerCase()}`}
                              maxLength={80}
                              value={draft.chequeNumber}
                              onChange={(event) => setDraft({ chequeNumber: event.target.value })}
                              className="h-9 min-w-0 flex-1 rounded-[10px] border border-wl-line bg-white px-3 text-sm text-wl-ink sm:w-48 sm:flex-none"
                            />
                            <label className="flex items-center gap-2 text-sm text-wl-muted">
                              Payment date
                              <input
                                aria-label={`Payment date for ${row.expertName}`}
                                type="date"
                                value={draft.chequeDate}
                                onChange={(event) => setDraft({ chequeDate: event.target.value })}
                                className="h-9 rounded-[10px] border border-wl-line bg-white px-3 text-sm text-wl-ink"
                              />
                            </label>
                            {row.status === 'unpaid' && !(row.liveNetCents > 0) ? null : (
                              <button
                                // Saving emails the expert, so it only happens from this button, never from Enter.
                                type="button"
                                disabled={savingIds.includes(row.expertId)}
                                onClick={() => { void save(row); }}
                                className="ml-auto h-9 rounded-full bg-wl-brand px-5 text-sm font-medium text-white disabled:opacity-50"
                              >
                                {savingIds.includes(row.expertId) ? 'Saving…' : 'Submit'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
