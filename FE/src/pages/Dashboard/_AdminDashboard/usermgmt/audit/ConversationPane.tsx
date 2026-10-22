import React from 'react';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { AUDIT_FOCUS, AUDIT_PILL } from './auditUi';
import EmptyState from './EmptyState';
import MessageList from './MessageList';
import SeminarDetails from './SeminarDetails';
import {
  conversationKindLabel,
  formatStarted,
  participantSummary,
  type AuditConversation,
  type ChatMessage,
} from './auditModel';

export default function ConversationPane({
  conversation,
  messages,
  loading,
  error,
  retrying,
  auditedUserId,
  onBack,
  onRetry,
  showBack,
  onMessagesScroll,
  messagesEndRef,
}: {
  conversation?: AuditConversation;
  messages: ChatMessage[];
  loading: boolean;
  error: boolean;
  retrying: boolean;
  auditedUserId?: string;
  onBack: () => void;
  onRetry: () => void;
  showBack: boolean;
  onMessagesScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
  messagesEndRef?: React.RefObject<HTMLDivElement | null>;
}) {
  if (!conversation) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-audit-canvas">
        <EmptyState title="Nothing selected" description="Choose a conversation from the list to read it." />
      </div>
    );
  }

  const people = participantSummary(conversation.participants, auditedUserId);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-audit-canvas">
      <div className="flex items-start gap-3 border-b border-audit-line bg-audit-surface px-4 py-3">
        {showBack ? (
          <button
            type="button"
            onClick={onBack}
            className={`${AUDIT_FOCUS} mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-audit-muted hover:bg-audit-sunken`}
            aria-label="Back to conversations"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-audit-ink">{conversation.title}</h3>
            <span className={`${AUDIT_PILL} bg-audit-sunken text-audit-muted`}>
              {conversationKindLabel(conversation.kind)}
            </span>
          </div>
          <p className="truncate text-sm text-audit-muted">
            {people.names || 'No other participants'}
            {people.extra > 0 ? ` and ${people.extra} others` : ''}
          </p>
          <p className="text-xs text-audit-muted">
            {conversation.startedAt ? `Started ${formatStarted(conversation.startedAt)}` : 'Start date unknown'}
            {' · '}
            <span className="tabular-nums">{messages.length} messages</span>
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4" onScroll={onMessagesScroll}>
        {conversation.seminar ? <SeminarDetails seminar={conversation.seminar} /> : null}
        {error ? (
          <div className="rounded-xl border border-audit-bad bg-audit-bad-soft px-4 py-5 text-center">
            <p className="text-sm font-medium text-audit-bad">Couldn&apos;t load messages for this chat</p>
            <p className="mt-1 text-sm text-audit-muted">
              The conversation is still listed, but its messages could not be retrieved.
            </p>
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className={`${AUDIT_FOCUS} mt-3 inline-flex items-center gap-2 rounded-lg bg-audit-surface px-3 py-1.5 text-sm font-medium text-audit-ink hover:bg-audit-canvas disabled:opacity-60`}
            >
              {retrying ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className="flex h-40 items-center justify-center text-audit-muted">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            <span className="sr-only">Loading messages</span>
          </div>
        ) : (
          <MessageList messages={messages} auditedUserId={auditedUserId} />
        )}
        <div ref={messagesEndRef} />
      </div>

      <p className="border-t border-audit-line bg-audit-surface px-4 py-2 text-xs text-audit-muted">
        Read-only. This conversation is shown as it appears in the account.
      </p>
    </div>
  );
}
