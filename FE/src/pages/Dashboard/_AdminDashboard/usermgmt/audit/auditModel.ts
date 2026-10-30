import { format } from 'date-fns';
import { chatMessagePreview } from '../../../../../utils/chatMessagePreview';
import { userStatusOption } from '../userStatus';
import type { PaymentHistoryRow } from '../../payment/paymentHistoryUtils';

export type ConversationKind = 'group' | 'private' | 'seminar';
export type SegmentFilter = 'all' | 'group' | 'private' | 'seminar';
export type AuditTab = 'chat' | 'payment';

export type AuditParticipant = {
  _id?: string;
  username?: string;
  email?: string;
  image?: string;
};

export type SeminarDetailsData = {
  start?: string;
  end?: string;
  durationMinutes?: number;
  attendeeCount: number;
  status: 'Completed' | 'Scheduled';
  chatStatus?: string;
};

export type CommunityMemberRole = 'owner' | 'co-moderator' | 'member' | 'platform-admin';

export type AuditCommunityMember = AuditParticipant & {
  _id: string;
  role?: string;
  status?: string;
  communityRole: CommunityMemberRole;
};

export type AuditGroupBasics = {
  name: string;
  description: string;
  isOpenToAll: boolean;
  createdAt?: string;
  members: AuditCommunityMember[];
  /** The seminar as stored, for the same details popup users see. */
  seminarSource?: any;
};

export type MemberActivityStats = {
  _id: string;
  callsJoined: number;
  callsStarted: number;
  callsPerWeek: number;
  messages: number | null;
  messagesPerWeek: number | null;
};

export type CommunityActivityTotals = {
  calls: number;
  callsPerWeek: number;
  messages: number | null;
  messagesPerWeek: number | null;
  messagesFromOthers: number | null;
  weeks: number;
  since: string | null;
};

export type GroupActivityData = {
  community: {
    _id: string;
    type?: 'community' | 'seminar';
    sessionCount?: number;
    name?: string;
    description?: string;
    isOpenToAll?: boolean;
    createdAt?: string;
    keywords?: unknown[];
    services?: unknown[];
    participants?: string[];
  };
  members: Array<AuditCommunityMember & MemberActivityStats>;
  totals: CommunityActivityTotals;
  appointment?: AppointmentSummary | null;
  messagesAvailable: boolean;
  messagesCapped: boolean;
};

export type AppointmentSummary = {
  bookedMinutes: number | null;
  calledMinutes: number;
  timeStatus: 'recorded' | 'unconfirmed' | 'in-progress' | 'no-call';
  callsDuring: number;
  callsAfter: number;
  messagesAfter: number | null;
  scheduledEnd: string | null;
};

/** "29 of 30 min" — the video call's length against the booked length. */
export function formatCallTime(summary: AppointmentSummary): string {
  if (summary.timeStatus === 'no-call') return 'No call';
  if (summary.timeStatus === 'in-progress') return 'Call in progress';
  const booked = summary.bookedMinutes != null ? ` of ${summary.bookedMinutes}` : '';
  return `${summary.calledMinutes}${booked} min`;
}

/**
 * The conversation header's message total. Only the activity count is the whole conversation —
 * the thread itself loads a page at a time — so nothing is shown as a total until that count exists.
 */
export function formatMessageTotal(
  activity: { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: GroupActivityData } | undefined,
): string {
  if (!activity || activity.status === 'loading') return 'Counting messages…';
  if (activity.status === 'error' || !activity.data.messagesAvailable || activity.data.totals.messages == null) {
    return 'Messages unavailable';
  }
  const total = activity.data.totals.messages;
  return `${total.toLocaleString('en-US')} ${total === 1 ? 'message' : 'messages'}`;
}

export function formatAfterAppointment(summary: AppointmentSummary): string {
  const calls = `${summary.callsAfter} ${summary.callsAfter === 1 ? 'call' : 'calls'}`;
  if (summary.messagesAfter == null) return `${calls} · messages unavailable`;
  return `${calls} · ${summary.messagesAfter} ${summary.messagesAfter === 1 ? 'message' : 'messages'}`;
}

export type AuditConversation = {
  id: string;
  kind: ConversationKind;
  title: string;
  preview: string;
  date?: string;
  initials: string;
  image?: string;
  participants: AuditParticipant[];
  startedAt?: string;
  /** The 1:1 appointment as stored, for the same details popup users see. */
  appointmentSource?: any;
  /** A cancelled 1:1 or seminar stays on the account, so it is labelled rather than hidden. */
  cancelled?: boolean;
  seminar?: SeminarDetailsData;
  group?: AuditGroupBasics;
};

export type PaymentDisplayStatus = {
  label: string;
  tone: 'ok' | 'warn' | 'bad' | 'muted';
};

export type AuditMoneyRole = 'expert' | 'student';

export type AuditCommissionRates = {
  seminarCommissionPercent: number;
  oneToOneCommissionPercent: number;
};

export const DEFAULT_AUDIT_RATES: AuditCommissionRates = {
  seminarCommissionPercent: 20,
  oneToOneCommissionPercent: 20,
};

export type PaymentBreakdown = {
  advertisedCents: number;
  platformFeeCents: number;
  taxCents: number;
  commissionCents: number;
  expertNetCents: number;
  paidCents: number;
};

export type PaymentSummary = {
  role: AuditMoneyRole;
  gross: number;
  fees: number;
  paidOut: number;
  readyToPay: number;
  pending: number;
  net: number;
  priceCollected: number;
  tax: number;
};

export type AuditCheque = {
  year: number;
  month: number;
  amountCents: number;
  chequeNumber?: string;
  chequeDate?: string | Date | null;
};

export function paymentUtcMonth(value?: string | Date | null): { year: number; month: number } | null {
  const date = parseDate(value);
  if (!date) return null;
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function payrollMonthKey(year: number, month: number): string {
  return `${year}-${month}`;
}

export function auditMoneyRole(role?: string): AuditMoneyRole {
  return String(role || '').toLowerCase() === 'expert' ? 'expert' : 'student';
}

const SKIP_GENERAL_CHAT_NAMES = new Set(['Global Chat', 'Admin']);

export function initialsFromName(name?: string): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export function roleLabel(role?: string): string {
  const value = String(role || '').toLowerCase();
  if (value === 'expert') return 'Expert';
  if (value === 'admin') return 'Admin';
  return 'Customer';
}

export function statusLabel(status?: string): string {
  return userStatusOption(status).label;
}

export function formatJoined(value?: string): string {
  const date = parseDate(value);
  if (!date) return '';
  return format(date, 'MMM yyyy');
}

export function formatListDate(value?: string): string {
  const date = parseDate(value);
  if (!date) return '';
  return format(date, 'MMM d');
}

export function formatStarted(value?: string): string {
  const date = parseDate(value);
  if (!date) return '';
  return format(date, 'MMM d, yyyy');
}

/**
 * The conversation header's date. A 1:1 or seminar is dated by when its session runs, a community
 * by when it was created — distinct from the activity panel's "since", which counts from booking.
 */
export function conversationDateLine(conversation: AuditConversation): string {
  if (conversation.kind === 'group') {
    return conversation.startedAt ? `Created ${formatStarted(conversation.startedAt)}` : 'Creation date unknown';
  }
  const sessionStart = conversation.kind === 'private' ? conversation.appointmentSource?.start : conversation.seminar?.start;
  return parseDate(sessionStart) ? `Session on ${formatStarted(sessionStart)}` : 'Session date unknown';
}

/** What the activity panel counts from: when a 1:1 was booked, or when a seminar or community was created. */
export function activitySinceLine(since: string | null | undefined, kind: ConversationKind): string {
  if (!parseDate(since)) return 'Averages per week';
  return `Since ${kind === 'private' ? 'booked' : 'created'} ${formatStarted(since || undefined)} · averages per week`;
}

export function formatSeminarWhen(value?: string): string {
  const date = parseDate(value);
  if (!date) return '—';
  return format(date, 'MMM d, yyyy · h:mm a');
}

export function formatLastActive(value?: string): string {
  const date = parseDate(value);
  if (!date) return '—';
  return format(date, 'MMM d, yyyy');
}

export function formatUsdFromCents(amount?: number): string {
  const cents = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function parseDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function asIso(value?: string | Date | null): string | undefined {
  const date = parseDate(value);
  return date ? date.toISOString() : undefined;
}

function participantList(value: unknown): AuditParticipant[] {
  if (!Array.isArray(value)) return [];
  return value.filter(Boolean).map((item: any) => ({
    _id: item?._id,
    username: item?.username,
    email: item?.email,
    image: item?.image,
  }));
}

function latestDate(...values: Array<string | Date | undefined | null>): string | undefined {
  let latest: Date | null = null;
  for (const value of values) {
    const date = parseDate(value);
    if (!date) continue;
    if (!latest || date > latest) latest = date;
  }
  return latest ? latest.toISOString() : undefined;
}

function seminarStatus(start?: string | Date, end?: string | Date): 'Completed' | 'Scheduled' {
  const endDate = parseDate(end) || parseDate(start);
  if (endDate && endDate.getTime() < Date.now()) return 'Completed';
  return 'Scheduled';
}

function durationMinutes(chat: any): number | undefined {
  if (typeof chat?.duration === 'number' && Number.isFinite(chat.duration)) return chat.duration;
  const start = parseDate(chat?.start);
  const end = parseDate(chat?.end);
  if (start && end && end > start) {
    return Math.round((end.getTime() - start.getTime()) / 60000);
  }
  return undefined;
}

export function conversationKindLabel(kind: ConversationKind): string {
  if (kind === 'group') return 'Community';
  if (kind === 'seminar') return 'Seminar';
  return '1:1';
}

export function emptySectionCopy(kind: ConversationKind): string {
  if (kind === 'group') return 'No community chats on this account.';
  if (kind === 'seminar') return 'No seminars on this account.';
  return 'No 1:1 appointments on this account.';
}

function previewFromChat(chat: any, fallback: string): string {
  const last = chat?.lastMessage?.content ?? chat?.messages?.[chat.messages.length - 1]?.content;
  const fromMessage = last ? chatMessagePreview(last, { maxLength: 80 }) : '';
  const description = String(chat?.description || chat?.titleLine || '').trim();
  return fromMessage || description || fallback;
}

/**
 * Everyone in a community, each once, strongest role first. The owner is also
 * stored in `participants`, so a plain concatenation would list them twice.
 * Mirrors `communityMembers` in BE/utils/communityActivity.ts.
 */
export function communityMembersFromChat(chat: any): AuditCommunityMember[] {
  const ordered: Array<[any, CommunityMemberRole]> = [
    [chat?.admin, 'owner'],
    ...((chat?.coModerators || []) as any[]).map(user => [user, 'co-moderator'] as [any, CommunityMemberRole]),
    ...((chat?.participants || []) as any[]).map(user => [user, 'member'] as [any, CommunityMemberRole]),
    ...((chat?.chatAdmins || []) as any[]).map(user => [user, 'platform-admin'] as [any, CommunityMemberRole]),
  ];
  const seen = new Set<string>();
  const members: AuditCommunityMember[] = [];
  for (const [user, communityRole] of ordered) {
    const id = String(user?._id ?? user ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const doc = user && typeof user === 'object' ? user : {};
    members.push({
      _id: id,
      username: doc.username,
      email: doc.email,
      image: doc.image,
      role: doc.role,
      status: doc.status,
      communityRole,
    });
  }
  return members;
}

export function communityRoleLabel(role: CommunityMemberRole, kind: ConversationKind = 'group'): string {
  if (role === 'owner') return kind === 'seminar' ? 'Host' : kind === 'private' ? 'Expert' : 'Owner';
  if (role === 'co-moderator') return 'Co-moderator';
  if (role === 'platform-admin') return 'WisdomLinked admin';
  return 'Member';
}

/** Short tag shown beside a member's name; ordinary members get none. */
export function communityMemberTag(
  member: AuditCommunityMember,
  auditedUserId?: string,
  kind: ConversationKind = 'group',
): string {
  if (String(member._id) === String(auditedUserId || '')) return 'Audited';
  return member.communityRole === 'member' ? '' : communityRoleLabel(member.communityRole, kind);
}

export function formatPerWeek(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

export function formatCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US');
}

export function buildGroupConversations(userDetails: any): AuditConversation[] {
  const userId = String(userDetails?._id || '');
  return (userDetails?.generalChats || [])
    .filter((chat: any) => chat && !SKIP_GENERAL_CHAT_NAMES.has(chat.name))
    .map((chat: any) => {
      const isMine = String(chat?.admin?._id || chat?.admin) === userId;
      const title = isMine ? 'General Chat' : String(chat?.name || 'Community chat');
      return {
        id: String(chat._id),
        kind: 'group' as const,
        title,
        preview: previewFromChat(chat, 'Community chat'),
        date: latestDate(chat.updatedAt, chat.lastMessageAt, chat.createdAt),
        initials: initialsFromName(title),
        image: chat.image,
        participants: participantList(chat.participants),
        startedAt: asIso(chat.createdAt),
        group: {
          name: String(chat?.name || 'Community'),
          description: String(chat?.description || ''),
          isOpenToAll: Boolean(chat?.isOpenToAll),
          createdAt: asIso(chat.createdAt),
          members: communityMembersFromChat(chat),
        },
      };
    });
}

/** 1:1 appointments are GroupChats of type `individual`; plain direct messages are not audited here. */
export function buildAppointmentConversations(userDetails: any): AuditConversation[] {
  return (userDetails?.groupChats || [])
    .filter((chat: any) => chat?.type === 'individual')
    .map((chat: any) => {
      const title = String(chat.name || '1:1 appointment');
      return {
        id: String(chat._id),
        kind: 'private' as const,
        title,
        preview: previewFromChat(chat, '1:1 appointment'),
        date: latestDate(chat.updatedAt, chat.lastMessageAt, chat.start, chat.createdAt),
        initials: initialsFromName(title),
        image: chat.image,
        participants: participantList(chat.participants),
        startedAt: asIso(chat.start || chat.createdAt),
        appointmentSource: chat,
        cancelled: chat.status === 'cancelled',
      };
    });
}

export function buildSeminarConversations(userDetails: any): AuditConversation[] {
  return (userDetails?.groupChats || [])
    .filter((chat: any) => chat && chat.type !== 'individual')
    .map((chat: any) => {
      const title = String(chat.name || 'Seminar');
      const participants = participantList(chat.participants);
      return {
        id: String(chat._id),
        kind: 'seminar' as const,
        title,
        preview: previewFromChat(chat, 'Seminar'),
        date: latestDate(chat.updatedAt, chat.lastMessageAt, chat.start, chat.createdAt),
        initials: initialsFromName(title),
        image: chat.image,
        participants,
        startedAt: asIso(chat.start || chat.createdAt),
        cancelled: chat.status === 'cancelled',
        seminar: {
          start: asIso(chat.start),
          end: asIso(chat.end),
          durationMinutes: durationMinutes(chat),
          attendeeCount: participants.length,
          status: seminarStatus(chat.start, chat.end),
          chatStatus: chat.status,
        },
        group: {
          name: title,
          description: String(chat?.description || ''),
          isOpenToAll: false,
          createdAt: asIso(chat.createdAt),
          members: communityMembersFromChat(chat),
          seminarSource: chat,
        },
      };
    });
}

export function buildConversations(userDetails: any): {
  group: AuditConversation[];
  appointments: AuditConversation[];
  seminars: AuditConversation[];
  all: AuditConversation[];
} {
  const group = buildGroupConversations(userDetails);
  const appointments = buildAppointmentConversations(userDetails);
  const seminars = buildSeminarConversations(userDetails);
  return { group, appointments, seminars, all: [...appointments, ...seminars, ...group] };
}

export function filterConversations(
  items: AuditConversation[],
  query: string,
  segment: SegmentFilter,
): AuditConversation[] {
  const needle = query.trim().toLowerCase();
  return items.filter(item => {
    if (segment !== 'all' && item.kind !== segment) return false;
    if (!needle) return true;
    return `${item.title} ${item.preview}`.toLowerCase().includes(needle);
  });
}

/**
 * When the user last signed in. Accounts that have not signed in since login times were recorded
 * fall back to the latest past change on the account or its chats — never a future session date,
 * which a conversation's date can be.
 */
export function lastActiveFromAccount(
  userDetails: any,
  conversations: AuditConversation[],
  now: number = Date.now(),
): string | undefined {
  const lastLogin = parseDate(userDetails?.lastLoginAt);
  if (lastLogin && lastLogin.getTime() <= now) return lastLogin.toISOString();
  const past = [
    userDetails?.updatedAt,
    userDetails?.lastSeen,
    userDetails?.lastActive,
    ...conversations.map(item => item.date),
  ].filter(value => {
    const date = parseDate(value);
    return date !== null && date.getTime() <= now;
  });
  return latestDate(...past);
}

export function participantSummary(
  participants: AuditParticipant[],
  auditedUserId?: string,
  limit = 2,
): { names: string; extra: number } {
  const others = participants.filter(person => String(person._id) !== String(auditedUserId || ''));
  const labels = others
    .map(person => person.username || person.email)
    .filter(Boolean) as string[];
  const shown = labels.slice(0, limit);
  return {
    names: shown.join(', '),
    extra: Math.max(0, labels.length - shown.length),
  };
}

/**
 * A payment link sent after a failed charge (`retry`) that has not been paid. It asks for money
 * rather than holding any, so it counts nowhere until the student pays it.
 */
export function isUnpaidPaymentLink(row: PaymentHistoryRow): boolean {
  return row?.paymentType === 'retry' && row?.status !== 'completed';
}

export function isRefundedRow(row: PaymentHistoryRow): boolean {
  return row?.status === 'refunded' || row?.paymentType === 'refund';
}

function isSeminarRow(row: PaymentHistoryRow): boolean {
  return row.sessionType === 'seminar' || row.groupChat?.type === 'seminar';
}

/** New charges carry a snapshot. Old rows only have `amount`. */
export function explainPaymentRow(
  row: PaymentHistoryRow,
  rates: AuditCommissionRates = DEFAULT_AUDIT_RATES,
): PaymentBreakdown {
  const paid = typeof row.amount === 'number' && Number.isFinite(row.amount) ? row.amount : 0;
  if (typeof row.advertisedCents === 'number') {
    return {
      advertisedCents: row.advertisedCents,
      platformFeeCents: typeof row.platformFeeCents === 'number' ? row.platformFeeCents : 0,
      taxCents: typeof row.taxCents === 'number' ? row.taxCents : 0,
      commissionCents: typeof row.commissionCents === 'number' ? row.commissionCents : 0,
      expertNetCents: typeof row.expertNetCents === 'number' ? row.expertNetCents : 0,
      paidCents: paid,
    };
  }
  const percent = isSeminarRow(row) ? rates.seminarCommissionPercent : rates.oneToOneCommissionPercent;
  const commission = paid === 0 ? 0 : Math.round((paid * percent) / 100);
  return {
    advertisedCents: paid,
    platformFeeCents: 0,
    taxCents: 0,
    commissionCents: commission,
    expertNetCents: paid === 0 ? 0 : paid - commission,
    paidCents: paid,
  };
}

export function paymentSummary(
  rows: PaymentHistoryRow[],
  role: AuditMoneyRole = 'expert',
  rates: AuditCommissionRates = DEFAULT_AUDIT_RATES,
  cheques: AuditCheque[] = [],
): PaymentSummary {
  let gross = 0;
  let fees = 0;
  let readyToPay = 0;
  let pending = 0;
  let priceCollected = 0;
  let tax = 0;
  let studentPaid = 0;
  const paidMonths = new Set(
    (cheques || []).map(cheque => payrollMonthKey(Number(cheque.year), Number(cheque.month))),
  );
  const chequeTotal = (cheques || []).reduce(
    (sum, cheque) => sum + (typeof cheque.amountCents === 'number' && Number.isFinite(cheque.amountCents) ? cheque.amountCents : 0),
    0,
  );

  for (const row of rows) {
    if (isRefundedRow(row)) continue;
    if (row.status === 'failed' || row.status === 'released') continue;
    if (isUnpaidPaymentLink(row)) continue;
    const money = explainPaymentRow(row, rates);
    if (role === 'expert') {
      gross += money.advertisedCents;
      fees += money.commissionCents;
      if (row.status === 'completed') {
        const month = paymentUtcMonth(row.createdAt);
        const covered = month ? paidMonths.has(payrollMonthKey(month.year, month.month)) : false;
        if (!covered) readyToPay += money.expertNetCents;
      }
      if (row.status === 'pending' || row.status === 'withheld') pending += money.expertNetCents;
    } else if (row.status === 'completed') {
      // Only money actually charged: a card hold awaiting the expert is authorised, not collected.
      priceCollected += money.advertisedCents;
      fees += money.platformFeeCents;
      tax += money.taxCents;
      studentPaid += money.paidCents;
    }
  }

  if (role === 'student') {
    return {
      role,
      gross: priceCollected,
      fees,
      paidOut: studentPaid,
      readyToPay: 0,
      pending: 0,
      net: studentPaid,
      priceCollected,
      tax,
    };
  }

  return {
    role: 'expert',
    gross,
    fees,
    paidOut: chequeTotal,
    readyToPay,
    pending,
    net: readyToPay + chequeTotal,
    priceCollected: gross,
    tax: 0,
  };
}

export function paymentDisplayStatus(row: PaymentHistoryRow): PaymentDisplayStatus {
  if (row.status === 'refunded' || row.paymentType === 'refund') {
    return { label: 'Refunded', tone: 'bad' };
  }
  if (row.status === 'pending' || row.status === 'withheld') {
    return { label: 'Pending', tone: 'warn' };
  }
  if (row.status === 'completed') {
    return { label: 'Completed', tone: 'ok' };
  }
  if (row.status === 'failed') {
    return { label: 'Failed', tone: 'bad' };
  }
  if (row.status === 'released') {
    return { label: 'Released', tone: 'muted' };
  }
  return { label: row.status || '—', tone: 'muted' };
}

export function paymentToneClass(tone: PaymentDisplayStatus['tone']): string {
  if (tone === 'ok') return 'bg-audit-ok-soft text-audit-ok';
  if (tone === 'warn') return 'bg-audit-warn-soft text-audit-warn';
  if (tone === 'bad') return 'bg-audit-bad-soft text-audit-bad';
  return 'bg-audit-sunken text-audit-muted';
}

export function paidByLabel(row: PaymentHistoryRow): string {
  return row.customer?.username || row.customer?.email || '—';
}

export function paymentDescription(row: PaymentHistoryRow): string {
  return String(row.description || 'Payment').trim() || 'Payment';
}

export function paymentTransactionId(row: PaymentHistoryRow): string {
  return String(row.paymentIntent || row._id || '').trim();
}

export type ChatMessage = {
  _id?: string;
  content?: string;
  createdAt?: string;
  author?: {
    _id?: string;
    username?: string;
    image?: string;
  };
};

export function groupMessagesByDay(messages: ChatMessage[]): Array<{ day: string; items: ChatMessage[] }> {
  const groups: Array<{ day: string; items: ChatMessage[] }> = [];
  for (const message of messages) {
    const date = parseDate(message.createdAt);
    const day = date ? date.toDateString() : 'Unknown';
    const last = groups[groups.length - 1];
    if (last && last.day === day) {
      last.items.push(message);
    } else {
      groups.push({ day, items: [message] });
    }
  }
  return groups;
}

export function buildExportPayload(input: {
  userDetails: any;
  conversations: AuditConversation[];
  payments: PaymentHistoryRow[];
  summary: PaymentSummary;
}): string {
  const { userDetails, conversations, payments, summary } = input;
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      account: {
        id: userDetails?._id,
        username: userDetails?.username,
        email: userDetails?.email,
        role: userDetails?.role,
        status: userDetails?.status,
        joined: userDetails?.createdAt,
      },
      conversations: conversations.map(item => ({
        id: item.id,
        kind: item.kind,
        title: item.title,
        date: item.date,
      })),
      payments,
      paymentSummary: summary,
    },
    null,
    2,
  );
}
