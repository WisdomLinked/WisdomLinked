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
  fetchAsGroup: boolean;
  receiverId?: string;
  seminar?: SeminarDetailsData;
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
  pending: number;
  net: number;
  priceCollected: number;
  tax: number;
};

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
  if (kind === 'group') return 'Group';
  if (kind === 'seminar') return 'Seminar';
  return 'Private';
}

export function emptySectionCopy(kind: ConversationKind): string {
  if (kind === 'group') return 'No group chats on this account.';
  if (kind === 'seminar') return 'No seminars on this account.';
  return 'No private chats on this account.';
}

function previewFromChat(chat: any, fallback: string): string {
  const last = chat?.lastMessage?.content ?? chat?.messages?.[chat.messages.length - 1]?.content;
  const fromMessage = last ? chatMessagePreview(last, { maxLength: 80 }) : '';
  const description = String(chat?.description || chat?.titleLine || '').trim();
  return fromMessage || description || fallback;
}

export function buildGroupConversations(userDetails: any): AuditConversation[] {
  const userId = String(userDetails?._id || '');
  return (userDetails?.generalChats || [])
    .filter((chat: any) => chat && !SKIP_GENERAL_CHAT_NAMES.has(chat.name))
    .map((chat: any) => {
      const isMine = String(chat?.admin?._id || chat?.admin) === userId;
      const title = isMine ? 'General Chat' : String(chat?.name || 'Group chat');
      return {
        id: String(chat._id),
        kind: 'group' as const,
        title,
        preview: previewFromChat(chat, 'Group chat'),
        date: latestDate(chat.updatedAt, chat.lastMessageAt, chat.createdAt),
        initials: initialsFromName(title),
        image: chat.image,
        participants: participantList(chat.participants),
        startedAt: asIso(chat.createdAt),
        fetchAsGroup: true,
      };
    });
}

export function buildPrivateConversations(userDetails: any): AuditConversation[] {
  return (userDetails?.friends || [])
    .filter(Boolean)
    .map((friend: any) => {
      const title = String(friend.username || friend.email || 'Private chat');
      return {
        id: String(friend._id),
        kind: 'private' as const,
        title,
        preview: String(friend.email || 'Direct message'),
        date: latestDate(friend.updatedAt, friend.createdAt),
        initials: initialsFromName(title),
        image: friend.image,
        participants: [
          {
            _id: friend._id,
            username: friend.username,
            email: friend.email,
            image: friend.image,
          },
        ],
        startedAt: asIso(friend.createdAt),
        fetchAsGroup: false,
        receiverId: String(friend._id),
      };
    });
}

export function buildSeminarConversations(userDetails: any): AuditConversation[] {
  return (userDetails?.groupChats || [])
    .filter(Boolean)
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
        fetchAsGroup: true,
        seminar: {
          start: asIso(chat.start),
          end: asIso(chat.end),
          durationMinutes: durationMinutes(chat),
          attendeeCount: participants.length,
          status: seminarStatus(chat.start, chat.end),
          chatStatus: chat.status,
        },
      };
    });
}

export function buildConversations(userDetails: any): {
  group: AuditConversation[];
  privateChats: AuditConversation[];
  seminars: AuditConversation[];
  all: AuditConversation[];
} {
  const group = buildGroupConversations(userDetails);
  const privateChats = buildPrivateConversations(userDetails);
  const seminars = buildSeminarConversations(userDetails);
  return { group, privateChats, seminars, all: [...group, ...privateChats, ...seminars] };
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

export function lastActiveFromAccount(
  userDetails: any,
  conversations: AuditConversation[],
): string | undefined {
  return latestDate(
    userDetails?.updatedAt,
    userDetails?.lastSeen,
    userDetails?.lastActive,
    ...conversations.map(item => item.date),
  );
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
): PaymentSummary {
  let gross = 0;
  let fees = 0;
  let paidOut = 0;
  let pending = 0;
  let priceCollected = 0;
  let tax = 0;
  let studentPaid = 0;

  for (const row of rows) {
    if (isRefundedRow(row)) continue;
    if (row.status === 'failed' || row.status === 'released') continue;
    const money = explainPaymentRow(row, rates);
    if (role === 'expert') {
      gross += money.advertisedCents;
      fees += money.commissionCents;
      if (row.status === 'completed') paidOut += money.expertNetCents;
      if (row.status === 'pending' || row.status === 'withheld') pending += money.expertNetCents;
    } else {
      priceCollected += money.advertisedCents;
      fees += money.platformFeeCents;
      tax += money.taxCents;
      if (row.status === 'completed') studentPaid += money.paidCents;
    }
  }

  if (role === 'student') {
    return {
      role,
      gross: priceCollected,
      fees,
      paidOut: studentPaid,
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
    paidOut,
    pending,
    net: paidOut,
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
    return { label: 'Paid out', tone: 'ok' };
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
