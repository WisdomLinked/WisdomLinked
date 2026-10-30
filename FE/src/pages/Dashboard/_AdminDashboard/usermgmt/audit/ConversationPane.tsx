import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { ChevronLeft, Info, Loader2 } from 'lucide-react';
import type { RootState } from '../../../../../store';
import CommunityProfileModal from '../../../Messenger/Messages/CommunityProfileModal';
import GroupParticipantsDialog from '../../../Messenger/Messages/GroupParticipantsDialog';
import { AUDIT_FOCUS, AUDIT_PILL } from './auditUi';
import GroupActivity, { type GroupActivityState } from './GroupActivity';
import EmptyState from './EmptyState';
import MessageList from './MessageList';
import SeminarDetails from './SeminarDetails';
import SessionDetailsDialog from './SessionDetailsDialog';
import {
  communityMembersFromChat,
  conversationKindLabel,
  conversationDateLine,
  formatMessageTotal,
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
  canLoadEarlier = false,
  loadingEarlier = false,
  onLoadEarlier,
  groupActivity,
  onRetryGroupActivity,
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
  canLoadEarlier?: boolean;
  loadingEarlier?: boolean;
  onLoadEarlier?: () => void;
  groupActivity?: GroupActivityState;
  onRetryGroupActivity?: () => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // The viewing admin, not the audited user: the participants dialog only offers
  // Remove to a community's owner and co-moderators, so the audit stays read-only.
  const viewerId = useSelector((state: RootState) => String(state.auth?.userDetails?._id || ''));

  // Each conversation opens at its activity summary, not wherever the previous one was left.
  useEffect(() => {
    setDetailsOpen(false);
    setParticipantsOpen(false);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [conversation?.id]);

  if (!conversation) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-audit-canvas">
        <EmptyState title="Nothing selected" description="Choose a conversation from the list to read it." />
      </div>
    );
  }

  const people = participantSummary(conversation.participants, auditedUserId);
  const isSeminar = conversation.kind === 'seminar';
  const appointment = conversation.kind === 'private' ? conversation.appointmentSource : undefined;
  const group = conversation.kind === 'group' || isSeminar ? conversation.group : undefined;
  const loaded = groupActivity?.status === 'ready' ? groupActivity.data : undefined;
  // A seminar's activity spans its whole series; its participants list is this session's, as users see it.
  const members =
    (isSeminar ? undefined : loaded?.members) ??
    group?.members ??
    (appointment ? communityMembersFromChat(appointment) : []);
  const showParticipants = Boolean(group || appointment);
  const messageTotal = formatMessageTotal(groupActivity);
  const peopleText = (
    <>
      {people.names || 'No other participants'}
      {people.extra > 0 ? ` and ${people.extra} others` : ''}
    </>
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-audit-canvas">
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
            {group || appointment ? (
              <h3 className="min-w-0 text-sm font-semibold text-audit-ink">
                <button
                  type="button"
                  onClick={() => setDetailsOpen(true)}
                  title={appointment ? 'View session details' : isSeminar ? 'View seminar details' : 'View community details'}
                  className={`${AUDIT_FOCUS} inline-flex max-w-full items-center gap-1 rounded text-left hover:underline`}
                >
                  <span className="truncate">{conversation.title}</span>
                  <Info className="h-3.5 w-3.5 shrink-0 text-audit-muted" aria-hidden />
                </button>
              </h3>
            ) : (
              <h3 className="truncate text-sm font-semibold text-audit-ink">{conversation.title}</h3>
            )}
            <span className={`${AUDIT_PILL} bg-audit-sunken text-audit-muted`}>
              {conversationKindLabel(conversation.kind)}
            </span>
            {conversation.cancelled ? (
              <span className={`${AUDIT_PILL} bg-audit-bad-soft text-audit-bad`}>Cancelled</span>
            ) : null}
          </div>
          {showParticipants ? (
            <button
              type="button"
              onClick={() => setParticipantsOpen(true)}
              title="View all participants"
              className={`${AUDIT_FOCUS} block max-w-full truncate rounded text-left text-sm text-audit-muted hover:text-audit-ink hover:underline`}
            >
              {peopleText}
            </button>
          ) : (
            <p className="truncate text-sm text-audit-muted">{peopleText}</p>
          )}
          <p className="text-xs text-audit-muted">
            {conversationDateLine(conversation)}
            {' · '}
            <span className="tabular-nums">{messageTotal}</span>
          </p>
        </div>
      </div>

      {/* One scroll for the activity and the thread, so the activity never squeezes the messages. */}
      <div ref={scrollRef} data-testid="audit-conversation-scroll" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {(group || appointment) && groupActivity ? (
          <div className="border-b border-audit-line bg-audit-surface px-3 py-3 xl:px-4">
            <GroupActivity
              state={groupActivity}
              kind={conversation.kind}
              auditedUserId={auditedUserId}
              onRetry={() => onRetryGroupActivity?.()}
            />
          </div>
        ) : null}

        <div className="space-y-4 px-4 py-4">
          {conversation.seminar ? <SeminarDetails seminar={conversation.seminar} /> : null}
          {canLoadEarlier ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={onLoadEarlier}
                disabled={loadingEarlier}
                className={`${AUDIT_FOCUS} inline-flex items-center gap-2 rounded-lg border border-audit-line bg-audit-surface px-3 py-1.5 text-sm font-medium text-audit-ink hover:bg-audit-sunken disabled:opacity-60`}
              >
                {loadingEarlier ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Load earlier messages
              </button>
            </div>
          ) : null}
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
        </div>
      </div>

      <p className="border-t border-audit-line bg-audit-surface px-4 py-2 text-xs text-audit-muted">
        Read-only. This conversation is shown as it appears in the account.
      </p>

      {group && !isSeminar ? (
        <CommunityProfileModal
          isOpen={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          communityDetails={{
            name: loaded?.community.name || group.name,
            description: loaded?.community.description ?? group.description,
            isOpenToAll: loaded?.community.isOpenToAll ?? group.isOpenToAll,
            keywords: loaded?.community.keywords ?? [],
            services: loaded?.community.services ?? [],
            participants: members,
          }}
          onViewMembers={() => setParticipantsOpen(true)}
        />
      ) : null}
      {group && isSeminar && detailsOpen ? (
        <SessionDetailsDialog open onClose={() => setDetailsOpen(false)} session={group.seminarSource} kind="seminar" />
      ) : null}
      {appointment && detailsOpen ? (
        <SessionDetailsDialog open onClose={() => setDetailsOpen(false)} session={appointment} kind="appointment" />
      ) : null}
      {showParticipants && participantsOpen ? (
        <GroupParticipantsDialog
          isDialogOpen
          closeDialogHandler={() => setParticipantsOpen(false)}
          groupDetails={{
            _id: conversation.id,
            type: appointment ? 'individual' : isSeminar ? 'seminar' : 'community',
            groupName: (isSeminar || appointment ? undefined : loaded?.community.name) || group?.name || conversation.title,
            participants: members,
            admin: members.find(member => member.communityRole === 'owner')?._id,
            coModerators: members.filter(member => member.communityRole === 'co-moderator').map(member => member._id),
          }}
          currentUserId={viewerId}
          currentUserRole="admin"
        />
      ) : null}
    </div>
  );
}
