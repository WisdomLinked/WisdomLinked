import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  MapPin,
  User,
  Plus,
  Pencil,
} from 'lucide-react';
import { useDispatch } from 'react-redux';

import { useAppSelector } from '../../../store';
import { updateMe } from '../../../actions/authActions';
import { formatDateYYYY_MM_DD_h_m } from '../../../actions/common';
import { canonicalLabelsFromMixedServiceEntries } from '../../../constants/serviceOptions';
import Avatar from '../../../components/Avatar';
import GroupParticipantsDialog from '../Messenger/Messages/GroupParticipantsDialog';
import ExpertSeminar from './seminar';

type HubScreen = 'list' | 'create' | 'edit' | 'detail';

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
    start: g.start,
    end: g.end,
    duration: g.duration,
    price: g.price,
  };
}

function SeminarCard({
  seminar,
  onClick,
  badge,
}: {
  seminar: any;
  onClick: () => void;
  badge?: string;
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
  const n = Array.isArray(seminar?.participants) ? seminar.participants.length : 0;

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
        <div className="absolute inset-0 flex items-center justify-center text-white/90">
          <span className="text-3xl font-serif font-semibold opacity-90">
            {(seminar?.name || 'S').slice(0, 1).toUpperCase()}
          </span>
        </div>
        {badge ? (
          <div className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-0.5 text-[10px] font-medium text-white backdrop-blur">
            {badge}
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
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {n} enrolled
          </span>
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
        <div className="mt-auto pt-3 flex justify-end">
          <span className="text-xs font-semibold text-[#234C6A] group-hover:underline">
            View details
          </span>
        </div>
      </div>
    </article>
  );
}

function SeminarDetailPane({
  seminar,
  isHost,
  onBack,
  onEdit,
}: {
  seminar: any;
  isHost: boolean;
  onBack: () => void;
  onEdit: () => void;
}) {
  const { auth: { userDetails } } = useAppSelector((s) => s);
  const [showParticipants, setShowParticipants] = useState(false);
  const admin = seminar?.admin;
  const participants: any[] = Array.isArray(seminar?.participants) ? seminar.participants : [];
  const start = seminar?.start ? new Date(seminar.start) : null;
  const end = seminar?.end ? new Date(seminar.end) : null;
  const now = Date.now();
  const isPast = end ? end.getTime() < now : start ? start.getTime() < now : false;
  const keywords = labelsFromMixed(seminar?.keywords);
  const services = canonicalLabelsFromMixedServiceEntries(seminar?.services);

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
          <div className="h-56 w-full bg-gradient-to-br from-[#234C6A] to-slate-900 sm:h-72 flex items-center justify-center">
            <span className="text-5xl font-serif font-semibold text-white/90">
              {(seminar?.name || 'S').slice(0, 1).toUpperCase()}
            </span>
          </div>
          <div className="p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A7A72]">
              Seminar details
            </p>
            <h1 className="mt-2 font-serif text-[1.65rem] leading-tight text-[#1A3A4A]">
              {seminar?.name || 'Seminar'}
            </h1>

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
                  {seminar?.start ? formatDateYYYY_MM_DD_h_m(seminar.start) : '—'}
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
                      <span>{formatDateYYYY_MM_DD_h_m(seminar.end)}</span>
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
                  <Avatar username={admin.username} isOnline={false} image={admin.image} />
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
                  Participants ({Math.max(0, participants.length - 1)})
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
                      <Avatar username={p.username} isOnline={false} image={p.image} />
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
              }}
              currentUserId={userDetails?._id}
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
                Update schedule, pricing, or description anytime before the session.
              </p>
              <button
                type="button"
                onClick={onEdit}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#234C6A] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
              >
                <Pencil className="h-4 w-4" aria-hidden />
                Edit seminar
              </button>
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

  const mySeminars = useMemo(() => {
    const chats = (userDetails?.groupChats || []).filter(
      (g: any) => g && g.type === 'seminar',
    );
    return [...chats].sort((a: any, b: any) => {
      const ta = a?.start ? new Date(a.start).getTime() : 0;
      const tb = b?.start ? new Date(b.start).getTime() : 0;
      return tb - ta;
    });
  }, [userDetails?.groupChats]);

  const handleAfterSave = async () => {
    await (dispatch as any)(updateMe());
    setScreen('list');
    setEditPayload(null);
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
        onBack={() => {
          setDetailSeminar(null);
          setScreen('list');
        }}
        onEdit={() => {
          setEditPayload(mapGroupChatToExpertSeminar(detailSeminar));
          setScreen('edit');
        }}
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
              {mySeminars.map((s: any) => {
                const host = adminIdOf(s) === String(me);
                return (
                  <SeminarCard
                    key={s._id || getRefId(s)}
                    seminar={s}
                    onClick={() => openDetail(s)}
                    badge={host ? 'Hosted' : 'Joined'}
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
