import React, { useEffect, useMemo, useState } from 'react';
import { doGetAdminDemographics, type AdminDemographicsData } from '../../../api/api';
import {
  snapshotRangeBounds,
  type SnapshotCustomRange,
  type SnapshotRangeKey,
} from '../../../utils/adminSnapshotRange';
import LocationBars from './LocationBars';
import ServiceRequestList from './ServiceRequestList';
import SummaryTile from './SummaryTile';
import {
  type AudienceFilter,
  studentsWithServices,
  withLocationTotals,
} from './demographicsMath';

const PILL =
  'rounded-full px-3 py-1.5 text-xs font-medium tabular-nums transition focus:outline-none focus-visible:ring-2 focus-visible:ring-wl-brand/50 focus-visible:ring-offset-2';

const AUDIENCE_OPTIONS: { value: AudienceFilter; label: string }[] = [
  { value: 'all', label: 'All users' },
  { value: 'experts', label: 'Experts' },
  { value: 'students', label: 'Students' },
];

function emptyData(): AdminDemographicsData {
  return {
    totals: { experts: 0, students: 0 },
    locations: [],
    locationMissing: { experts: 0, students: 0 },
    services: [
      { key: 'study_abroad', label: 'Study Abroad', students: 0 },
      { key: 'work_abroad', label: 'Work Abroad', students: 0 },
      { key: 'research_guidance', label: 'Research Guidance', students: 0 },
    ],
    servicesMissing: 0,
  };
}

function DemographicsSkeleton() {
  return (
    <div className="rounded-xl border border-slate-300 bg-white p-4 sm:p-5" aria-hidden>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="h-5 w-36 animate-pulse rounded bg-wl-line/70" />
          <div className="h-4 w-56 animate-pulse rounded bg-wl-line/50" />
        </div>
        <div className="h-9 w-56 animate-pulse rounded-full bg-wl-line/50" />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-wl-line/40" />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-48 animate-pulse rounded-xl bg-wl-line/30" />
        <div className="h-48 animate-pulse rounded-xl bg-wl-line/30" />
      </div>
    </div>
  );
}

function missingLocationCopy(
  audience: AudienceFilter,
  experts: number,
  students: number,
): string {
  const total = experts + students;
  if (audience === 'experts') {
    if (!experts) return '';
    return `${experts.toLocaleString()} expert${experts === 1 ? " hasn't" : 's haven\'t'} added a location`;
  }
  if (audience === 'students') {
    if (!students) return '';
    return `${students.toLocaleString()} student${students === 1 ? " hasn't" : 's haven\'t'} added a location`;
  }
  if (!total) return '';
  return `${total.toLocaleString()} user${total === 1 ? " hasn't" : 's haven\'t'} added a location (${experts.toLocaleString()} expert${experts === 1 ? '' : 's'}, ${students.toLocaleString()} student${students === 1 ? '' : 's'})`;
}

export default function DemographicsSection({
  rangeKey,
  customRange,
}: {
  rangeKey: SnapshotRangeKey;
  customRange?: SnapshotCustomRange | null;
}) {
  const [audience, setAudience] = useState<AudienceFilter>('all');
  const [data, setData] = useState<AdminDemographicsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const res = await doGetAdminDemographics(
        snapshotRangeBounds(rangeKey, new Date(), customRange),
      );
      if (cancelled) return;
      if (res?.status === 'SUCCESS' && res.data) {
        setData(res.data);
        setError(null);
      } else {
        setData(null);
        setError('Could not load demographics. Try again.');
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [rangeKey, customRange?.startDate, customRange?.endDate, reloadKey]);

  const payload = data || emptyData();
  // Summary tiles always use all users; audience pills only filter the Locations panel.
  const summaryLoc = useMemo(() => withLocationTotals(payload, 'all'), [payload]);
  const filteredLoc = useMemo(() => withLocationTotals(payload, audience), [payload, audience]);
  const withService = studentsWithServices(payload);
  const peopleTotal = payload.totals.experts + payload.totals.students;

  const onRemind = () => {
    // TODO: wire profile-completion reminder notifications for users missing location/services.
  };

  if (loading) return <DemographicsSkeleton />;

  if (error) {
    return (
      <div className="rounded-xl border border-slate-300 bg-white p-4 sm:p-5 text-left">
        <h3 className="font-sans text-lg font-semibold text-wl-brand">Demographics</h3>
        <p className="mt-2 text-sm text-red" role="alert">
          {error}
        </p>
        <button
          type="button"
          onClick={() => setReloadKey(k => k + 1)}
          className="mt-3 rounded-full bg-wl-brand px-3 py-1.5 text-xs font-medium text-white hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-wl-brand/50"
        >
          Retry
        </button>
      </div>
    );
  }

  if (peopleTotal === 0) {
    return (
      <div className="rounded-xl border border-slate-300 bg-white p-4 sm:p-5 text-left">
        <h3 className="font-sans text-lg font-semibold text-wl-brand">Demographics</h3>
        <p className="mt-1 text-sm text-wl-muted">Where users are and what students need</p>
        <p className="mt-6 rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-wl-muted">
          No experts or students joined in this range yet.
        </p>
      </div>
    );
  }

  const topName = summaryLoc.top?.country || '—';
  const topCount = summaryLoc.top
    ? summaryLoc.top.experts + summaryLoc.top.students
    : 0;

  return (
    <section className="rounded-xl border border-slate-300 bg-white p-4 sm:p-5" aria-labelledby="demographics-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 text-left">
          <h3 id="demographics-heading" className="font-sans text-lg font-semibold text-wl-brand">
            Demographics
          </h3>
          <p className="mt-1 text-sm text-wl-muted">Where users are and what students need</p>
        </div>
        <div
          className="inline-flex rounded-full border border-slate-300 bg-white p-0.5"
          role="group"
          aria-label="Demographics audience"
        >
          {AUDIENCE_OPTIONS.map(opt => {
            const selected = audience === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setAudience(opt.value)}
                className={`${PILL} ${selected ? 'bg-wl-brand text-white' : 'text-wl-muted hover:text-wl-ink'}`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile
          label="Countries"
          value={summaryLoc.countries.toLocaleString()}
          hint={`from ${summaryLoc.known.toLocaleString()} profile${summaryLoc.known === 1 ? '' : 's'} with a location`}
        />
        <SummaryTile
          label="Top country"
          value={topName}
          hint={
            summaryLoc.top
              ? `${topCount.toLocaleString()} of ${summaryLoc.known.toLocaleString()} with a location`
              : 'No locations yet'
          }
        />
        <SummaryTile
          label="Outside the US"
          value={`${summaryLoc.outsideUsPct}%`}
          hint="of users with a location"
        />
        <SummaryTile
          label="Location filled in"
          value={`${summaryLoc.known.toLocaleString()} / ${peopleTotal.toLocaleString()}`}
          hint={`${summaryLoc.filledPct}% of users`}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
        <LocationBars
          rows={filteredLoc.rows}
          audience={audience}
          knownTotal={filteredLoc.known}
          missingMessage={missingLocationCopy(
            audience,
            payload.locationMissing.experts,
            payload.locationMissing.students,
          )}
          onRemind={onRemind}
        />
        <ServiceRequestList
          services={payload.services}
          studentsTotal={payload.totals.students}
          studentsWithService={withService}
          missingCount={payload.servicesMissing}
          onRemind={onRemind}
        />
      </div>
    </section>
  );
}
