import React from 'react';
import { Calendar, Search, Users } from 'lucide-react';
import { AUDIT_FOCUS } from './auditUi';
import {
  emptySectionCopy,
  filterConversations,
  formatListDate,
  type AuditConversation,
  type ConversationKind,
  type SegmentFilter,
} from './auditModel';

const SEGMENTS: Array<{ id: SegmentFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'group', label: 'Group' },
  { id: 'private', label: 'Private' },
  { id: 'seminar', label: 'Seminars' },
];

function KindIcon({ kind, initials }: { kind: ConversationKind; initials: string }) {
  if (kind === 'private') {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-audit-brand-soft text-xs font-semibold text-audit-brand">
        {initials}
      </div>
    );
  }
  const Icon = kind === 'seminar' ? Calendar : Users;
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-audit-sunken text-audit-brand">
      <Icon className="h-4 w-4" aria-hidden />
    </div>
  );
}

function ConversationRow({
  item,
  selected,
  failed,
  onSelect,
}: {
  item: AuditConversation;
  selected: boolean;
  failed: boolean;
  onSelect: (item: AuditConversation) => void;
}) {
  return (
    <div
      role="option"
      aria-selected={selected}
      tabIndex={0}
      onClick={() => onSelect(item)}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(item);
        }
      }}
      className={`${AUDIT_FOCUS} flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 ${
        selected ? 'bg-audit-brand-soft' : 'hover:bg-audit-sunken'
      }`}
    >
      <KindIcon kind={item.kind} initials={item.initials} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-audit-ink">{item.title}</p>
          <span className="shrink-0 text-xs tabular-nums text-audit-muted">{formatListDate(item.date)}</span>
        </div>
        <p className="truncate text-sm text-audit-muted">{item.preview}</p>
        {failed ? <p className="truncate text-xs text-audit-bad">Messages failed to load</p> : null}
      </div>
    </div>
  );
}

function Section({
  kind,
  items,
  selectedId,
  failedIds,
  onSelect,
}: {
  kind: ConversationKind;
  items: AuditConversation[];
  selectedId?: string;
  failedIds: Record<string, boolean>;
  onSelect: (item: AuditConversation) => void;
}) {
  return (
    <section className="space-y-1">
      <h3 className="flex items-center justify-between px-2 pt-3 text-xs uppercase tracking-wider text-audit-muted">
        <span>
          {kind === 'private' ? 'Private chats' : kind === 'seminar' ? 'Seminars' : 'Group chats'}
        </span>
        <span className="tabular-nums">{items.length}</span>
      </h3>
      {items.length === 0 ? (
        <p className="px-2 py-2 text-sm text-audit-muted">{emptySectionCopy(kind)}</p>
      ) : (
        items.map(item => (
          <ConversationRow
            key={`${item.kind}-${item.id}`}
            item={item}
            selected={selectedId === item.id}
            failed={Boolean(failedIds[item.id])}
            onSelect={onSelect}
          />
        ))
      )}
    </section>
  );
}

export default function ConversationList({
  group,
  privateChats,
  seminars,
  selectedId,
  failedIds,
  query,
  onQueryChange,
  segment,
  onSegmentChange,
  onSelect,
}: {
  group: AuditConversation[];
  privateChats: AuditConversation[];
  seminars: AuditConversation[];
  selectedId?: string;
  failedIds: Record<string, boolean>;
  query: string;
  onQueryChange: (value: string) => void;
  segment: SegmentFilter;
  onSegmentChange: (value: SegmentFilter) => void;
  onSelect: (item: AuditConversation) => void;
}) {
  const visibleGroup = filterConversations(group, query, segment === 'all' ? 'group' : segment);
  const visiblePrivate = filterConversations(privateChats, query, segment === 'all' ? 'private' : segment);
  const visibleSeminars = filterConversations(seminars, query, segment === 'all' ? 'seminar' : segment);
  const showGroup = segment === 'all' || segment === 'group';
  const showPrivate = segment === 'all' || segment === 'private';
  const showSeminars = segment === 'all' || segment === 'seminar';
  const anyVisible =
    (showGroup && visibleGroup.length > 0) ||
    (showPrivate && visiblePrivate.length > 0) ||
    (showSeminars && visibleSeminars.length > 0);
  const searching = query.trim().length > 0;

  return (
    <div className="flex h-full min-h-0 w-full flex-col lg:w-[340px] lg:shrink-0 lg:border-r lg:border-audit-line">
      <div className="space-y-3 border-b border-audit-line px-3 py-3">
        <label htmlFor="audit-chat-search" className="sr-only">
          Search conversations
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-audit-muted" aria-hidden />
          <input
            id="audit-chat-search"
            type="search"
            value={query}
            onChange={event => onQueryChange(event.target.value)}
            placeholder="Search conversations"
            className={`${AUDIT_FOCUS} h-10 w-full rounded-lg border border-audit-line bg-audit-surface py-2 pl-9 pr-3 text-sm text-audit-ink placeholder:text-audit-muted`}
          />
        </div>
        <div className="grid grid-cols-4 overflow-hidden rounded-lg border border-audit-line" role="group" aria-label="Filter conversations">
          {SEGMENTS.map(item => {
            const active = segment === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSegmentChange(item.id)}
                aria-pressed={active}
                className={`${AUDIT_FOCUS} px-1 py-1.5 text-xs ${
                  active ? 'bg-audit-brand-soft font-semibold text-audit-brand' : 'text-audit-muted hover:bg-audit-sunken'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3" role="listbox" aria-label="Conversations">
        {searching && !anyVisible ? (
          <p className="px-2 py-6 text-center text-sm text-audit-muted">No conversations match that search.</p>
        ) : (
          <>
            {showGroup ? (
              <Section
                kind="group"
                items={segment === 'all' ? visibleGroup : filterConversations(group, query, 'group')}
                selectedId={selectedId}
                failedIds={failedIds}
                onSelect={onSelect}
              />
            ) : null}
            {showPrivate ? (
              <Section
                kind="private"
                items={segment === 'all' ? visiblePrivate : filterConversations(privateChats, query, 'private')}
                selectedId={selectedId}
                failedIds={failedIds}
                onSelect={onSelect}
              />
            ) : null}
            {showSeminars ? (
              <Section
                kind="seminar"
                items={segment === 'all' ? visibleSeminars : filterConversations(seminars, query, 'seminar')}
                selectedId={selectedId}
                failedIds={failedIds}
                onSelect={onSelect}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
