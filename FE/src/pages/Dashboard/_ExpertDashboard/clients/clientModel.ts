import { canonicalLabelsFromMixedServiceEntries } from '../../../../constants/serviceOptions';

export type ClientStatus = 'upcoming' | 'pending' | 'new' | 'idle';
export type ClientScope = 'mine' | 'all';
export type ClientView = 'grid' | 'table';
export type ClientSort = 'next' | 'recent' | 'name' | 'sessions';
export type StudentSort = 'joined' | 'intake' | 'name';

export interface ClientRow {
  id: string;
  name: string;
  /** Profile image key passed to profileImageFetch; null when the student has no photo. */
  image: string | null;
  school: string;
  goal: string;
  fields: string[];
  country: string;
  targetDegree: string;
  intake: string;
  /** Start of the intake term parsed from `intake` ("Fall 2027" -> Sep 1 2027); null when unparseable. */
  intakeAt: number | null;
  gpa: string;
  /** Class ranking percentile, e.g. "Top 10%". */
  ranking: string;
  services: string[];
  joinedAt: number | null;
  /** True when this expert has a session, proposal or direct chat with the student. */
  isClient: boolean;
  status: ClientStatus;
  sessionsCount: number;
  lastSessionAt: number | null;
  nextSessionAt: number | null;
  lastActivityAt: number | null;
  unread: number;
  /** Original user object, handed unchanged to the profile / chat / propose handlers. */
  raw: any;
}

export const STATUS_LABEL: Record<ClientStatus, string> = {
  upcoming: 'Session booked',
  pending: 'Proposal sent',
  new: 'New client',
  idle: 'No session booked',
};

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

/** Profile fields are free-form and some are Mixed in the schema; coerce any stored shape to a trimmed string. */
const text = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') {
    const doc = value as { label?: unknown; value?: unknown; name?: unknown };
    return String(doc.label ?? doc.name ?? doc.value ?? '').trim();
  }
  return '';
};

const SEASON_MONTH: Record<string, number> = { spring: 0, winter: 0, summer: 4, fall: 8, autumn: 8 };
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function parseIntake(value: string): number | null {
  const t = value.toLowerCase();
  const year = t.match(/\b(20\d{2})\b/);
  if (!year) return null;
  const season = Object.keys(SEASON_MONTH).find((s) => t.includes(s));
  const month = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/);
  const monthIdx = season ? SEASON_MONTH[season] : month ? MONTHS.indexOf(month[1]) : 0;
  return new Date(Number(year[1]), monthIdx, 1).getTime();
}

function profileFields(user: any) {
  const keywordNames = (Array.isArray(user?.keywords) ? user.keywords : []).map((k: any) =>
    typeof k === 'object' ? text(k?.value) : '',
  );
  const custom = (Array.isArray(user?.customKeywords) ? user.customKeywords : []).map(text);
  const intake = text(user?.intendedIntake);
  return {
    school: text(user?.currentUniversity),
    goal: text(user?.degreeSought) || text(user?.title),
    fields: Array.from(new Set<string>([...keywordNames, ...custom].filter(Boolean))),
    country: text(user?.country),
    targetDegree: text(user?.degreeSought),
    intake,
    intakeAt: intake ? parseIntake(intake) : null,
    gpa: text(user?.gpa),
    ranking: text(user?.rankingPercentile),
    services: canonicalLabelsFromMixedServiceEntries(user?.services),
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
    return {
      id,
      name: String(user.username || user.email || 'Student'),
      image: user.image ? String(user.image) : null,
      ...profileFields(user),
      joinedAt: ts(user.createdAt),
      isClient: rels.has(id),
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

const distinct = (values: string[]) =>
  Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

export function filterOptions(rows: ClientRow[]) {
  return {
    countries: distinct(rows.map((r) => r.country)),
    majors: distinct(rows.flatMap((r) => r.fields)),
    degrees: distinct(rows.map((r) => r.targetDegree)),
  };
}

export function isNewStudent(row: Pick<ClientRow, 'joinedAt'>, now = Date.now()): boolean {
  return row.joinedAt != null && now - row.joinedAt <= WEEK_MS && row.joinedAt <= now;
}

const byName = (a: ClientRow, b: ClientRow) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
const nullsLast = (a: number | null, b: number | null, dir: 1 | -1) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return (a - b) * dir;
};

export interface StudentFilters {
  query: string;
  /** '' means "any". */
  country: string;
  major: string;
  degree: string;
  /** A student must offer every selected service. */
  services: string[];
  sortBy: StudentSort;
}

export const DEFAULT_STUDENT_FILTERS: StudentFilters = {
  query: '',
  country: '',
  major: '',
  degree: '',
  services: [],
  sortBy: 'joined',
};

export function hasActiveFilters(f: StudentFilters): boolean {
  return Boolean(f.query.trim() || f.country || f.major || f.degree || f.services.length);
}

export function applyStudentFilters(rows: ClientRow[], f: StudentFilters, now = Date.now()): ClientRow[] {
  const q = f.query.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (f.country && r.country !== f.country) return false;
    if (f.major && !r.fields.includes(f.major)) return false;
    if (f.degree && r.targetDegree !== f.degree) return false;
    if (f.services.some((s) => !r.services.includes(s))) return false;
    if (!q) return true;
    return [r.name, r.school, ...r.fields].some((v) => v.toLowerCase().includes(q));
  });
  const termStart = new Date(now);
  termStart.setDate(1);
  termStart.setHours(0, 0, 0, 0);
  // Upcoming intakes first (soonest first), then past ones (most recent first), then unknown.
  const intakeRank = (r: ClientRow) => (r.intakeAt == null ? 2 : r.intakeAt >= termStart.getTime() ? 0 : 1);
  const compare: Record<StudentSort, (a: ClientRow, b: ClientRow) => number> = {
    joined: (a, b) => nullsLast(a.joinedAt, b.joinedAt, -1) || byName(a, b),
    intake: (a, b) =>
      intakeRank(a) - intakeRank(b) ||
      Math.abs((a.intakeAt ?? 0) - now) - Math.abs((b.intakeAt ?? 0) - now) ||
      byName(a, b),
    name: byName,
  };
  return [...filtered].sort(compare[f.sortBy]);
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
