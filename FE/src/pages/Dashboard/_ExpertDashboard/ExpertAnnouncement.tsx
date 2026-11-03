import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  ChevronDown,
  Clock,
  EyeOff,
  Megaphone,
  Trash2,
} from 'lucide-react';
import { useAppSelector } from '../../../store';
import {
  createExpertAnnouncement,
  deleteExpertAnnouncement,
  getMyExpertAnnouncement,
  unpublishExpertAnnouncement,
  updateExpertAnnouncement,
} from '../../../api/api';
import AccessibleDialog from '../../../components/ui/AccessibleDialog';
import useNow from '../../../hooks/useNow';
import {
  DEFAULT_DURATION_DAYS,
  DURATION_PRESETS,
  MAX_VISIBLE_DAYS,
  MESSAGE_MAX,
  TITLE_MAX,
  TYPE_OPTIONS,
  addDaysLocal,
  feedReviewWillReset,
  formatEndDate,
  formatShortDate,
  formatTimeLeft,
  getEffectiveStatus,
  isEndingSoon,
  progressRemaining,
  resolveEndsAt,
  toDateInputValue,
  typeLabel,
  validateDraft,
  type Announcement,
  type AnnouncementDraft,
  type AnnouncementType,
  type AnnouncementVisibility,
  type DurationChoice,
  type FieldErrors,
} from '../../../utils/expertAnnouncement';

type Mode = 'view' | 'create' | 'edit' | 'repost';

const emptyDraft = (): AnnouncementDraft => ({
  title: '',
  message: '',
  type: 'funded_ra',
  link: '',
  visibility: 'profile',
});

function draftFromAnnouncement(a: Announcement): AnnouncementDraft {
  return {
    title: a.title,
    message: a.message,
    type: a.type,
    link: a.link || '',
    visibility: a.visibility,
  };
}

function applyFieldErrors(payload: unknown): FieldErrors {
  const errors: FieldErrors = {};
  if (!payload || typeof payload !== 'object') return errors;
  const list = (payload as { errors?: { field?: string; message?: string }[] }).errors;
  if (!Array.isArray(list)) return errors;
  for (const row of list) {
    const field = String(row.field || 'general') as keyof FieldErrors;
    errors[field] = String(row.message || 'Something went wrong.');
  }
  return errors;
}

export default function ExpertAnnouncement() {
  const now = useNow();
  const { auth: { userDetails } } = useAppSelector(state => state);
  const expertName = String(userDetails?.username || 'You');

  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('view');
  const [draft, setDraft] = useState<AnnouncementDraft>(emptyDraft);
  const [duration, setDuration] = useState<DurationChoice>({ kind: 'preset', days: DEFAULT_DURATION_DAYS });
  const [customDate, setCustomDate] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'unpublish' | 'delete' | null>(null);
  const cancelConfirmRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setBanner(null);
    try {
      const res = await getMyExpertAnnouncement();
      const row = res?.announcement as Announcement | null | undefined;
      setAnnouncement(row || null);
    } catch {
      setBanner("We couldn't load your announcement. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const effective = announcement ? getEffectiveStatus(announcement, now) : null;
  const live = effective === 'live';

  const pageTitle =
    mode === 'create'
      ? 'New announcement'
      : mode === 'edit'
        ? 'Edit announcement'
        : mode === 'repost'
          ? 'Repost announcement'
          : 'Announcement';

  const resolvedEnds = resolveEndsAt(
    duration.kind === 'custom' ? { kind: 'custom', endDate: customDate } : duration,
    now,
    announcement?.endsAt,
  );

  const clientErrors = attempted
    ? validateDraft(
        draft,
        duration.kind === 'custom' ? { kind: 'custom', endDate: customDate } : duration,
        now,
        announcement?.endsAt,
      )
    : {};

  const willResetFeed = feedReviewWillReset(draft, announcement);

  const openCreate = () => {
    setDraft(emptyDraft());
    setDuration({ kind: 'preset', days: DEFAULT_DURATION_DAYS });
    setCustomDate(toDateInputValue(addDaysLocal(now, DEFAULT_DURATION_DAYS)));
    setAttempted(false);
    setBanner(null);
    setMode('create');
  };

  const openEdit = () => {
    if (!announcement) return;
    setDraft(draftFromAnnouncement(announcement));
    setDuration({ kind: 'keep' });
    setCustomDate(toDateInputValue(new Date(announcement.endsAt)));
    setAttempted(false);
    setBanner(null);
    setMode('edit');
  };

  const openRepost = () => {
    if (!announcement) return;
    setDraft(draftFromAnnouncement(announcement));
    setDuration({ kind: 'preset', days: DEFAULT_DURATION_DAYS });
    setCustomDate(toDateInputValue(addDaysLocal(now, DEFAULT_DURATION_DAYS)));
    setAttempted(false);
    setBanner(null);
    setMode('repost');
  };

  const closeForm = () => {
    setMode('view');
    setAttempted(false);
  };

  const submitForm = async () => {
    setAttempted(true);
    setBanner(null);
    const choice: DurationChoice =
      duration.kind === 'custom' ? { kind: 'custom', endDate: customDate } : duration;
    const errors = validateDraft(draft, choice, now, announcement?.endsAt);
    if (Object.keys(errors).length) return;

    const endsAt = resolveEndsAt(choice, now, announcement?.endsAt);
    if (!endsAt) return;

    const body: Record<string, unknown> = {
      title: draft.title.trim(),
      message: draft.message.trim(),
      type: draft.type,
      link: draft.link.trim() || undefined,
      visibility: draft.visibility,
      endsAt: endsAt.toISOString(),
    };
    if (mode === 'repost') body.repost = true;
    if (mode === 'edit' && choice.kind === 'keep') {
      // Server keeps current endsAt when omitted — still send ISO of current for clarity.
      body.endsAt = announcement?.endsAt;
    }

    setSaving(true);
    try {
      const res =
        mode === 'create'
          ? await createExpertAnnouncement(body)
          : await updateExpertAnnouncement(body);
      if (res?.announcement) {
        setAnnouncement(res.announcement as Announcement);
        setMode('view');
        return;
      }
      const fieldErrs = applyFieldErrors(res);
      if (Object.keys(fieldErrs).length) {
        setBanner(fieldErrs.general || "We couldn't save your announcement. Check your connection and try again.");
        return;
      }
      setBanner("We couldn't save your announcement. Check your connection and try again.");
    } catch {
      setBanner("We couldn't save your announcement. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const runUnpublish = async () => {
    setSaving(true);
    setBanner(null);
    try {
      const res = await unpublishExpertAnnouncement();
      if (res?.announcement) {
        setAnnouncement(res.announcement as Announcement);
        setConfirm(null);
        return;
      }
      setBanner("We couldn't unpublish your announcement. Check your connection and try again.");
    } catch {
      setBanner("We couldn't unpublish your announcement. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const runDelete = async () => {
    setSaving(true);
    setBanner(null);
    try {
      const res = await deleteExpertAnnouncement();
      if (res?.status === 'SUCCESS' || res === true) {
        setAnnouncement(null);
        setConfirm(null);
        setMode('view');
        return;
      }
      setBanner("We couldn't delete your announcement. Check your connection and try again.");
    } catch {
      setBanner("We couldn't delete your announcement. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const tomorrow = toDateInputValue(addDaysLocal(now, 1));
  const maxDate = toDateInputValue(addDaysLocal(now, MAX_VISIBLE_DAYS));

  const initials = useMemo(() => {
    const parts = expertName.trim().split(/\s+/);
    return ((parts[0]?.[0] || 'Y') + (parts[1]?.[0] || '')).toUpperCase();
  }, [expertName]);

  if (loading) {
    return (
      <div className="p-6 text-sm text-wl-muted">Loading announcement…</div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="font-serif text-3xl font-medium text-wl-ink">{pageTitle}</h1>
        {mode === 'view' ? (
          <p className="mt-2 max-w-2xl text-sm text-wl-muted">
            Share one opportunity at a time with students. It comes down automatically on the end date.
          </p>
        ) : null}
      </header>

      {banner ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {banner}
        </div>
      ) : null}

      {mode === 'view' && !announcement ? (
        <div className="rounded-2xl border border-dashed border-wl-line bg-white px-6 py-14 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-wl-brandSoft text-wl-brand">
            <Megaphone className="h-6 w-6" aria-hidden />
          </div>
          <h2 className="mt-4 font-serif text-xl text-wl-ink">No active announcement</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-wl-muted">
            Post one opportunity — a funded RA role, internship, workshop, or project — for students to see on your profile.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-wl-brand px-5 py-2.5 text-sm font-semibold text-white hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wl-brand/50"
          >
            Write an announcement
          </button>
        </div>
      ) : null}

      {mode === 'view' && announcement && effective ? (
        <StatusCard
          announcement={announcement}
          effective={effective}
          now={now}
          onEdit={openEdit}
          onRepost={openRepost}
          onUnpublish={() => setConfirm('unpublish')}
          onDelete={() => setConfirm('delete')}
        />
      ) : null}

      {mode !== 'view' ? (
        <FormView
          draft={draft}
          setDraft={setDraft}
          duration={duration}
          setDuration={setDuration}
          customDate={customDate}
          setCustomDate={setCustomDate}
          resolvedEnds={resolvedEnds}
          now={now}
          tomorrow={tomorrow}
          maxDate={maxDate}
          errors={clientErrors}
          willResetFeed={willResetFeed}
          showKeep={mode === 'edit' && live}
          currentEndsAt={announcement?.endsAt}
          mode={mode}
          saving={saving}
          expertName={expertName}
          initials={initials}
          onCancel={closeForm}
          onSubmit={() => void submitForm()}
        />
      ) : null}

      <AccessibleDialog
        open={confirm === 'unpublish'}
        onClose={() => !saving && setConfirm(null)}
        title="Take it down?"
        role="alertdialog"
        busy={saving}
        initialFocusRef={cancelConfirmRef}
        footer={(
          <div className="flex justify-end gap-2">
            <button
              ref={cancelConfirmRef}
              type="button"
              disabled={saving}
              onClick={() => setConfirm(null)}
              className="min-h-[44px] rounded-lg border border-wl-line bg-white px-4 py-2 text-sm font-semibold text-wl-ink hover:bg-wl-pageAlt disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void runUnpublish()}
              className="min-h-[44px] rounded-lg bg-wl-brand px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Unpublish'}
            </button>
          </div>
        )}
      >
        <p className="text-sm text-wl-muted">
          It disappears from your profile and the Opportunities feed right away. You can repost it later.
        </p>
      </AccessibleDialog>

      <AccessibleDialog
        open={confirm === 'delete'}
        onClose={() => !saving && setConfirm(null)}
        title="Delete this announcement?"
        role="alertdialog"
        busy={saving}
        initialFocusRef={cancelConfirmRef}
        footer={(
          <div className="flex justify-end gap-2">
            <button
              ref={cancelConfirmRef}
              type="button"
              disabled={saving}
              onClick={() => setConfirm(null)}
              className="min-h-[44px] rounded-lg border border-wl-line bg-white px-4 py-2 text-sm font-semibold text-wl-ink hover:bg-wl-pageAlt disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void runDelete()}
              className="min-h-[44px] rounded-lg bg-red px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Delete'}
            </button>
          </div>
        )}
      >
        <p className="text-sm text-wl-muted">
          It&apos;s removed from your profile and the feed, and you can&apos;t undo this. Messages students already sent stay in Chat.
        </p>
      </AccessibleDialog>
    </div>
  );
}

function StatusCard({
  announcement,
  effective,
  now,
  onEdit,
  onRepost,
  onUnpublish,
  onDelete,
}: {
  announcement: Announcement;
  effective: ReturnType<typeof getEffectiveStatus>;
  now: Date;
  onEdit: () => void;
  onRepost: () => void;
  onUnpublish: () => void;
  onDelete: () => void;
}) {
  const live = effective === 'live';
  const endingSoon = live && isEndingSoon(announcement, now);
  const remaining = progressRemaining(announcement.publishedAt, announcement.endsAt, now);

  const statusBadge =
    effective === 'live'
      ? { label: 'Live', className: 'bg-emerald-100 text-emerald-800' }
      : effective === 'unpublished'
        ? { label: 'Taken down', className: 'bg-slate-100 text-slate-700' }
        : { label: 'Ended', className: 'bg-slate-100 text-slate-700' };

  const profilePlacement = live ? 'Live' : 'Hidden';
  let feedPlacement = 'Not listed';
  let feedClass = 'text-wl-muted';
  if (announcement.visibility === 'profile_and_feed') {
    if (!live) {
      feedPlacement = 'Hidden';
    } else if (announcement.feedReview === 'pending') {
      feedPlacement = 'In review';
      feedClass = 'text-amber-700';
    } else if (announcement.feedReview === 'approved') {
      feedPlacement = 'Live';
      feedClass = 'text-emerald-700';
    } else if (announcement.feedReview === 'rejected') {
      feedPlacement = 'Not approved';
      feedClass = 'text-red-700';
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-wl-line bg-white shadow-sm">
      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusBadge.className}`}>
            {effective === 'live' ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" aria-hidden /> : null}
            {statusBadge.label}
          </span>
          <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
            {typeLabel(announcement.type)}
          </span>
        </div>

        <div>
          <h2 className="font-serif text-xl text-wl-ink sm:text-2xl">{announcement.title}</h2>
          <p className="mt-2 line-clamp-3 text-sm text-wl-muted whitespace-pre-wrap">{announcement.message}</p>
        </div>

        <div className="border-t border-wl-line pt-5">
          {live ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="inline-flex items-center gap-2 font-medium text-wl-ink">
                  <Clock className="h-4 w-4 text-wl-muted" aria-hidden />
                  {formatTimeLeft(announcement.endsAt, now)}
                </span>
                <span className="text-wl-muted">Ends {formatEndDate(announcement.endsAt)}</span>
              </div>
              <div
                className="mt-3 h-1.5 overflow-hidden rounded-full bg-wl-pageAlt"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(remaining * 100)}
                aria-label="Time remaining"
              >
                <div
                  className={`h-full rounded-full ${endingSoon ? 'bg-[#E07B54]' : 'bg-wl-brand'}`}
                  style={{ width: `${Math.max(2, remaining * 100)}%` }}
                />
              </div>
              {endingSoon ? (
                <p className="mt-2 text-sm text-[#E07B54]">
                  Ending soon. Use Edit to give it more time.
                </p>
              ) : null}
            </>
          ) : effective === 'expired' ? (
            <p className="text-sm text-wl-muted">
              Ended {formatEndDate(announcement.endsAt)}. Students can no longer see it.
            </p>
          ) : (
            <p className="text-sm text-wl-muted">
              Students can no longer see it. You can repost it with a new end date.
            </p>
          )}
        </div>

        <div className="space-y-3 border-t border-wl-line pt-5 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-wl-muted">Your profile</span>
            <span className="font-medium text-wl-ink">{profilePlacement}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-wl-muted">Opportunities feed</span>
            <span className={`font-medium ${feedClass}`}>{feedPlacement}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-wl-line bg-wl-pageAlt/40 px-5 py-4 sm:flex-row sm:items-center">
        {live ? (
          <>
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-wl-brand px-4 py-2.5 text-sm font-semibold text-white hover:brightness-95"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onUnpublish}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-wl-line bg-white px-4 py-2.5 text-sm font-semibold text-wl-ink hover:bg-white"
            >
              <EyeOff className="h-4 w-4" aria-hidden />
              Unpublish
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 sm:ml-auto"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onRepost}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-wl-brand px-4 py-2.5 text-sm font-semibold text-white hover:brightness-95"
            >
              Repost
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 sm:ml-auto"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function FormView({
  draft,
  setDraft,
  duration,
  setDuration,
  customDate,
  setCustomDate,
  resolvedEnds,
  now,
  tomorrow,
  maxDate,
  errors,
  willResetFeed,
  showKeep,
  currentEndsAt,
  mode,
  saving,
  expertName,
  initials,
  onCancel,
  onSubmit,
}: {
  draft: AnnouncementDraft;
  setDraft: React.Dispatch<React.SetStateAction<AnnouncementDraft>>;
  duration: DurationChoice;
  setDuration: React.Dispatch<React.SetStateAction<DurationChoice>>;
  customDate: string;
  setCustomDate: (v: string) => void;
  resolvedEnds: Date | null;
  now: Date;
  tomorrow: string;
  maxDate: string;
  errors: FieldErrors;
  willResetFeed: boolean;
  showKeep: boolean;
  currentEndsAt?: string;
  mode: Mode;
  saving: boolean;
  expertName: string;
  initials: string;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const titleCount = draft.title.length;
  const messageCount = draft.message.length;
  const submitLabel =
    mode === 'create' ? 'Publish announcement' : mode === 'repost' ? 'Repost announcement' : 'Save changes';

  const durationCards: { id: string; label: string; hint: string; choice: DurationChoice; selected: boolean }[] = [];
  if (showKeep && currentEndsAt) {
    durationCards.push({
      id: 'keep',
      label: 'Keep current',
      hint: `Until ${formatShortDate(currentEndsAt)}`,
      choice: { kind: 'keep' },
      selected: duration.kind === 'keep',
    });
  }
  for (const days of DURATION_PRESETS) {
    const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    durationCards.push({
      id: `d${days}`,
      label: `${days} days`,
      hint: `Until ${formatShortDate(until.toISOString())}`,
      choice: { kind: 'preset', days },
      selected: duration.kind === 'preset' && duration.days === days,
    });
  }
  durationCards.push({
    id: 'custom',
    label: 'Custom',
    hint: 'Up to 90 days',
    choice: { kind: 'custom', endDate: customDate },
    selected: duration.kind === 'custom',
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <form
        className="space-y-6 rounded-2xl border border-wl-line bg-white p-5 sm:p-6"
        onSubmit={e => {
          e.preventDefault();
          onSubmit();
        }}
        noValidate
      >
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label htmlFor="ann-title" className="text-sm font-medium text-wl-ink">Title</label>
              <span className={`text-xs tabular-nums ${titleCount / TITLE_MAX >= 0.9 ? 'text-[#E07B54]' : 'text-wl-muted'}`}>
                {titleCount}/{TITLE_MAX}
              </span>
            </div>
            <input
              id="ann-title"
              maxLength={TITLE_MAX}
              value={draft.title}
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? 'ann-title-err' : undefined}
              onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
              className="h-12 w-full rounded-lg border border-wl-line px-3 text-sm outline-none focus:border-wl-brand focus:ring-2 focus:ring-wl-brand/40"
            />
            {errors.title ? <p id="ann-title-err" className="mt-1 text-sm text-red-700">{errors.title}</p> : null}
          </div>
          <div>
            <label htmlFor="ann-type" className="mb-1 block text-sm font-medium text-wl-ink">Type</label>
            <div className="relative">
              <select
                id="ann-type"
                value={draft.type}
                onChange={e => setDraft(d => ({ ...d, type: e.target.value as AnnouncementType }))}
                className="h-12 w-full appearance-none rounded-lg border border-wl-line bg-white px-3 pr-10 text-sm text-wl-ink outline-none focus:border-wl-brand focus:ring-2 focus:ring-wl-brand/40"
              >
                {TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-wl-muted"
                aria-hidden
              />
            </div>
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label htmlFor="ann-message" className="text-sm font-medium text-wl-ink">Message</label>
            <span className={`text-xs tabular-nums ${messageCount / MESSAGE_MAX >= 0.9 ? 'text-[#E07B54]' : 'text-wl-muted'}`}>
              {messageCount}/{MESSAGE_MAX}
            </span>
          </div>
          <textarea
            id="ann-message"
            rows={5}
            maxLength={MESSAGE_MAX}
            value={draft.message}
            placeholder="What's the opportunity, who should reach out, and what should they send you?"
            aria-invalid={Boolean(errors.message)}
            aria-describedby={errors.message ? 'ann-message-err' : undefined}
            onChange={e => setDraft(d => ({ ...d, message: e.target.value }))}
            className="w-full resize-y rounded-lg border border-wl-line px-3 py-3 text-sm outline-none focus:border-wl-brand focus:ring-2 focus:ring-wl-brand/40"
          />
          {errors.message ? <p id="ann-message-err" className="mt-1 text-sm text-red-700">{errors.message}</p> : null}
        </div>

        <div>
          <label htmlFor="ann-link" className="mb-1 block text-sm font-medium text-wl-ink">Link (optional)</label>
          <input
            id="ann-link"
            type="url"
            value={draft.link}
            placeholder="https://"
            aria-invalid={Boolean(errors.link)}
            aria-describedby={errors.link ? 'ann-link-err' : undefined}
            onChange={e => setDraft(d => ({ ...d, link: e.target.value }))}
            className="h-12 w-full rounded-lg border border-wl-line px-3 text-sm outline-none focus:border-wl-brand focus:ring-2 focus:ring-wl-brand/40"
          />
          {errors.link ? <p id="ann-link-err" className="mt-1 text-sm text-red-700">{errors.link}</p> : null}
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-wl-ink">How long should it stay up?</legend>
          <p className="mt-1 text-sm text-wl-muted">It comes down automatically when time runs out.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3" role="radiogroup" aria-label="Duration">
            {durationCards.map(card => (
              <label
                key={card.id}
                className={`relative flex min-h-[72px] cursor-pointer flex-col justify-center rounded-xl border px-3 py-3 text-sm transition ${
                  card.selected
                    ? 'border-wl-brand bg-wl-brandSoft/60'
                    : 'border-wl-line bg-white hover:border-wl-brand/40'
                }`}
              >
                <input
                  type="radio"
                  name="ann-duration"
                  className="sr-only"
                  checked={card.selected}
                  onChange={() => {
                    if (card.choice.kind === 'custom') {
                      setDuration({ kind: 'custom', endDate: customDate || tomorrow });
                      if (!customDate) setCustomDate(tomorrow);
                    } else {
                      setDuration(card.choice);
                    }
                  }}
                />
                <span className="font-semibold text-wl-ink">{card.label}</span>
                <span className="text-xs text-wl-muted">{card.hint}</span>
              </label>
            ))}
          </div>
          {duration.kind === 'custom' ? (
            <div className="mt-3">
              <label htmlFor="ann-custom-date" className="mb-1 block text-sm font-medium text-wl-ink">Custom end date</label>
              <input
                id="ann-custom-date"
                type="date"
                min={tomorrow}
                max={maxDate}
                value={customDate}
                onChange={e => {
                  setCustomDate(e.target.value);
                  setDuration({ kind: 'custom', endDate: e.target.value });
                }}
                className="h-12 min-w-[160px] rounded-lg border border-wl-line px-3 text-sm"
              />
            </div>
          ) : null}
          {errors.endsAt ? <p className="mt-2 text-sm text-red-700">{errors.endsAt}</p> : null}
          {resolvedEnds ? (
            <p className="mt-3 inline-flex items-center gap-2 text-sm text-wl-muted">
              <Calendar className="h-4 w-4" aria-hidden />
              Visible until {formatEndDate(resolvedEnds.toISOString())}
            </p>
          ) : null}
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium text-wl-ink">Where should it appear?</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Visibility">
            {([
              {
                value: 'profile' as AnnouncementVisibility,
                title: 'Profile only',
                body: 'Goes live on your profile right away.',
              },
              {
                value: 'profile_and_feed' as AnnouncementVisibility,
                title: 'Profile + WisdomLinked news',
                body: 'Live on your profile now, and listed in the Opportunities feed after a quick review.',
              },
            ]).map(opt => (
              <label
                key={opt.value}
                className={`cursor-pointer rounded-xl border px-4 py-3 text-sm ${
                  draft.visibility === opt.value
                    ? 'border-wl-brand bg-wl-brandSoft/60'
                    : 'border-wl-line bg-white hover:border-wl-brand/40'
                }`}
              >
                <input
                  type="radio"
                  name="ann-visibility"
                  className="sr-only"
                  checked={draft.visibility === opt.value}
                  onChange={() => setDraft(d => ({ ...d, visibility: opt.value }))}
                />
                <span className="block font-semibold text-wl-ink">{opt.title}</span>
                <span className="mt-1 block text-wl-muted">{opt.body}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {willResetFeed ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Editing the title, message, or link sends the feed listing back for a quick review. Your profile shows the new version right away.
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-t border-wl-line pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="min-h-[44px] rounded-lg border border-wl-line bg-white px-4 py-2.5 text-sm font-semibold text-wl-ink hover:bg-wl-pageAlt disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] rounded-lg bg-wl-brand px-4 py-2.5 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"
          >
            {saving ? 'Saving…' : submitLabel}
          </button>
        </div>
      </form>

      <aside className="lg:sticky lg:top-4 lg:self-start">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-wl-muted">On your profile</p>
        <div className="rounded-2xl border border-wl-line bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-wl-brandSoft text-sm font-semibold text-wl-brand">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-medium text-wl-ink">{expertName}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#E07B54] px-2 py-0.5 text-[11px] font-semibold uppercase text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
                  New
                </span>
              </div>
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-[#E07B54]/30 bg-[#E07B54]/10 px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#E07B54]">
              {typeLabel(draft.type)}
            </p>
            <p className="mt-1 truncate text-sm font-medium text-wl-ink">
              {draft.title.trim() || 'Your title shows here'}
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
