import React, { useEffect, useMemo, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import { Search, UserPlus, Loader2, Plus, X } from 'lucide-react';
import { doFilterCustomers, inviteToSeminar, profileImageFetch } from '../../../../api/api';
import { notify } from '../../../../utils/notify';
import { resolveProfileImageSrc } from '../../../../utils/profileImage';
import Avatar from '../../../../components/Avatar';

type Student = { id: string; username: string; email: string; image?: string };

export type InviteOutcome =
    | 'invited'
    | 'enrolled'
    | 'already_enrolled'
    | 'already_invited'
    | 'not_a_student'
    | 'no_account'
    | 'bad_email'
    | 'failed';

interface Props {
    open: boolean;
    onClose: () => void;
    groupDetails: any;
    theme?: 'dark' | 'light';
}

const OUTCOME_LABEL: Record<InviteOutcome, string> = {
    invited: 'invited',
    enrolled: 'added',
    already_enrolled: 'already in this seminar',
    already_invited: 'already invited',
    not_a_student: 'not a student account',
    no_account: 'has no WisdomLinked account — ask them to sign up first',
    bad_email: 'is not a valid email address',
    failed: 'could not be invited',
};

/** "3 invited · 1 already in this seminar" — grouped so a bulk result reads in one line. */
export const summarizeOutcomes = (results: Array<{ outcome: InviteOutcome }>): string => {
    const counts = new Map<InviteOutcome, number>();
    results.forEach((r) => counts.set(r.outcome, (counts.get(r.outcome) || 0) + 1));
    return Array.from(counts.entries())
        .map(([outcome, n]) => `${n} ${OUTCOME_LABEL[outcome] || outcome}`)
        .join(' · ');
};

export default function InviteToSeminarDialog({ open, onClose, groupDetails, theme = 'light' }: Props) {
    const [students, setStudents] = useState<Student[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [confirmingFree, setConfirmingFree] = useState(false);
    const [emailDraft, setEmailDraft] = useState('');
    const [emails, setEmails] = useState<string[]>([]);
    const [results, setResults] = useState<Array<{ name: string; outcome: InviteOutcome }> | null>(null);

    const seminarId = groupDetails?.groupId || groupDetails?._id;
    const price = Number(groupDetails?.price);
    const isFree = Number.isFinite(price) && price <= 0;
    const emailPlaceholder = isFree ? 'Add by email address' : 'Invite by email address';

    const enrolledIds = useMemo(() => {
        const ids = new Set<string>();
        (groupDetails?.participants || []).forEach((p: any) => {
            const id = String(p?._id ?? p?.id ?? p ?? '');
            if (id) ids.add(id);
        });
        const admin = groupDetails?.admin;
        const adminId = String(admin?._id ?? admin ?? '');
        if (adminId) ids.add(adminId);
        return ids;
    }, [groupDetails]);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setSelected(new Set());
        setSearch('');
        setResults(null);
        setConfirmingFree(false);
        setEmailDraft('');
        setEmails([]);
        setLoading(true);
        (async () => {
            try {
                const res: any = await doFilterCustomers({
                    username: '',
                    keywords: [],
                    services: [],
                    sortBy: 'Name in ASC',
                });
                if (cancelled) return;
                const rows: Student[] = (Array.isArray(res?.result) ? res.result : [])
                    .map((c: any) => ({
                        id: String(c?._id ?? c?.id ?? ''),
                        username: c?.username || c?.email || 'Student',
                        email: c?.email || '',
                        image: c?.image,
                    }))
                    .filter((s: Student) => s.id && !enrolledIds.has(s.id));
                const withPhotos = await Promise.all(
                    rows.map(async (s) => {
                        const resolved = await resolveProfileImageSrc(
                            s.image,
                            'small',
                            profileImageFetch as any,
                        );
                        return { ...s, image: resolved || undefined };
                    }),
                );
                if (cancelled) return;
                setStudents(withPhotos);
            } catch {
                if (!cancelled) setStudents([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, enrolledIds]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return students;
        return students.filter(
            (s) => s.username.toLowerCase().includes(q) || s.email.toLowerCase().includes(q),
        );
    }, [students, search]);

    const showDropdown = search.trim().length > 0;

    const toggle = (id: string) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const allVisibleSelected = visible.length > 0 && visible.every((s) => selected.has(s.id));
    const toggleAllVisible = () =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (allVisibleSelected) visible.forEach((s) => next.delete(s.id));
            else visible.forEach((s) => next.add(s.id));
            return next;
        });

    const addEmail = () => {
        const value = emailDraft.trim().toLowerCase();
        if (!value) return;
        setEmails((prev) => (prev.includes(value) ? prev : [...prev, value]));
        setEmailDraft('');
    };

    const totalPicked = selected.size + emails.length;

    const send = async () => {
        setSubmitting(true);
        setConfirmingFree(false);
        try {
            const res: any = await inviteToSeminar({
                groupChatId: String(seminarId),
                followerIds: Array.from(selected),
                emails,
            });
            if (res === false) return;
            if (!res?.success || !Array.isArray(res?.results)) {
                notify.error(typeof res === 'string' ? res : 'Could not send the invitations.');
                return;
            }
            setResults(res.results);
            const done = res.results.filter((r: any) => r.outcome === 'invited' || r.outcome === 'enrolled').length;
            if (done) {
                notify.success(res.free ? `${done} added to this seminar.` : `${done} invited.`);
            }
            setStudents((prev) => prev.filter((s) => !selected.has(s.id)));
            setSelected(new Set());
            setEmails([]);
        } finally {
            setSubmitting(false);
        }
    };

    const submit = () => {
        if (!seminarId || totalPicked === 0) {
            notify.error('Pick a student or enter an email address.');
            return;
        }
        if (isFree) {
            setConfirmingFree(true);
            return;
        }
        void send();
    };

    const isLight = theme === 'light';
    const panel = isLight ? 'bg-white text-slate-900' : 'bg-[#141414] text-white';
    const rowHover = isLight ? 'hover:bg-slate-50' : 'hover:bg-white/10';
    const dropdownBg = isLight ? 'bg-white border-slate-200' : 'bg-[#1c1c1c] border-white/10';

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <div className={`${panel} p-5`}>
                <div className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-[#234C6A]" aria-hidden />
                    <h2 className="text-sm font-semibold">
                        {isFree ? 'Add to this seminar' : 'Invite to this seminar'}
                    </h2>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                    {isFree
                        ? 'This seminar is free, so everyone you pick joins it straight away.'
                        : 'They get an invitation to accept and pay. Nothing is charged until they do.'}
                </p>

                {results ? (
                    <div className="mt-4">
                        <p className="text-sm font-medium">{summarizeOutcomes(results)}</p>
                        <ul className="mt-2 max-h-56 overflow-y-auto text-xs text-slate-500">
                            {results.map((r, i) => (
                                <li key={`${r.name}-${i}`} className="py-0.5">
                                    {r.name} — {OUTCOME_LABEL[r.outcome] || r.outcome}
                                </li>
                            ))}
                        </ul>
                        <button
                            type="button"
                            onClick={onClose}
                            className="mt-4 w-full rounded-lg bg-[#234C6A] px-4 py-2 text-sm font-semibold text-white"
                        >
                            Done
                        </button>
                    </div>
                ) : confirmingFree ? (
                    <div className="mt-4">
                        <p className="text-sm">
                            This adds <strong>{totalPicked}</strong> {totalPicked === 1 ? 'person' : 'people'} to
                            the seminar and its chat immediately. They are not asked first.
                        </p>
                        <div className="mt-4 flex gap-2">
                            <button
                                type="button"
                                onClick={() => setConfirmingFree(false)}
                                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold"
                            >
                                Back
                            </button>
                            <button
                                type="button"
                                onClick={() => void send()}
                                className="flex-1 rounded-lg bg-[#234C6A] px-4 py-2 text-sm font-semibold text-white"
                            >
                                Add them
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5">
                            <input
                                type="email"
                                value={emailDraft}
                                onChange={(e) => setEmailDraft(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addEmail();
                                    }
                                }}
                                placeholder={emailPlaceholder}
                                aria-label={emailPlaceholder}
                                className="flex-1 bg-transparent text-xs outline-none"
                            />
                            <button
                                type="button"
                                onClick={addEmail}
                                disabled={!emailDraft.trim()}
                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-[#234C6A] disabled:opacity-40"
                            >
                                <Plus className="h-3 w-3" aria-hidden />
                                Add
                            </button>
                        </div>
                        {emails.length ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {emails.map((address) => (
                                    <span
                                        key={address}
                                        className="inline-flex items-center gap-1 rounded-full bg-[#E8EEF4] px-2 py-0.5 text-[11px] text-[#234C6A]"
                                    >
                                        {address}
                                        <button
                                            type="button"
                                            aria-label={`Remove ${address}`}
                                            onClick={() => setEmails((prev) => prev.filter((e) => e !== address))}
                                        >
                                            <X className="h-3 w-3" aria-hidden />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        ) : null}
                        <p className="mt-2 text-[11px] text-slate-400">
                            {isFree
                                ? 'They need a WisdomLinked student account to be added.'
                                : 'They need a WisdomLinked student account — invitations are paid for and joined from their dashboard, so there is nowhere to send one otherwise.'}
                        </p>

                        <div className="relative mt-3">
                            <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5">
                                <Search className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search students by name"
                                    aria-label="Search students by name"
                                    className="flex-1 bg-transparent text-xs outline-none"
                                />
                            </div>
                            {showDropdown ? (
                                <div
                                    className={`absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border shadow-md ${dropdownBg}`}
                                    role="listbox"
                                    aria-label="Matching students"
                                >
                                    {loading ? (
                                        <p className="px-3 py-2 text-xs text-slate-400">Searching…</p>
                                    ) : visible.length === 0 ? (
                                        <p className="px-3 py-2 text-xs text-slate-400">
                                            No students match — try email above.
                                        </p>
                                    ) : (
                                        visible.slice(0, 40).map((s) => (
                                            <button
                                                key={s.id}
                                                type="button"
                                                role="option"
                                                aria-selected={selected.has(s.id)}
                                                onClick={() => toggle(s.id)}
                                                className={`flex w-full items-center gap-3 px-2 py-2 text-left ${rowHover}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    readOnly
                                                    checked={selected.has(s.id)}
                                                    className="h-4 w-4"
                                                    tabIndex={-1}
                                                />
                                                <Avatar username={s.username} image={s.image} size="small" />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-xs font-medium">{s.username}</span>
                                                    <span className="block truncate text-[11px] text-slate-400">{s.email}</span>
                                                </span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            ) : null}
                        </div>

                        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                            Or pick a student
                        </p>
                        {loading ? (
                            <p className="py-8 text-center text-xs text-slate-400">
                                <Loader2 className="mx-auto mb-1 h-4 w-4 animate-spin" aria-hidden />
                                Loading students…
                            </p>
                        ) : students.length === 0 ? (
                            <p className="py-8 text-center text-xs text-slate-400">
                                No students left to pick — use email above instead.
                            </p>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={toggleAllVisible}
                                    className="mt-3 text-xs font-semibold text-[#234C6A] underline underline-offset-2"
                                >
                                    {allVisibleSelected ? 'Clear selection' : `Select all (${visible.length})`}
                                </button>
                                <div className="mt-2 max-h-64 overflow-y-auto">
                                    {visible.map((s) => (
                                        <label
                                            key={s.id}
                                            className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 ${rowHover}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selected.has(s.id)}
                                                onChange={() => toggle(s.id)}
                                                className="h-4 w-4"
                                            />
                                            <Avatar username={s.username} image={s.image} size="small" />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-xs font-medium">{s.username}</span>
                                                <span className="block truncate text-[11px] text-slate-400">{s.email}</span>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </>
                        )}

                        <div className="mt-4 flex gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={submit}
                                disabled={submitting || totalPicked === 0}
                                className="flex-1 rounded-lg bg-[#234C6A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                            >
                                {submitting
                                    ? 'Sending…'
                                    : isFree
                                        ? `Add ${totalPicked || ''}`.trim()
                                        : `Invite ${totalPicked || ''}`.trim()}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </Dialog>
    );
}
