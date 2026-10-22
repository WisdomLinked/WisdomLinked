import React from 'react';
import { format } from 'date-fns';
import { formatDividerDate } from '../../../../../utils/formatMessageTime';
import { renderSafeMessageHtml } from '../../../../../utils/safeMessageHtml';
import { isRichHtmlWire, decodeRichHtmlWire } from '../../../../../utils/chatRichHtmlWire';
import { chatMessagePreview } from '../../../../../utils/chatMessagePreview';
import EmptyState from './EmptyState';
import { groupMessagesByDay, initialsFromName, parseDate, type ChatMessage } from './auditModel';

function messageBody(content?: string) {
  const raw = String(content || '');
  if (!raw) return <p className="text-sm text-audit-muted">No content</p>;
  if (raw.startsWith('Chatfile:') || raw.startsWith('__MEETING_')) {
    return <p className="text-sm">{chatMessagePreview(raw)}</p>;
  }
  const html = isRichHtmlWire(raw) ? decodeRichHtmlWire(raw) || raw : raw;
  return <div className="chat-message-rich text-sm">{renderSafeMessageHtml(html)}</div>;
}

export default function MessageList({
  messages,
  auditedUserId,
}: {
  messages: ChatMessage[];
  auditedUserId?: string;
}) {
  if (!messages.length) {
    return <EmptyState title="No messages in this chat" description="This conversation has no messages yet." />;
  }

  return (
    <div className="space-y-4">
      {groupMessagesByDay(messages).map(group => {
        const dayDate = parseDate(group.items[0]?.createdAt);
        return (
          <section key={group.day} className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-audit-line" />
              <p className="text-xs uppercase tracking-wider text-audit-muted">
                {dayDate ? formatDividerDate(dayDate) : group.day}
              </p>
              <div className="h-px flex-1 bg-audit-line" />
            </div>
            {group.items.map((message, index) => {
              const isAudited = String(message.author?._id) === String(auditedUserId || '');
              const author = message.author?.username || 'Unknown';
              const time = parseDate(message.createdAt);
              return (
                <article key={String(message._id || index)} className="flex items-start gap-3">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-audit-sunken text-xs font-semibold text-audit-brand"
                    aria-hidden
                  >
                    {initialsFromName(author)}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-sm font-medium text-audit-ink">{author}</span>
                      {isAudited ? (
                        <span className="text-xs font-medium text-audit-brand">Audited user</span>
                      ) : null}
                      <time className="text-xs tabular-nums text-audit-muted">
                        {time ? format(time, 'h:mm a') : ''}
                      </time>
                    </div>
                    <div
                      className={`max-w-xl rounded-2xl px-3 py-2 ${
                        isAudited
                          ? 'bg-audit-brand-soft text-audit-ink'
                          : 'bg-audit-sunken text-audit-ink'
                      }`}
                    >
                      {messageBody(message.content)}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
