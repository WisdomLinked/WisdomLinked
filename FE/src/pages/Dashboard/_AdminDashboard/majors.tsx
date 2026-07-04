import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Loader2, RefreshCw, GitMerge, History } from 'lucide-react';
import { doGetCustomMajors, doConsolidateMajors, doGetKeywordsAndServices, doGetMajorConsolidations } from '../../../api/api';
import { showErrorAlert, showSuccessAlert, showWarningAlert } from '../../../actions/alertActions';
import SelectField from '../../../components/ui/SelectField';

type CustomMajorRow = {
  value: string;
  count: number;
  userCount?: number;
  seminarCount?: number;
};

type ConsolidationRow = {
  _id: string;
  target: string;
  targetCreated?: boolean;
  sources?: string[];
  usersUpdated?: number;
  seminarsUpdated?: number;
  performedBy?: string;
  createdAt?: string;
};

export default function AdminMajors() {
  const dispatch = useDispatch();
  const [rows, setRows] = useState<CustomMajorRow[]>([]);
  const [history, setHistory] = useState<ConsolidationRow[]>([]);
  const [officialMajors, setOfficialMajors] = useState<string[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [target, setTarget] = useState('');
  const [addingNew, setAddingNew] = useState(false);
  const [newMajor, setNewMajor] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [custom, ks, hist] = await Promise.all([
      doGetCustomMajors(),
      doGetKeywordsAndServices(),
      doGetMajorConsolidations(),
    ]);
    setRows(Array.isArray(custom) ? (custom as CustomMajorRow[]) : []);
    setHistory(Array.isArray(hist) ? (hist as ConsolidationRow[]) : []);
    const ksKeywords = (ks as any)?.keywords;
    const officials: string[] = Array.isArray(ksKeywords)
      ? ksKeywords.map((k: any) => String(k?.value || '').trim()).filter(Boolean)
      : [];
    setOfficialMajors(Array.from(new Set(officials)).sort((a, b) => a.localeCompare(b)));
    setSelected({});
    setTarget('');
    setAddingNew(false);
    setNewMajor('');
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

  const options = useMemo(
    () => officialMajors.map((m) => ({ value: m, label: m })),
    [officialMajors],
  );

  const toggle = (value: string) =>
    setSelected((prev) => ({ ...prev, [value]: !prev[value] }));

  const apply = async () => {
    const finalTarget = addingNew ? newMajor.trim() : target;
    if (!finalTarget) {
      dispatch(showWarningAlert(addingNew ? 'Enter a name for the new major.' : 'Choose a major, or add a new one.'));
      return;
    }
    if (!addingNew && !selectedValues.length) {
      dispatch(showWarningAlert('Select at least one custom entry to consolidate.'));
      return;
    }

    setBusy(true);
    const res: any = await doConsolidateMajors({ sources: selectedValues, target: finalTarget });
    setBusy(false);
    if (res && res.major) {
      const parts = [`updated ${res.usersUpdated} profile(s)`];
      if (typeof res.seminarsUpdated === 'number') parts.push(`${res.seminarsUpdated} seminar(s)`);
      dispatch(
        showSuccessAlert(
          selectedValues.length
            ? `"${res.major}" is now official — ${parts.join(', ')}.`
            : `"${res.major}" added as an official major.`,
        ),
      );
      await load();
    } else {
      dispatch(showErrorAlert('Could not update majors. Please try again.'));
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-wl-brand">Custom majors</h2>
          <p className="mt-1 text-sm text-gray-500">
            Entries users and experts typed under "Other" (from profiles and seminars). Select the
            similar ones, then assign them to an existing official major — or add a new one from the
            dropdown. Affected profiles and seminars are updated and the major joins the dropdown.
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
      ) : (
        <>
          {rows.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center text-sm text-gray-500">
              No custom majors yet. You can still add a new official major below.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="w-10 px-4 py-2.5"></th>
                    <th className="px-4 py-2.5">Custom major</th>
                    <th className="px-4 py-2.5 text-right">Profiles</th>
                    <th className="px-4 py-2.5 text-right">Seminars</th>
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
                      <td className="px-4 py-2.5 text-right text-gray-500">{r.userCount ?? r.count}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{r.seminarCount ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
            <label className="mb-1.5 block text-xs font-semibold text-gray-700">
              Assign {selectedValues.length || 'selected'} to a major
            </label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="flex-1">
                <SelectField
                  value={addingNew ? '' : target}
                  onChange={(v) => {
                    setTarget(v);
                    setAddingNew(false);
                  }}
                  options={options}
                  placeholder={addingNew ? 'Adding a new major…' : 'Select an official major…'}
                  footerAction={{
                    label: 'Add a new major',
                    onSelect: () => {
                      setAddingNew(true);
                      setTarget('');
                    },
                  }}
                />
                {addingNew && (
                  <input
                    type="text"
                    autoFocus
                    value={newMajor}
                    onChange={(e) => setNewMajor(e.target.value)}
                    placeholder="e.g. Ocean Engineering"
                    className="mt-2 w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#234C6A]"
                  />
                )}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={apply}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#234C6A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1b3c53] disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitMerge className="h-4 w-4" />}
                {busy ? 'Working…' : 'Apply'}
              </button>
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
              <History className="h-4 w-4" /> Consolidation history
            </div>
            {history.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
                No consolidations yet.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-2.5">When</th>
                      <th className="px-4 py-2.5">Action</th>
                      <th className="px-4 py-2.5">Merged from</th>
                      <th className="px-4 py-2.5 text-right">Updated</th>
                      <th className="px-4 py-2.5">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h._id} className="border-t border-gray-100 align-top">
                        <td className="whitespace-nowrap px-4 py-2.5 text-gray-500">
                          {h.createdAt ? new Date(h.createdAt).toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-800">
                          {(h.sources?.length ?? 0) === 0 ? 'Created ' : 'Consolidated into '}
                          <span className="font-semibold">{h.target}</span>
                          {h.targetCreated && (
                            <span className="ml-1.5 rounded bg-[#EBF2F7] px-1.5 py-0.5 text-[11px] font-medium text-[#234C6A]">
                              new
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">
                          {h.sources?.length ? h.sources.join(', ') : '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right text-gray-500">
                          {(h.usersUpdated ?? 0)} profile(s), {(h.seminarsUpdated ?? 0)} seminar(s)
                        </td>
                        <td className="px-4 py-2.5 text-gray-500">{h.performedBy || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
