/**
 * Client-side discovery helpers for the Student Dashboard "What's New" grid.
 *
 * TODO(backend): No `isTestAccount` (or equivalent) flag exists on User yet.
 * Until one ships, we only filter obvious non-public roles/statuses. Add a
 * durable flag and filter it here when available.
 */

export type DiscoveryExpert = {
  id: string;
  name: string;
  title: string;
  institution: string;
  field: string;
  image?: string | null;
  isNew?: boolean;
  tags: string[];
  reason?: string;
};

export type DiscoverySeminar = {
  id: string;
  title: string;
  expertName: string;
  expertImage?: string | null;
  startAt: number;
  seatsLeft: number | null;
  price: number;
};

export type StudentTodo = {
  id: string;
  kind: 'profile' | 'rate' | 'payment' | 'messages';
  label: string;
  icon: 'user' | 'star' | 'credit-card' | 'message';
};

function entryLabel(item: unknown): string {
  if (typeof item === 'string') return item.trim();
  if (item && typeof item === 'object') {
    const doc = item as { value?: string; label?: string; name?: string };
    return String(doc.value ?? doc.label ?? doc.name ?? '').trim();
  }
  return '';
}

function coerceString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') {
    const doc = value as { label?: string; value?: string; name?: string };
    return String(doc.label ?? doc.value ?? doc.name ?? '').trim();
  }
  return '';
}

function keywordLabels(expertOrUser: any): string[] {
  const list = Array.isArray(expertOrUser?.keywords) ? expertOrUser.keywords : [];
  const custom = Array.isArray(expertOrUser?.customKeywords) ? expertOrUser.customKeywords : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const k of [...list, ...custom]) {
    const v = entryLabel(k);
    const key = v.toLowerCase();
    if (v && !seen.has(key)) {
      seen.add(key);
      out.push(v);
    }
  }
  return out;
}

/** Drop admins and non-active accounts from student-facing lists. */
export function filterPublicExperts(list: any[]): any[] {
  return (Array.isArray(list) ? list : []).filter((e) => {
    const role = String(e?.role || '').toLowerCase();
    if (role === 'admin') return false;
    const status = String(e?.status || 'active').toLowerCase();
    if (status && status !== 'active') return false;
    // TODO(backend): filter isTestAccount / demo flag when the User model exposes one.
    const email = String(e?.email || '').toLowerCase();
    if (email.endsWith('.invalid') || email.includes('+test@')) return false;
    return true;
  });
}

function participantIds(seminar: any): Set<string> {
  const ids = new Set<string>();
  for (const p of Array.isArray(seminar?.participants) ? seminar.participants : []) {
    if (p == null) continue;
    if (typeof p === 'string' || typeof p === 'number') ids.add(String(p));
    else if (p._id != null) ids.add(String(p._id));
  }
  return ids;
}

/**
 * Future, open seminars the student is not already enrolled in, soonest first.
 * Uses existing filter results — TODO: dedicated getUpcomingSeminars endpoint.
 */
export function getUpcomingSeminarsForStudent(
  seminars: any[],
  studentId: string | null | undefined,
  now = Date.now(),
): DiscoverySeminar[] {
  const me = studentId ? String(studentId) : '';
  const mapped: DiscoverySeminar[] = [];

  for (const g of Array.isArray(seminars) ? seminars : []) {
    if (!g) continue;
    if (String(g.status || '').toLowerCase() === 'draft') continue;
    const startMs = g.start ? new Date(g.start).getTime() : NaN;
    if (!Number.isFinite(startMs) || startMs <= now) continue;

    const parts = participantIds(g);
    if (me && parts.has(me)) continue;

    const participantCount = Array.isArray(g.participants) ? g.participants.length : 0;
    const enrolled = Math.max(0, participantCount - 1);
    const maxAttendees = typeof g.maxAttendees === 'number' ? g.maxAttendees : null;
    const isFull = maxAttendees != null && (maxAttendees <= 0 || enrolled >= maxAttendees);
    // Open registration: not full. (Seat-request overflow is still "open" for browse,
    // but Register CTA on the card routes to Seminars where waitlist is handled.)
    if (isFull) continue;

    const seatsLeft =
      maxAttendees == null ? null : Math.max(0, maxAttendees - enrolled);

    const host = g.admin;
    mapped.push({
      id: String(g._id),
      title: g.name || 'Seminar',
      expertName: host?.username || host?.email || 'WisdomLinked expert',
      expertImage: host?.image ?? null,
      startAt: startMs,
      seatsLeft,
      price: typeof g.price === 'number' ? g.price : 0,
    });
  }

  return mapped.sort((a, b) => a.startAt - b.startAt).slice(0, 8);
}

export function studentHasMatchSignals(user: any): boolean {
  if (!user) return false;
  if (keywordLabels(user).length > 0) return true;
  if (coerceString(user.degreeSought)) return true;
  if (coerceString(user.targetUniversities)) return true;
  if (coerceString(user.country)) return true;
  if (coerceString(user.currentUniversity)) return true;
  const services = Array.isArray(user.services) ? user.services : [];
  return services.some((s: unknown) => Boolean(entryLabel(s)));
}

function scoreExpert(expert: any, user: any): { score: number; reason: string } {
  const studentKeys = keywordLabels(user).map((k) => k.toLowerCase());
  const expertKeys = keywordLabels(expert);
  const expertKeysLower = expertKeys.map((k) => k.toLowerCase());

  let score = 0;
  let reason = '';

  for (const sk of studentKeys) {
    const hit = expertKeys.find((ek, i) => expertKeysLower[i] === sk || expertKeysLower[i].includes(sk) || sk.includes(expertKeysLower[i]));
    if (hit) {
      score += 3;
      if (!reason) reason = `Matches your interest in ${hit}`;
    }
  }

  const studentCountry = coerceString(user?.country).toLowerCase();
  const expertCountry = coerceString(expert?.country).toLowerCase();
  if (studentCountry && expertCountry && (expertCountry.includes(studentCountry) || studentCountry.includes(expertCountry))) {
    score += 2;
    if (!reason) reason = `Familiar with ${coerceString(expert.country) || 'your region'}`;
  }

  const targets = coerceString(user?.targetUniversities).toLowerCase();
  const hay = `${expert?.title || ''} ${expert?.description || ''} ${expert?.specialNote || ''}`.toLowerCase();
  if (targets) {
    for (const part of targets.split(/[,;]/).map((p) => p.trim()).filter(Boolean)) {
      if (part.length >= 3 && hay.includes(part.toLowerCase())) {
        score += 2;
        if (!reason) reason = `Relevant to ${part}`;
        break;
      }
    }
  }

  const degree = coerceString(user?.degreeSought).toLowerCase();
  if (degree && hay.includes(degree)) {
    score += 1;
    if (!reason) reason = `Supports ${coerceString(user.degreeSought)} applicants`;
  }

  if (!reason && expertKeys[0]) reason = `Expertise in ${expertKeys[0]}`;
  if (!reason) reason = 'Recommended based on your profile';

  return { score, reason };
}

/**
 * Rank experts for the student. Returns needsProfile when match signals are missing.
 * TODO: dedicated getRecommendedExperts endpoint when ranking moves server-side.
 */
export function getRecommendedExperts(
  experts: any[],
  user: any,
  excludeIds: Set<string> | string[] = [],
  limit = 5,
): { needsProfile: boolean; items: Array<any & { reason: string }> } {
  if (!studentHasMatchSignals(user)) {
    return { needsProfile: true, items: [] };
  }
  const exclude = excludeIds instanceof Set ? excludeIds : new Set(excludeIds.map(String));
  const ranked = filterPublicExperts(experts)
    .filter((e) => !exclude.has(String(e._id)))
    .map((e) => {
      const { score, reason } = scoreExpert(e, user);
      return { expert: e, score, reason };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    needsProfile: false,
    items: ranked.map((r) => ({ ...r.expert, reason: r.reason })),
  };
}

const PROFILE_FIELDS: Array<(u: any) => boolean> = [
  (u) => Boolean(String(u?.username || '').trim()),
  (u) => Boolean(u?.image),
  (u) => keywordLabels(u).length > 0,
  (u) => (Array.isArray(u?.services) ? u.services : []).some((s: unknown) => Boolean(entryLabel(s))),
  (u) => Boolean(coerceString(u?.degreeSought)),
  (u) => Boolean(coerceString(u?.country) || coerceString(u?.targetUniversities)),
];

export function profileCompletionPercent(user: any): number {
  if (!user) return 0;
  const done = PROFILE_FIELDS.filter((fn) => fn(user)).length;
  return Math.round((done / PROFILE_FIELDS.length) * 100);
}

export type TodoContext = {
  user: any;
  unreadCount: number;
  /** Awaiting-payment seat/session labels */
  paymentItems: Array<{ id: string; label: string }>;
  /** Recently ended sessions awaiting a rating */
  rateItems: Array<{ id: string; expertName: string; expertId?: string }>;
};

export function getStudentTodos(ctx: TodoContext): StudentTodo[] {
  if (!ctx.user) return [];
  const todos: StudentTodo[] = [];
  const pct = profileCompletionPercent(ctx.user);
  if (pct < 100) {
    todos.push({
      id: 'profile',
      kind: 'profile',
      label: `Complete your profile (${pct}%)`,
      icon: 'user',
    });
  }
  for (const r of ctx.rateItems.slice(0, 2)) {
    todos.push({
      id: `rate-${r.id}`,
      kind: 'rate',
      label: `Rate your session with ${r.expertName}`,
      icon: 'star',
    });
  }
  for (const p of ctx.paymentItems.slice(0, 2)) {
    todos.push({
      id: `pay-${p.id}`,
      kind: 'payment',
      label: `Complete payment for ${p.label}`,
      icon: 'credit-card',
    });
  }
  if (ctx.unreadCount > 0) {
    const n = ctx.unreadCount > 99 ? '99+' : String(ctx.unreadCount);
    todos.push({
      id: 'messages',
      kind: 'messages',
      label: `${n} unread message${ctx.unreadCount === 1 ? '' : 's'}`,
      icon: 'message',
    });
  }
  return todos;
}

/** Ended confirmed 1:1s in the last `withinMs` that can surface a rate todo (best-effort). */
export function findRecentRateCandidates(
  user: any,
  withinMs = 14 * 24 * 60 * 60 * 1000,
  now = Date.now(),
): Array<{ id: string; expertName: string; expertId?: string }> {
  const me = String(user?._id || '');
  const out: Array<{ id: string; expertName: string; expertId?: string }> = [];
  const seen = new Set<string>();

  const consider = (row: any, peer: any) => {
    const endMs = row?.end ? new Date(row.end).getTime() : NaN;
    if (!Number.isFinite(endMs) || endMs > now || now - endMs > withinMs) return;
    const status = String(row?.status || '').toLowerCase();
    if (status && !['accepted', 'confirmed', 'booked', 'completed', 'ended'].includes(status)) {
      // Legacy rows sometimes omit status; allow if end is past.
      if (status === 'pending' || status === 'cancelled' || status === 'canceled') return;
    }
    const id = String(row?._id || '');
    if (!id || seen.has(id)) return;
    const expertName = peer?.username || peer?.email || 'your expert';
    const expertId = peer?._id != null ? String(peer._id) : undefined;
    if (expertId && expertId === me) return;
    seen.add(id);
    out.push({ id, expertName, expertId });
  };

  for (const g of Array.isArray(user?.groupChats) ? user.groupChats : []) {
    if (String(g?.type || '').toLowerCase() === 'seminar') continue;
    const peers = Array.isArray(g?.participants) ? g.participants : [];
    const peer = peers.find((p: any) => String(p?._id) !== me) || g?.admin;
    consider(g, peer);
  }
  for (const ev of Array.isArray(user?.events) ? user.events : []) {
    const peer = ev?.expert?._id ? ev.expert : ev?.experts?.[0] || ev?.customer;
    consider(ev, peer);
  }

  return out.slice(0, 3);
}
