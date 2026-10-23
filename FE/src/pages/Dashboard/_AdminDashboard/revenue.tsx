import React, { useEffect, useMemo, useState } from 'react';
import { getPricingSettings, savePricingSettings } from '../../../api/api';
import { DASHBOARD_PAGE_TITLE } from '../../../components/dashboard/pageTitle';
import {
  computeSessionCharge,
  defaultCancellationRefund,
  formatDollarsFromCents,
  validatePricingRates,
  type CancellationRefundRule,
  type PricingRates,
  type PricingSessionType,
} from '../../../utils/bookingPrice';

const SAMPLE_PAID_CENTS = 10000;
const SAMPLE_TAX_PERCENT = 8;

const FIELDS: { key: keyof PricingRates; label: string; suffix: string; hint: string }[] = [
  {
    key: 'expertCommissionPercent',
    label: 'Expert commission',
    suffix: '%',
    hint: 'Share of the advertised price the platform keeps. It is not added to the student charge.',
  },
  {
    key: 'studentFeePercent',
    label: 'Student fee',
    suffix: '%',
    hint: 'Percent of the advertised price, capped below.',
  },
  {
    key: 'studentFeeCapDollars',
    label: 'Student fee cap',
    suffix: '$',
    hint: 'Maximum platform fee on a paid session.',
  },
  {
    key: 'taxPercent',
    label: 'Tax',
    suffix: '%',
    hint: 'Applied to the advertised price and the platform fee. 0% adds nothing.',
  },
  {
    key: 'freeSessionPlatformFeeDollars',
    label: 'Free-session platform fee',
    suffix: '$',
    hint: 'Flat fee when the advertised price is $0. Set to 0 for a truly free session.',
  },
];

const REFUND_OPTIONS: { value: CancellationRefundRule; label: string }[] = [
  { value: 'full', label: 'Full refund' },
  { value: 'keep_platform_fee', label: 'Refund the price and tax, keep the platform fee' },
  { value: 'processing_fee', label: 'Refund the charge minus the card fee (2.9% + $0.30)' },
];

type Group = 'seminar' | 'oneToOne';

const emptyForm = (): Record<keyof PricingRates, string> => ({
  expertCommissionPercent: '',
  studentFeePercent: '',
  studentFeeCapDollars: '',
  taxPercent: '',
  freeSessionPlatformFeeDollars: '',
  cancellationRefund: '',
});

function formFromRates(rates: PricingRates): Record<keyof PricingRates, string> {
  return {
    expertCommissionPercent: String(rates.expertCommissionPercent),
    studentFeePercent: String(rates.studentFeePercent),
    studentFeeCapDollars: String(rates.studentFeeCapDollars),
    taxPercent: String(rates.taxPercent),
    freeSessionPlatformFeeDollars: String(rates.freeSessionPlatformFeeDollars),
    cancellationRefund: rates.cancellationRefund,
  };
}

function GroupEditor({
  title,
  sessionType,
  values,
  saving,
  onChange,
  onSave,
}: {
  title: string;
  sessionType: PricingSessionType;
  values: Record<keyof PricingRates, string>;
  saving: boolean;
  onChange: (key: keyof PricingRates, value: string) => void;
  onSave: () => void;
}) {
  const parsed = validatePricingRates(values, sessionType);
  const refundRule = (values.cancellationRefund || defaultCancellationRefund(sessionType)) as CancellationRefundRule;
  const preview = parsed.ok
    ? {
        paid: computeSessionCharge(SAMPLE_PAID_CENTS, parsed.rates, sessionType),
        free: computeSessionCharge(0, { ...parsed.rates, taxPercent: 0 }, sessionType),
        freeTaxed: computeSessionCharge(0, { ...parsed.rates, taxPercent: SAMPLE_TAX_PERCENT }, sessionType),
      }
    : null;

  return (
    <section className="rounded-2xl border border-wl-line bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-wl-ink">{title}</h2>
      <p className="mt-1 text-sm text-wl-muted">Saving changes the next checkout. The cancellation rule applies the next time someone cancels before the session starts.</p>
      <div className="mt-4 space-y-4">
        {FIELDS.map((field) => (
          <label key={field.key} className="block">
            <span className="text-sm font-medium text-wl-ink">
              {field.label} ({field.suffix})
            </span>
            <p className="mt-0.5 text-[13px] text-wl-muted">{field.hint}</p>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={field.suffix === '%' ? 100 : undefined}
              step="any"
              value={values[field.key]}
              onChange={(event) => onChange(field.key, event.target.value)}
              className="mt-1 h-9 w-36 rounded-[10px] border border-wl-line bg-white px-3 text-sm text-wl-ink"
            />
          </label>
        ))}
        <label className="block">
          <span className="text-sm font-medium text-wl-ink">Cancellation refund</span>
          <p className="mt-0.5 text-[13px] text-wl-muted">
            Used when a student cancels before the session starts. A session that has already started is not refunded automatically.
          </p>
          <select
            value={refundRule}
            onChange={(event) => onChange('cancellationRefund', event.target.value)}
            className="mt-1 h-9 w-full max-w-xl rounded-[10px] border border-wl-line bg-white px-3 text-sm text-wl-ink"
          >
            {REFUND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>
      {!parsed.ok ? <p className="mt-3 text-sm text-rose-700">{parsed.error}</p> : null}
      {preview ? (
        <div className="mt-4 rounded-xl bg-[#F5F3EF] px-4 py-3 text-sm text-wl-ink">
          <p className="font-medium">Preview</p>
          <p className="mt-1">
            $100 advertised: student pays {formatDollarsFromCents(preview.paid.chargeCents)}
            {' '}(fee {formatDollarsFromCents(preview.paid.platformFeeCents)}
            {preview.paid.taxCents > 0 ? `, tax ${formatDollarsFromCents(preview.paid.taxCents)}` : ''})
            , expert keeps {formatDollarsFromCents(preview.paid.expertNetCents)}.
          </p>
          <p className="mt-1">
            Free session at 0% tax: student pays {formatDollarsFromCents(preview.free.chargeCents)}.
          </p>
          <p className="mt-1">
            Free session at {SAMPLE_TAX_PERCENT}% tax: student pays {formatDollarsFromCents(preview.freeTaxed.chargeCents)}
            {' '}(tax {formatDollarsFromCents(preview.freeTaxed.taxCents)}).
          </p>
        </div>
      ) : null}
      <button
        type="button"
        onClick={onSave}
        disabled={!parsed.ok || saving}
        className="mt-4 h-9 rounded-full bg-wl-brand px-4 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? 'Saving…' : `Save ${title}`}
      </button>
    </section>
  );
}

export default function AdminRevenue() {
  const [forms, setForms] = useState<Record<Group, Record<keyof PricingRates, string>>>({
    seminar: emptyForm(),
    oneToOne: emptyForm(),
  });
  const [loaded, setLoaded] = useState<Record<Group, PricingRates> | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState<Group | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const settings = await getPricingSettings();
      if (cancelled) return;
      if (!settings?.seminar || !settings?.oneToOne) {
        setError('Could not load pricing settings.');
        return;
      }
      setLoaded(settings);
      setForms({
        seminar: formFromRates(settings.seminar),
        oneToOne: formFromRates(settings.oneToOne),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => (
    [
      ['seminar', 'Seminar'],
      ['oneToOne', '1:1'],
    ] as const
  ), []);

  const save = async (group: Group) => {
    if (!loaded) return;
    const parsed = validatePricingRates(forms[group], group);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setSaving(group);
    setError('');
    setNotice('');
    const next = { ...loaded, [group]: parsed.rates };
    const response = await savePricingSettings(next);
    setSaving(null);
    if (!response || response.error || response.status === 'FAIL') {
      setError(response?.error || 'Could not save pricing settings.');
      return;
    }
    const saved = {
      seminar: response.seminar || next.seminar,
      oneToOne: response.oneToOne || next.oneToOne,
    };
    setLoaded(saved);
    setForms({
      seminar: formFromRates(saved.seminar),
      oneToOne: formFromRates(saved.oneToOne),
    });
    setNotice('Saved. The next checkout and the next cancellation use these settings.');
  };

  return (
    <div className="px-4 py-7 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <h1 className={DASHBOARD_PAGE_TITLE}>Revenue</h1>
          <p className="mt-1 text-sm text-wl-muted">
            Seminar and 1:1 rates are independent. Students pay the advertised price plus the platform fee and tax. Expert commission is recorded separately and is not a Stripe fee.
          </p>
        </header>
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        {notice ? <p className="text-sm text-emerald-800">{notice}</p> : null}
        {groups.map(([group, title]) => (
          <GroupEditor
            key={group}
            title={title}
            sessionType={group}
            values={forms[group]}
            saving={saving === group}
            onChange={(key, value) => {
              setForms((current) => ({ ...current, [group]: { ...current[group], [key]: value } }));
            }}
            onSave={() => { void save(group); }}
          />
        ))}
      </div>
    </div>
  );
}
