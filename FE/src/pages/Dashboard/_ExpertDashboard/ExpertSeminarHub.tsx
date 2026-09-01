import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  MapPin,
  User,
  Users,
  Plus,
  Pencil,
  Repeat,
  Trash2,
  MessageSquare,
} from 'lucide-react';
import { useDispatch } from 'react-redux';

import { useAppSelector } from '../../../store';
import { updateMe } from '../../../actions/authActions';
import { setChosenGroupChatDetails } from '../../../actions/chatActions';
import { SetLoadingStatus } from '../../../actions/appActions';
import { showSuccessAlert } from '../../../actions/alertActions';
import { deleteGroup, profileImageFetch, getSeminarSeatRequests, approveSeminarSeatRequest, rejectSeminarSeatRequest } from '../../../api/api';
import { resolveProfileImageSrc } from '../../../utils/profileImage';
import { seminarCapacityLabel, seminarEnrollmentLabel } from '../../../utils/seminarCapacityLabel';
import { usePeerProfileModal } from '../../../hooks/usePeerProfileModal';
import { canonicalLabelsFromMixedServiceEntries } from '../../../constants/serviceOptions';
import Avatar from '../../../components/Avatar';
import DecisionNoteField from '../../../components/dashboard/DecisionNoteField';
import GroupParticipantsDialog from '../Messenger/Messages/GroupParticipantsDialog';
import ExpertSeminar from './seminar';
import { recurrenceLabel } from '../../../utils/recurrenceLabel';

type HubScreen = 'list' | 'create' | 'edit' | 'detail';

const recurrenceLabelOf = (g: any): string | undefined => recurrenceLabel(g);

function groupSeminarSeries(list: any[]): { seminar: any; occurrenceCount: number }[] {
  const now = Date.now();
  const bySeries = new Map<string, any[]>();
  const out: { seminar: any; occurrenceCount: number }[] = [];
  for (const g of list) {
    const sid = g?.seriesId ? String(g.seriesId) : '';
    if (sid) {
      const arr = bySeries.get(sid) || [];
      arr.push(g);
      bySeries.set(sid, arr);
    } else {
      out.push({ seminar: g, occurrenceCount: 1 });
    }
  }
  bySeries.forEach((arr) => {
    const sorted = [...arr].sort((a, b) => {
      const ta = a?.start ? new Date(a.start).getTime() : 0;
      const tb = b?.start ? new Date(b.start).getTime() : 0;
      return ta - tb;
    });
    const rep = sorted.find((x) => (x?.start ? new Date(x.start).getTime() : 0) >= now) || sorted[0];
    out.push({ seminar: rep, occurrenceCount: arr.length });
  });
  return out;
}

function getRefId(ref: unknown): string {
  if (ref == null) return '';
  if (typeof ref === 'string') return ref;
  if (typeof ref === 'object' && ref !== null && '_id' in ref) {
    return String((ref as { _id: string })._id);
  }
  return '';
}

function labelsFromMixed(arr: unknown[] | undefined): string[] {
  if (!arr?.length) return [];
  return arr
    .map((item: any) => {
      if (typeof item === 'string') return item;
      if (item?.value) return String(item.value);
      return '';
    })
    .filter(Boolean);
}

function mapGroupChatToExpertSeminar(g: any) {
  return {
    groupId: String(g._id),
    groupName: g.name || '',
    description: g.description || '',
    keywords: labelsFromMixed(g.keywords),
    services: canonicalLabelsFromMixedServiceEntries(g.services),
    tags: Array.isArray(g.tags) ? g.tags.filter((t: unknown): t is string => typeof t === 'string') : [],
    purposeOther: typeof g.purposeOther === 'string' ? g.purposeOther : '',
    start: g.start,
    end: g.end,
    duration: g.duration,
    price: g.price,
    maxAttendees: typeof g.maxAttendees === 'number' ? g.maxAttendees : null,
    image: g.image ?? null,
    status: g.status,
    isRecurring: !!g.isRecurring,
    recurrenceFrequency: g.recurrenceFrequency,
    recurrenceUnit: g.recurrenceUnit,
    recurrenceInterval: g.recurrenceInterval,
    recurrenceWeekdays: Array.isArray(g.recurrenceWeekdays) ? g.recurrenceWeekdays : [],
    recurrenceCount: g.recurrenceCount ?? null,
    recurrenceUntil: g.recurrenceUntil ?? null,
    seriesId: g.seriesId ? String(g.seriesId) : null,
  };
}

function SeminarCard({
  seminar,
  onClick,
  onEnterChat,
  badge,
  recurrenceLabel,
  occurrenceCount,
  waitingCount = 0,
  showEnrollment = false,
}: {
  seminar: any;
  onClick: () => void;
  onEnterChat?: () => void;
  badge?: string;
  recurrenceLabel?: string;
  occurrenceCount?: number;
  waitingCount?: number;
  showEnrollment?: boolean;
}) {
  const start = seminar?.start ? new Date(seminar.start) : null;
  const admin = seminar?.admin;
  const dateStr = start
    ? start.toLocaleDateString(undefined, { dateStyle: 'medium' })
    : '—';
  const timeStr = start
    ? start.toLocaleTimeString(undefined, { timeStyle: 'short' })
    : '';
  const majors = labelsFromMixed(seminar?.keywords).slice(0, 3);
  // The host is stored as a participant for chat membership, so exclude them
  // from the enrolled count — mirrors SeminarDetailPane's enrolledCount.
  const adminId = getRefId(admin);
  const n = Array.isArray(seminar?.participants)
    ? seminar.participants.filter((p: unknown) => getRefId(p) !== adminId).length
    : 0;
  const maxAttendees = typeof seminar?.maxAttendees === 'number' ? seminar.maxAttendees : null;
  const isFull = maxAttendees != null && (maxAttendees <= 0 || n >= maxAttendees);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="group flex h-full flex-col rounded-2xl border border-[#e8e6e1] bg-white shadow-[0_12px_32px_rgba(15,23,42,0.08)] overflow-hidden transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(15,23,42,0.14)] cursor-pointer text-left"
    >
      <div className="relative h-36 w-full overflow-hidden bg-gradient-to-br from-[#234C6A] to-slate-800 sm:h-40">
        {seminar?.image ? (
          <img
            src={seminar.image}
            alt={seminar?.name || 'Seminar cover'}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/90">
            <span className="text-3xl font-serif font-semibold opacity-90">
              {(seminar?.name || 'S').slice(0, 1).toUpperCase()}
            </span>
          </div>
        )}
        {badge ? (
          <div
            className={`absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur ${
              badge === 'Draft' ? 'bg-amber-500/90' : 'bg-black/55'
            }`}
          >
            {badge}
          </div>
        ) : null}
        {recurrenceLabel ? (
          <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#234C6A]/90 px-2.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
            <Repeat className="h-3 w-3" aria-hidden />
            {recurrenceLabel}
          </div>
        ) : null}
        {isFull ? (
          <div className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-rose-600/95 px-2.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
            Full
          </div>
        ) : null}
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="text-[15px] font-semibold text-slate-900 leading-snug line-clamp-2">
          {seminar?.name || 'Seminar'}
        </h3>
        <p className="mt-2 text-xs text-slate-600 line-clamp-2">{seminar?.description || ''}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-600">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1">
            <Clock className="h-3 w-3 text-[#234C6A]" aria-hidden />
            {dateStr}
            {timeStr ? ` · ${timeStr}` : ''}
          </span>
          {admin?.username ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1">
              <User className="h-3 w-3 text-[#234C6A]" aria-hidden />
              {admin.username}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1">
            <Users className="h-3 w-3 text-[#234C6A]" aria-hidden />
            {showEnrollment
              ? seminarEnrollmentLabel(n, waitingCount, maxAttendees)
              : seminarCapacityLabel(n, maxAttendees)}
          </span>
          {recurrenceLabel && occurrenceCount && occurrenceCount > 1 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#E8EEF4] px-2 py-1 text-[#234C6A]">
              <Repeat className="h-3 w-3" aria-hidden />
              {recurrenceLabel} · {occurrenceCount} sessions
            </span>
          ) : null}
        </div>
        {majors.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {majors.map((m) => (
              <span
                key={m}
                className="rounded-full bg-[#E8EEF4] px-2 py-0.5 text-[10px] font-medium text-[#234C6A]"
              >
                {m}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-auto pt-3 flex justify-end gap-2">
          {onEnterChat ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEnterChat();
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#234C6A] bg-white px-3 py-1.5 text-xs font-semibold text-[#234C6A] hover:bg-[#F5F3EF]"
            >
              <MessageSquare className="h-3.5 w-3.5" aria-hidden />
              Enter chat
            </button>
          ) : null}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className="inline-flex items-center justify-center rounded-lg bg-[#234C6A] px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110"
          >
            View details
          </button>
        </div>
      </div>
    </article>
  );
}

// Overflow seat requests for a full seminar: students who paid (funds held) and
// are awaiting the host's approval. Approving captures the hold; declining releases it.
function SeatRequestsPanel({ seminarId }: { seminarId: string }) {
  const { auth: { userDetails } } = useAppSelector((s) => s);
  const { openPeerProfile, peerProfileModal } = usePeerProfileModal(userDetails?.role);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Decided rows show a confirmation in place for a few seconds, then drop out.
  const [notices, setNotices] = useState<Record<string, string>>({});
  // Per-request note the student receives with the decision.
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteErrors, setNoteErrors] = useState<Record<string, string>>({});
  const noticeTimers = useRef<number[]>([]);
  useEffect(
    () => () => {
      noticeTimers.current.forEach((id) => window.clearTimeout(id));
    },
    [],
  );

  const load = async () => {
    try {
      const res: any = await getSeminarSeatRequests();
      const all = Array.isArray(res?.result) ? res.result : [];
      setRequests(all.filter((r: any) => getRefId(r?.groupChat) === String(seminarId)));
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seminarId]);

  const decide = async (requestId: string, action: 'approve' | 'reject') => {
    const note = (notes[String(requestId)] ?? '').trim();
    // Turning a student away past capacity must come with something they can act on.
    if (action === 'reject' && !note) {
      setNoteErrors((prev) => ({
        ...prev,
        [String(requestId)]: 'Please add a short note so the student knows what to do next.',
      }));
      return;
    }
    setBusyId(requestId);
    setError(null);
    const raw = requests.find((r) => String(r._id) === String(requestId));
    const studentName = raw?.customer?.username || raw?.customer?.email || 'The student';
    const seminarTitle = raw?.groupChat?.name || 'the seminar';
    const cents = typeof raw?.amount === 'number' ? raw.amount : 0;
    const amountLabel = cents > 0 ? `$${(cents / 100).toFixed(2)}` : '';
    try {
      const res: any = action === 'approve'
        ? await approveSeminarSeatRequest(requestId, note)
        : await rejectSeminarSeatRequest(requestId, note);
      if (res === false || res?.status === 'FAIL' || res?.error) {
        setError(res?.error || 'Could not update the seat request.');
        return;
      }
      const message = action === 'approve'
        ? `${studentName} has been admitted to the seminar “${seminarTitle}”.${amountLabel ? ` A payment of ${amountLabel} has been successfully charged.` : ''}`
        : `${studentName} was not admitted to “${seminarTitle}”.${amountLabel ? ` The payment authorization of ${amountLabel} has been released.` : ''}`;
      setNotices((prev) => ({ ...prev, [String(requestId)]: message }));
      const timer = window.setTimeout(() => {
        setRequests((prev) => prev.filter((r) => String(r._id) !== String(requestId)));
        setNotices((prev) => {
          const next = { ...prev };
          delete next[String(requestId)];
          return next;
        });
      }, 7000);
      noticeTimers.current.push(timer);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update the seat request.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return null;
  if (requests.length === 0) return null;

  return (
    <>
    <div className="mt-5 border-t border-[#E5E2DB] pt-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A7A72]">
        Seat requests ({requests.length})
      </p>
      <p className="mt-1 text-xs text-[#7A7A72]">
        These students requested a seat beyond capacity. Approving admits them (and charges any
        held payment); declining releases any hold.
      </p>
      {error ? (
        <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          {error}
        </p>
      ) : null}
      <div className="mt-3 space-y-3">
        {requests.map((r) => {
          const notice = notices[String(r._id)];
          if (notice) {
            return (
              <div
                key={String(r._id)}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs font-medium text-emerald-800"
              >
                {notice}
              </div>
            );
          }
          const name = r?.customer?.username || r?.customer?.email || 'Student';
          const customerId = r?.customer?._id ? String(r.customer._id) : '';
          const deadline = r?.decisionDeadline ? new Date(r.decisionDeadline) : null;
          const busy = busyId === String(r._id);
          return (
            <div key={String(r._id)} className="rounded-lg border border-[#E5E2DB] bg-[#F5F3EF] px-3 py-3">
              {customerId ? (
                <button
                  type="button"
                  onClick={() =>
                    openPeerProfile({ userId: customerId, username: name, image: r?.customer?.image ?? null })
                  }
                  className="text-left text-sm font-semibold text-[#234C6A] hover:underline"
                  title="View student card"
                >
                  {name}
                </button>
              ) : (
                <p className="text-sm font-semibold text-[#1A3A4A]">{name}</p>
              )}
              <p className="mt-0.5 text-[11px] font-medium text-[#234C6A]">
                {typeof r?.amount === 'number' && r.amount > 0
                  ? `$${(r.amount / 100).toFixed(2)} held`
                  : 'Free seminar'}
              </p>
              {deadline ? (
                <p className="mt-0.5 text-[11px] text-[#7A7A72]">
                  Decide by {deadline.toLocaleString()}
                </p>
              ) : null}
              <div className="mt-2">
                <DecisionNoteField
                  id={`seat-note-${String(r._id)}`}
                  value={notes[String(r._id)] ?? ''}
                  onChange={(next) => {
                    setNotes((prev) => ({ ...prev, [String(r._id)]: next }));
                    if (next.trim()) {
                      setNoteErrors((prev) => ({ ...prev, [String(r._id)]: '' }));
                    }
                  }}
                  required
                  disabled={busy}
                  label="Note to the student (required to decline)"
                />
                {noteErrors[String(r._id)] ? (
                  <p className="mt-1 text-[10px] font-semibold text-rose-600">
                    {noteErrors[String(r._id)]}
                  </p>
                ) : null}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => decide(String(r._id), 'approve')}
                  className="flex-1 rounded-lg bg-[#234C6A] px-3 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
                >
                  {busy ? '…' : 'Approve'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => decide(String(r._id), 'reject')}
                  className="flex-1 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                >
                  {busy ? '…' : 'Decline'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
    {peerProfileModal}
    </>
  );
}

function SeminarDetailPane({
  seminar,
  isHost,
  waitingCount = 0,
  onBack,
  onEdit,
  onDelete,
}: {
  seminar: any;
  isHost: boolean;
  waitingCount?: number;
  onBack: () => void;
  onEdit: () => void;
  onDelete: (scope: 'occurrence' | 'series') => void;
}) {
  const dispatch = useDispatch();
  const { auth: { userDetails } } = useAppSelector((s) => s);
  const [showParticipants, setShowParticipants] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const enterSeminarChat = () => {
    if (!seminar?._id) return;
    dispatch(
      setChosenGroupChatDetails({
        ...seminar,
        groupId: seminar._id,
        groupName: seminar.name,
      } as any),
    );
    window.dispatchEvent(new Event('wl-open-chat-nav'));
  };
  const isRecurring = !!seminar?.isRecurring;
  const admin = seminar?.admin;
  const participants: any[] = Array.isArray(seminar?.participants) ? seminar.participants : [];
  // Enrolled students = participants minus the host. A seminar with anyone
  // enrolled can't be self-deleted; the host is told to contact an admin.
  const adminId = getRefId(admin);
  const enrolledCount = participants.filter((p) => getRefId(p) !== adminId).length;
  const hasEnrolledStudents = enrolledCount > 0;
  const maxAttendees = typeof seminar?.maxAttendees === 'number' ? seminar.maxAttendees : null;
  const start = seminar?.start ? new Date(seminar.start) : null;
  const end = seminar?.end ? new Date(seminar.end) : null;
  const fmtDate12h = (value: any) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const time = d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${y}/${m}/${day} ${time}`;
  };
  const now = Date.now();
  const isPast = end ? end.getTime() < now : start ? start.getTime() < now : false;
  const keywords = labelsFromMixed(seminar?.keywords);
  const purposeOther = typeof seminar?.purposeOther === 'string' ? seminar.purposeOther.trim() : '';
  const services = [
    ...canonicalLabelsFromMixedServiceEntries(seminar?.services),
    ...(purposeOther ? [purposeOther] : []),
  ];

  const [resolvedImages, setResolvedImages] = useState<Map<string, string>>(new Map());
  const imageCacheRef = useRef(new Map<string, string>());

  useEffect(() => {
    let cancelled = false;
    const people = [admin, ...participants].filter(Boolean);
    const needed = new Map<string, string>();
    for (const person of people) {
      const ref = typeof person?.image === 'string' ? person.image.trim() : '';
      if (ref && !imageCacheRef.current.has(ref)) needed.set(ref, ref);
    }
    if (needed.size === 0) return;

    void Promise.all(
      Array.from(needed.keys()).map(async (ref) => {
        const resolved = await resolveProfileImageSrc(ref, 'small', profileImageFetch as any);
        if (resolved) imageCacheRef.current.set(ref, resolved);
      }),
    ).then(() => {
      if (!cancelled) setResolvedImages(new Map(imageCacheRef.current));
    });

    return () => {
      cancelled = true;
    };
  }, [admin, participants]);

  const avatarImage = (person: any): string | undefined => {
    const ref = typeof person?.image === 'string' ? person.image.trim() : '';
    return ref ? resolvedImages.get(ref) : undefined;
  };

  return (
    <div className="min-h-full text-[#1A3A4A] px-4 py-6 md:px-8 pb-12">
      <div className="mb-5 max-w-6xl mx-auto">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-md border border-[#E5E2DB] bg-white px-3 py-2 text-xs font-semibold text-[#1A3A4A] hover:bg-[#faf9f6]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to seminars
        </button>
      </div>

      <div className="max-w-6xl mx-auto grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="rounded-2xl border border-[#E5E2DB] bg-white overflow-hidden shadow-sm">
          <div className="relative h-56 w-full bg-gradient-to-br from-[#234C6A] to-slate-900 sm:h-72 flex items-center justify-center">
            {seminar?.image ? (
              <img
                src={seminar.image}
                alt={seminar?.name || 'Seminar cover'}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <span className="text-5xl font-serif font-semibold text-white/90">
                {(seminar?.name || 'S').slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
          <div className="p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A7A72]">
              Seminar details
            </p>
            <h1 className="mt-2 font-serif text-[1.65rem] leading-tight text-[#1A3A4A]">
              {seminar?.name || 'Seminar'}
            </h1>
            {recurrenceLabelOf(seminar) && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#E8EEF4] px-3 py-1 text-[12px] font-medium text-[#234C6A]">
                <Repeat className="h-3.5 w-3.5" aria-hidden />
                Repeats {recurrenceLabelOf(seminar)!.toLowerCase()}
              </span>
            )}

            <div className="mt-4 rounded-xl border border-[#E5E2DB] bg-[#F5F3EF] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A7A72]">
                Description
              </p>
              <p className="mt-1 text-sm text-[#5c5c56] whitespace-pre-wrap">
                {seminar?.description || 'No description provided.'}
              </p>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2 text-[12px] text-slate-700">
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E2DB] bg-[#F5F3EF] px-3 py-2">
                <CalendarDays className="h-4 w-4 text-[#234C6A]" aria-hidden />
                <span>
                  {fmtDate12h(seminar?.start)}
                </span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E2DB] bg-[#F5F3EF] px-3 py-2">
                <Clock className="h-4 w-4 text-[#234C6A]" aria-hidden />
                <span>{seminar?.duration != null ? `${seminar.duration} min` : '—'}</span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E2DB] bg-[#F5F3EF] px-3 py-2">
                <MapPin className="h-4 w-4 text-[#234C6A]" aria-hidden />
                <span>Online · WisdomLinked</span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E2DB] bg-[#F5F3EF] px-3 py-2">
                <span className="text-[#234C6A] font-semibold">$</span>
                <span>{seminar?.price != null ? seminar.price : '—'}</span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E2DB] bg-[#F5F3EF] px-3 py-2">
                <Users className="h-4 w-4 text-[#234C6A]" aria-hidden />
                <span>
                  {isHost
                    ? seminarEnrollmentLabel(enrolledCount, waitingCount, maxAttendees)
                    : seminarCapacityLabel(enrolledCount, maxAttendees)}
                </span>
              </div>
              {isHost ? (
                <>
                  <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E2DB] bg-[#F5F3EF] px-3 py-2 sm:col-span-2">
                    <span className="font-semibold text-[#1A3A4A]">Status:</span>
                    <span className="capitalize">{seminar?.status || '—'}</span>
                    {isPast ? (
                      <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-700">
                        Past
                      </span>
                    ) : (
                      <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-800">
                        Upcoming / live window
                      </span>
                    )}
                  </div>
                  {seminar?.end ? (
                    <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E2DB] bg-[#F5F3EF] px-3 py-2 sm:col-span-2">
                      <span className="font-semibold text-[#1A3A4A]">Ends:</span>
                      <span>{fmtDate12h(seminar.end)}</span>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>

            {(keywords.length > 0 || services.length > 0) && (
              <div className="mt-5 space-y-3">
                {keywords.length > 0 ? (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A7A72]">
                      Majors / keywords
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {keywords.map((k) => (
                        <span
                          key={k}
                          className="rounded-full bg-[#E8EEF4] px-2.5 py-1 text-[11px] font-medium text-[#234C6A]"
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {services.length > 0 ? (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A7A72]">
                      Services
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {services.map((k) => (
                        <span
                          key={k}
                          className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700"
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            <div className="mt-6 border-t border-[#E5E2DB] pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A7A72]">
                Host
              </p>
              {admin ? (
                <div className="mt-2 flex items-center gap-3">
                  <Avatar username={admin.username} isOnline={false} image={avatarImage(admin)} />
                  <div>
                    <div className="text-sm font-semibold text-[#1A3A4A]">{admin.username}</div>
                    {admin.email ? (
                      <div className="text-xs text-[#7A7A72]">{admin.email}</div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[#7A7A72]">—</p>
              )}
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A7A72]">
                  Participants (
                  {maxAttendees != null
                    ? `${enrolledCount}/${Math.max(0, Math.trunc(maxAttendees))}`
                    : enrolledCount}
                  )
                </p>
                {participants.length > 1 ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-[#234C6A] hover:underline"
                    onClick={() => setShowParticipants(true)}
                  >
                    View all
                  </button>
                ) : null}
              </div>
              {participants.length > 1 ? (
                <div className="mt-2 flex -space-x-2">
                  {participants.slice(1, 6).map((p: any, idx: number) => (
                    <div key={p._id || idx} className="ring-2 ring-white rounded-full">
                      <Avatar username={p.username} isOnline={false} image={avatarImage(p)} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-[#7A7A72]">No participants yet.</p>
              )}
            </div>

            <GroupParticipantsDialog
              isDialogOpen={showParticipants}
              closeDialogHandler={() => setShowParticipants(false)}
              groupDetails={{
                groupName: seminar?.name,
                participants,
                admin: admin || participants[0],
                type: seminar?.type,
              }}
              currentUserId={userDetails?._id}
              currentUserRole={userDetails?.role}
              resolvedImages={resolvedImages}
            />
          </div>
        </section>

        <aside className="rounded-2xl border border-[#E5E2DB] bg-white p-5 shadow-sm h-fit">
          {isHost ? (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A7A72]">
                Your seminar
              </p>
              <p className="mt-2 text-sm text-[#5c5c56]">
                {isPast
                  ? 'This seminar has already finished, so its details can no longer be edited.'
                  : 'Update schedule, pricing, or description anytime before the session.'}
              </p>
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onEdit}
                  disabled={isPast}
                  title={isPast ? 'This seminar has already finished and can no longer be edited.' : undefined}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[#234C6A] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100"
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                  Edit seminar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Delete
                </button>
              </div>
              {seminar?._id ? (
                <button
                  type="button"
                  onClick={enterSeminarChat}
                  className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-[#234C6A] bg-white px-4 py-2.5 text-sm font-semibold text-[#234C6A] hover:bg-[#F5F3EF]"
                >
                  <MessageSquare className="h-4 w-4" aria-hidden />
                  Enter seminar chat
                </button>
              ) : null}
              {confirmDelete ? (
                hasEnrolledStudents ? (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
                    <p className="text-xs text-amber-800">
                      You cannot delete this seminar right now since students are
                      already enrolled in it. If you still want to delete it,
                      please contact admin.
                    </p>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Close
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-3">
                    <p className="text-xs text-rose-700">
                      {isRecurring
                        ? 'This is a recurring seminar. Choose what to delete — it will be removed from everyone’s calendars. This cannot be undone.'
                        : 'Delete this seminar? It will be removed from everyone’s calendars. This cannot be undone.'}
                    </p>
                    {isRecurring ? (
                      <div className="mt-3 space-y-2">
                        <button
                          type="button"
                          onClick={() => onDelete('occurrence')}
                          className="w-full rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
                        >
                          Delete only this session
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete('series')}
                          className="w-full rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
                        >
                          Delete all upcoming sessions
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(false)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onDelete('series')}
                          className="flex-1 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
                        >
                          Yes, delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(false)}
                          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )
              ) : null}
              {seminar?._id ? <SeatRequestsPanel seminarId={String(seminar._id)} /> : null}
            </>
          ) : (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A7A72]">
                Overview
              </p>
              <p className="mt-2 text-sm text-[#5c5c56]">
                You’re viewing this seminar as an expert. Registration and payment run through the
                student seminar experience.
              </p>
              <div className="mt-4 rounded-lg border border-[#E5E2DB] bg-[#F5F3EF] px-3 py-2 text-xs text-[#1A3A4A]">
                <div className="flex justify-between py-1">
                  <span className="text-[#7A7A72]">Price</span>
                  <span className="font-semibold">
                    {seminar?.price != null ? `$${seminar.price}` : '—'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-t border-[#E5E2DB]">
                  <span className="text-[#7A7A72]">Duration</span>
                  <span className="font-semibold">
                    {seminar?.duration != null ? `${seminar.duration} min` : '—'}
                  </span>
                </div>
              </div>
              {seminar?._id ? (
                <button
                  type="button"
                  onClick={enterSeminarChat}
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-[#234C6A] bg-white px-4 py-2.5 text-sm font-semibold text-[#234C6A] hover:bg-[#F5F3EF]"
                >
                  <MessageSquare className="h-4 w-4" aria-hidden />
                  Enter seminar chat
                </button>
              ) : null}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

export default function ExpertSeminarHub() {
  const dispatch = useDispatch();
  const { auth: { userDetails } } = useAppSelector((s) => s);
  const me = userDetails?._id;

  const [screen, setScreen] = useState<HubScreen>('list');
  const [detailSeminar, setDetailSeminar] = useState<any | null>(null);
  const [editPayload, setEditPayload] = useState<ReturnType<typeof mapGroupChatToExpertSeminar> | null>(
    null,
  );

  const [waitingBySeminar, setWaitingBySeminar] = useState<Record<string, number>>({});
  useEffect(() => {
    let active = true;
    (async () => {
      const res: any = await getSeminarSeatRequests();
      if (!active) return;
      const list: any[] = Array.isArray(res?.result) ? res.result : [];
      const counts: Record<string, number> = {};
      for (const r of list) {
        const sid = getRefId(r?.groupChat);
        if (sid) counts[sid] = (counts[sid] || 0) + 1;
      }
      setWaitingBySeminar(counts);
    })();
    return () => {
      active = false;
    };
  }, [userDetails?.groupChats]);
  const waitingFor = (s: any) => waitingBySeminar[String(s?._id) || getRefId(s)] || 0;

  const allSeminars = useMemo(() => {
    const chats = (userDetails?.groupChats || []).filter(
      (g: any) => g && g.type === 'seminar',
    );
    return [...chats].sort((a: any, b: any) => {
      const ta = a?.start ? new Date(a.start).getTime() : 0;
      const tb = b?.start ? new Date(b.start).getTime() : 0;
      return tb - ta;
    });
  }, [userDetails?.groupChats]);

  // Drafts the host saved earlier but hasn't published — surfaced separately so
  // they can be resumed; everything else shows in the main "Your seminars" list.
  const myDrafts = useMemo(
    () => allSeminars.filter((g: any) => g.status === 'draft' && getRefId(g.admin) === String(me)),
    [allSeminars, me],
  );
  const mySeminars = useMemo(
    () => groupSeminarSeries(allSeminars.filter((g: any) => g.status !== 'draft')),
    [allSeminars],
  );

  const resumeDraft = (s: any) => {
    setEditPayload(mapGroupChatToExpertSeminar(s));
    setScreen('edit');
  };

  const enterSeminarChat = (s: any) => {
    if (!s?._id) return;
    dispatch(
      setChosenGroupChatDetails({ ...s, groupId: s._id, groupName: s.name } as any),
    );
    window.dispatchEvent(new Event('wl-open-chat-nav'));
  };

  const handleAfterSave = async (status: 'active' | 'draft') => {
    await (dispatch as any)(updateMe());
    // Saving a draft keeps the host on the editor to continue working; only a
    // publish returns them to the seminar list.
    if (status === 'draft') return;
    setScreen('list');
    setEditPayload(null);
  };

  const handleDeleteSeminar = async (s: any, scope: 'occurrence' | 'series') => {
    const groupId = s?._id ? String(s._id) : getRefId(s);
    if (!groupId) return;
    SetLoadingStatus(true);
    const res = await deleteGroup({ groupChatId: groupId, scope });
    SetLoadingStatus(false);
    if (res !== false) {
      dispatch(
        showSuccessAlert(
          scope === 'occurrence' ? 'Seminar session deleted' : 'Seminar deleted',
        ),
      );
      await (dispatch as any)(updateMe());
      setDetailSeminar(null);
      setScreen('list');
    }
  };

  const adminIdOf = (s: any) => getRefId(s?.admin);

  const openDetail = (s: any) => {
    setDetailSeminar(s);
    setScreen('detail');
  };

  if (screen === 'create') {
    return (
      <ExpertSeminar
        key="hub-create"
        onCancel={() => setScreen('list')}
        onAfterSeminarSave={handleAfterSave}
      />
    );
  }

  if (screen === 'edit' && editPayload) {
    return (
      <ExpertSeminar
        key={`hub-edit-${editPayload.groupId}`}
        selectedSeminar={editPayload}
        onCancel={() => {
          setEditPayload(null);
          setScreen('detail');
        }}
        onAfterSeminarSave={handleAfterSave}
      />
    );
  }

  if (screen === 'detail' && detailSeminar) {
    const isHost = me != null && adminIdOf(detailSeminar) === String(me);
    return (
      <SeminarDetailPane
        seminar={detailSeminar}
        isHost={isHost}
        waitingCount={waitingFor(detailSeminar)}
        onBack={() => {
          setDetailSeminar(null);
          setScreen('list');
        }}
        onEdit={() => {
          setEditPayload(mapGroupChatToExpertSeminar(detailSeminar));
          setScreen('edit');
        }}
        onDelete={(scope) => handleDeleteSeminar(detailSeminar, scope)}
      />
    );
  }

  return (
    <div className="min-h-full text-[#1A3A4A] px-4 py-6 md:px-8 pb-12">
      <header className="max-w-6xl mx-auto flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Seminars</h1>
          <p className="mt-1 text-sm text-slate-600 max-w-xl">
            Discover sessions hosted by other experts, then manage your own seminars below.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setScreen('create')}
          className="inline-flex items-center justify-center gap-2 shrink-0 rounded-xl bg-[#234C6A] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-110"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Create seminar
        </button>
      </header>

      <div className="max-w-6xl mx-auto space-y-10">
        {myDrafts.length > 0 ? (
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-1">
              Drafts <span className="text-slate-400">({myDrafts.length})</span>
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              Unfinished seminars saved earlier — select one to continue editing and publish.
            </p>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {myDrafts.map((s: any) => (
                <SeminarCard
                  key={s._id || getRefId(s)}
                  seminar={s}
                  onClick={() => resumeDraft(s)}
                  badge="Draft"
                />
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Your seminars</h2>
          <p className="text-sm text-slate-600 mb-4">
            Current and past seminars — select for full details. Hosted seminars include
            edit support.
          </p>
          {mySeminars.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#E5E2DB] bg-white/60 px-6 py-10 text-center text-sm text-slate-600">
              You don’t have any seminars yet. Use <strong>Create seminar</strong> to add one.
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {mySeminars.map(({ seminar: s, occurrenceCount }) => {
                const host = adminIdOf(s) === String(me);
                return (
                  <SeminarCard
                    key={s._id || getRefId(s)}
                    seminar={s}
                    onClick={() => openDetail(s)}
                    onEnterChat={() => enterSeminarChat(s)}
                    badge={host ? 'Hosted' : 'Joined'}
                    recurrenceLabel={recurrenceLabelOf(s)}
                    occurrenceCount={occurrenceCount}
                    waitingCount={waitingFor(s)}
                    showEnrollment={host}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
