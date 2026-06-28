import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Loader2, RefreshCw, GitMerge } from 'lucide-react';
import { doGetCustomMajors, doConsolidateMajors, doGetKeywordsAndServices } from '../../../api/api';
import { showErrorAlert, showSuccessAlert, showWarningAlert } from '../../../actions/alertActions';

type CustomMajorRow = { value: string; count: number };

export default function AdminMajors() {
  const dispatch = useDispatch();
  const [rows, setRows] = useState<CustomMajorRow[]>([]);
  const [officialMajors, setOfficialMajors] = useState<string[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [custom, ks] = await Promise.all([doGetCustomMajors(), doGetKeywordsAndServices()]);
    setRows(Array.isArray(custom) ? (custom as CustomMajorRow[]) : []);
    const ksKeywords = (ks as any)?.keywords;
    const officials: string[] = Array.isArray(ksKeywords)
      ? ksKeywords.map((k: any) => String(k?.value || '').trim()).filter(Boolean)
      : [];
    setOfficialMajors(Array.from(new Set(officials)).sort((a, b) => a.localeCompare(b)));
    setSelected({});
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedValues = useMemo(
    () => rows.filter((r) => selected[r.value]).map((r) => r.value),
    [rows, selected],
  );

  const toggle = (value: string) =>
    setSelected((prev) => ({ ...prev, [value]: !prev[value] }));

  const consolidate = async () => {
    const t = target.trim();
    if (!t) {
      dispatch(showWarningAlert('Enter the official major to consolidate into.'));
      return;
    }
    if (!selectedValues.length) {
      dispatch(showWarningAlert('Select at least one custom entry to consolidate.'));
      return;
    }
    setBusy(true);
    const res: any = await doConsolidateMajors({ sources: selectedValues, target: t });
    setBusy(false);
    if (res && res.major) {
      dispatch(
        showSuccessAlert(
          `"${res.major}" is now official — updated ${res.usersUpdated} profile(s).`,
        ),
      );
      setTarget('');
      await load();
    } else {
      dispatch(showErrorAlert('Could not consolidate. Please try again.'));
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-wl-brand">Custom majors</h2>
          <p className="mt-1 text-sm text-gray-500">
            Branches users typed under "Other". Select similar entries and consolidate them into
            one official major — affected profiles are updated and the major joins the dropdown.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center text-sm text-gray-500">
          No custom majors yet.
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="w-10 px-4 py-2.5"></th>
                  <th className="px-4 py-2.5">Custom major</th>
                  <th className="px-4 py-2.5 text-right">Users</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.value} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={!!selected[r.value]}
                        onChange={() => toggle(r.value)}
                        className="h-4 w-4 rounded border-gray-300 text-[#234C6A] focus:ring-[#234C6A]"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-gray-800">{r.value}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                Consolidate {selectedValues.length || 'selected'} into official major
              </label>
              <input
                type="text"
                list="official-majors"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="e.g. Ocean Engineering"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#234C6A]"
              />
              <datalist id="official-majors">
                {officialMajors.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={consolidate}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#234C6A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1b3c53] disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitMerge className="h-4 w-4" />}
              {busy ? 'Working…' : 'Consolidate'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
