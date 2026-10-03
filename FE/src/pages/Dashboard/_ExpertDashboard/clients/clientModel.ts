export type ClientStatus = 'upcoming' | 'pending' | 'new' | 'idle';
export type ClientScope = 'mine' | 'all';
export type ClientView = 'grid' | 'table';
export type ClientSort = 'next' | 'recent' | 'name' | 'sessions';

export interface ClientRow {
  id: string;
  name: string;
  /** Profile image key passed to profileImageFetch; null when the student has no photo. */
  image: string | null;
  school: string;
  goal: string;
  fields: string[];
  status: ClientStatus;
  sessionsCount: number;
  lastSessionAt: number | null;
  nextSessionAt: number | null;
  lastActivityAt: number | null;
  unread: number;
  /** Original user object, handed unchanged to the profile / chat / propose handlers. */
  raw: any;
}

export interface ClientFilters {
  query: string;
  status: ClientStatus | 'all';
  field: string;
  sortBy: ClientSort;
}

export const STATUS_LABEL: Record<ClientStatus, string> = {
  upcoming: 'Session booked',
  pending: 'Proposal sent',
  new: 'New client',
  idle: 'No session booked',
};

export const ALL_FIELDS = 'all';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const idOf = (ref: unknown): string => {
  if (!ref) return '';
  if (typeof ref === 'object') {
    const o = ref as { _id?: unknown; id?: unknown };
    return String(o._id ?? o.id ?? '');
  }
  return String(ref);
};

const ts = (v: unknown): number | null => {
  if (!v) return null;
  const n = new Date(v as string).getTime();
  return Number.isNaN(n) ? null : n;
};

const maxOf = (a: number | null, b: number | null) => (a == null ? b : b == null ? a : Math.max(a, b));
const minOf = (a: number | null, b: number | null) => (a == null ? b : b == null ? a : Math.min(a, b));

export function dedupeById<T>(list: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of list) {
    const id = idOf(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}

interface Relationship {
  user: any;
  sessionsCount: number;
  lastSessionAt: number | null;
  nextSessionAt: number | null;
  pending: boolean;
  lastActivityAt: number | null;
  rcChannelId: string | null;
}

function emptyRelationship(user: any): Relationship {
  return {
    user,
    sessionsCount: 0,
    lastSessionAt: null,
    nextSessionAt: null,
    pending: false,
    lastActivityAt: null,
    rcChannelId: null,
  };
}

/** Everything this expert has with each student: 1:1 sessions, legacy events and direct chats. */
export function collectRelationships(userDetails: any, now: number): Map<string, Relationship> {
  const me = idOf(userDetails);
  const out = new Map<string, Relationship>();
  const touch = (user: any): Relationship | null => {
    const id = idOf(user);
    if (!id || id === me) return null;
    let rel = out.get(id);
    if (!rel) {
      rel = emptyRelationship(typeof user === 'object' ? user : { _id: id });
      out.set(id, rel);
    } else if (typeof user === 'object' && user.username && !rel.user?.username) {
      rel.user = user;
    }
    return rel;
  };

  const addSession = (rel: Relationship, start: number | null, end: number | null, booked: boolean, activity: number | null) => {
    const startedAt = start != null && start <= now ? start : null;
    rel.lastActivityAt = maxOf(rel.lastActivityAt, maxOf(activity, startedAt));
    if (start == null) return;
    const ended = (end ?? start) < now;
    if (!booked) {
      if (!ended) rel.pending = true;
      return;
    }
    rel.sessionsCount += 1;
    if (ended) rel.lastSessionAt = maxOf(rel.lastSessionAt, start);
    else rel.nextSessionAt = minOf(rel.nextSessionAt, start);
  };

  for (const g of userDetails?.groupChats ?? []) {
    if (g?.type !== 'individual' || idOf(g.admin) !== me) continue;
    if (g.status !== 'active' && g.status !== 'pending') continue;
    const parts: any[] = Array.isArray(g.participants) ? g.participants : [];
    const student = parts.find((p) => idOf(p) && idOf(p) !== me) ?? (idOf(g.createdBy) !== me ? g.createdBy : null);
    const rel = touch(student);
    if (!rel) continue;
    addSession(rel, ts(g.start), ts(g.end), g.status === 'active', ts(g.updatedAt));
  }

  for (const ev of userDetails?.events ?? []) {
    if (idOf(ev?.expert) !== me) continue;
    if (ev.status !== 'accepted' && ev.status !== 'pending') continue;
    const rel = touch(ev.customer);
    if (!rel) continue;
    addSession(rel, ts(ev.start), ts(ev.end), ev.status === 'accepted', ts(ev.updatedAt));
  }

  for (const conv of userDetails?.directConversations ?? []) {
    const parts: any[] = Array.isArray(conv?.participants) ? conv.participants : [];
    const other = parts.find((p) => idOf(p) && idOf(p) !== me);
    const role = String(other?.role || '').toLowerCase();
    if (!other || (role && role !== 'customer')) continue;
    const rel = touch(other);
    if (!rel) continue;
    if (conv.rcChannelId) rel.rcChannelId = String(conv.rcChannelId);
    rel.lastActivityAt = maxOf(rel.lastActivityAt, ts(conv.lastMessageAt) ?? ts(conv.updatedAt));
  }

  return out;
}

export function statusOf(rel: Pick<Relationship, 'nextSessionAt' | 'pending' | 'sessionsCount'> | undefined): ClientStatus {
  if (!rel) return 'new';
  if (rel.nextSessionAt != null) return 'upcoming';
  if (rel.pending) return 'pending';
  if (rel.sessionsCount > 0) return 'idle';
  return 'new';
}

function profileFields(user: any) {
  const fields = (Array.isArray(user?.keywords) ? user.keywords : [])
    .map((k: any) => (typeof k === 'object' ? String(k?.value || '') : ''))
    .filter(Boolean);
  return {
    school: String(user?.currentUniversity || ''),
    goal: String(user?.degreeSought || user?.title || ''),
    fields: Array.from(new Set<string>(fields)),
  };
}

export function buildClientRows({
  directory,
  userDetails,
  unreadByRid,
  scope,
  now = Date.now(),
}: {
  directory: any[];
  userDetails: any;
  unreadByRid: Record<string, number>;
  scope: ClientScope;
  now?: number;
}): ClientRow[] {
  const rels = collectRelationships(userDetails, now);
  const directoryById = new Map<string, any>();
  for (const u of dedupeById(directory)) directoryById.set(idOf(u), u);

  const ids = scope === 'all' ? Array.from(directoryById.keys()) : Array.from(rels.keys());

  return ids.map((id) => {
    const rel = rels.get(id);
    const user = { ...(rel?.user || {}), ...(directoryById.get(id) || {}) };
    const { school, goal, fields } = profileFields(user);
    return {
      id,
      name: String(user.username || user.email || 'Student'),
      image: user.image ? String(user.image) : null,
      school,
      goal,
      fields,
      status: statusOf(rel),
      sessionsCount: rel?.sessionsCount ?? 0,
      lastSessionAt: rel?.lastSessionAt ?? null,
      nextSessionAt: rel?.nextSessionAt ?? null,
      lastActivityAt: rel?.lastActivityAt ?? null,
      unread: rel?.rcChannelId ? Number(unreadByRid?.[rel.rcChannelId] || 0) : 0,
      raw: user,
    };
  });
}

export function summaryCounts(rows: ClientRow[], now = Date.now()) {
  return {
    thisWeek: rows.filter((r) => r.nextSessionAt != null && r.nextSessionAt - now <= WEEK_MS).length,
    pending: rows.filter((r) => r.status === 'pending').length,
    new: rows.filter((r) => r.status === 'new').length,
    idle: rows.filter((r) => r.status === 'idle').length,
  };
}

export function fieldOptions(rows: ClientRow[]): string[] {
  return Array.from(new Set(rows.flatMap((r) => r.fields))).sort((a, b) => a.localeCompare(b));
}

const byName = (a: ClientRow, b: ClientRow) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
const nullsLast = (a: number | null, b: number | null, dir: 1 | -1) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return (a - b) * dir;
};

export function filterAndSort(rows: ClientRow[], { query, status, field, sortBy }: ClientFilters): ClientRow[] {
  const q = query.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (status !== 'all' && r.status !== status) return false;
    if (field !== ALL_FIELDS && !r.fields.includes(field)) return false;
    if (!q) return true;
    return [r.name, r.school, r.goal].some((v) => v.toLowerCase().includes(q));
  });
  const compare: Record<ClientSort, (a: ClientRow, b: ClientRow) => number> = {
    next: (a, b) => nullsLast(a.nextSessionAt, b.nextSessionAt, 1) || byName(a, b),
    recent: (a, b) => nullsLast(a.lastActivityAt, b.lastActivityAt, -1) || byName(a, b),
    name: byName,
    sessions: (a, b) => b.sessionsCount - a.sessionsCount || byName(a, b),
  };
  return [...filtered].sort(compare[sortBy]);
}

const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const timeLabel = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

/** "Today, 10:30 AM" / "Tomorrow, 10:30 AM" / "Sat, 4:00 PM" (within 6 days) / "Oct 6, 2:00 PM". */
export function formatNextSession(at: number | null, now = Date.now()): string | null {
  if (at == null) return null;
  const d = new Date(at);
  const days = Math.round((startOfDay(at) - startOfDay(now)) / 86400000);
  if (days === 0) return `Today, ${timeLabel(d)}`;
  if (days === 1) return `Tomorrow, ${timeLabel(d)}`;
  if (days > 1 && days < 7) return `${d.toLocaleDateString('en-US', { weekday: 'short' })}, ${timeLabel(d)}`;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${timeLabel(d)}`;
}

/** "Sep 24", or "Sep 24, 2025" outside the current year. */
export function formatLastSession(at: number | null, now = Date.now()): string | null {
  if (at == null) return null;
  const d = new Date(at);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString('en-US', sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
}
