import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { doGetGroupChatActivity, doGetGroupChatHistory } from '../../../../api/api';
import type { GroupActivityState } from './audit/GroupActivity';
import ConversationList from './audit/ConversationList';
import ConversationPane from './audit/ConversationPane';
import {
  buildConversations,
  type AuditConversation,
  type ChatMessage,
  type SegmentFilter,
} from './audit/auditModel';

const LG_QUERY = '(min-width: 1024px)';

function useIsLg() {
  const [isLg, setIsLg] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(LG_QUERY).matches
      : true,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia(LG_QUERY);
    const onChange = () => setIsLg(media.matches);
    onChange();
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, []);

  return isLg;
}

const ChatHistory = ({ userDetails }: { userDetails?: any }) => {
  const isLg = useIsLg();
  const [selectedChat, set_selectedChat] = useState<AuditConversation | undefined>();
  const [gotAllChats, set_gotAllChats] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [currentPage, set_currentPage] = useState(0);
  const [messages, set_messages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [failedIds, setFailedIds] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [segment, setSegment] = useState<SegmentFilter>('all');
  const [activityById, setActivityById] = useState<Record<string, GroupActivityState>>({});

  const buckets = useMemo(() => buildConversations(userDetails), [userDetails]);

  const getChatHistory = useCallback(
    async (pageNum: number, conversation: AuditConversation, mode: 'load' | 'retry' = 'load') => {
      if (!conversation?.id || !userDetails?._id) return;
      set_currentPage(pageNum);
      if (pageNum === 0) {
        if (mode === 'retry') {
          setRetrying(true);
        } else {
          setLoading(true);
          setError(false);
        }
      }
      const response: any = await doGetGroupChatHistory(
        {
          currentPage: pageNum,
          groupChatId: conversation.id,
        },
        { notify: false },
      );

      if (response) {
        if (!pageNum) {
          set_messages([...(response.result || [])]);
        } else {
          set_messages(prev => [...(response.result || []), ...prev]);
        }
        set_gotAllChats(Boolean(response.gotAllChats));
        setFailedIds(prev => {
          if (!prev[conversation.id]) return prev;
          const next = { ...prev };
          delete next[conversation.id];
          return next;
        });
        setError(false);
      } else if (pageNum === 0) {
        set_messages([]);
        setError(true);
        setFailedIds(prev => ({ ...prev, [conversation.id]: true }));
      }
      setLoading(false);
      setRetrying(false);
    },
    [userDetails?._id],
  );

  const loadGroupActivity = useCallback(async (groupChatId: string) => {
    setActivityById(prev => ({ ...prev, [groupChatId]: { status: 'loading' } }));
    const response: any = await doGetGroupChatActivity(groupChatId, { notify: false });
    setActivityById(prev => ({
      ...prev,
      [groupChatId]: response?.status === 'SUCCESS' ? { status: 'ready', data: response } : { status: 'error' },
    }));
  }, []);

  const selectedGroupId =
    selectedChat?.kind === 'group' || selectedChat?.kind === 'seminar' || selectedChat?.kind === 'private'
      ? selectedChat.id
      : undefined;
  const selectedActivity = selectedGroupId ? activityById[selectedGroupId] : undefined;

  useEffect(() => {
    if (selectedGroupId && !selectedActivity) void loadGroupActivity(selectedGroupId);
  }, [selectedGroupId, selectedActivity, loadGroupActivity]);

  const loadEarlierMessages = async () => {
    if (!selectedChat || gotAllChats || loadingEarlier || loading) return;
    setLoadingEarlier(true);
    await getChatHistory(currentPage + 1, selectedChat);
    setLoadingEarlier(false);
  };

  useEffect(() => {
    if (selectedChat?.id) {
      set_messages([]);
      set_gotAllChats(true);
      void getChatHistory(0, selectedChat);
    }
  }, [selectedChat?.id, getChatHistory]);

  useEffect(() => {
    set_selectedChat(undefined);
    set_messages([]);
    setError(false);
    setFailedIds({});
    setActivityById({});
  }, [userDetails?._id]);

  useEffect(() => {
    if (isLg && !selectedChat && buckets.all.length > 0) {
      set_selectedChat(buckets.all[0]);
    }
  }, [isLg, selectedChat, buckets.all]);

  const showList = !selectedChat || isLg;
  const showPane = Boolean(selectedChat) || isLg;

  return (
    // Fills the space left in the audit window; below 420px the window scrolls instead of crushing the panes.
    <div className="mt-4 flex h-0 min-h-[420px] flex-1 overflow-hidden rounded-xl border border-audit-line bg-audit-surface">
      {showList ? (
        <ConversationList
          group={buckets.group}
          appointments={buckets.appointments}
          seminars={buckets.seminars}
          selectedId={selectedChat?.id}
          failedIds={failedIds}
          query={query}
          onQueryChange={setQuery}
          segment={segment}
          onSegmentChange={setSegment}
          onSelect={set_selectedChat}
        />
      ) : null}
      {showPane ? (
        <ConversationPane
          conversation={selectedChat}
          messages={messages}
          loading={loading}
          error={error}
          retrying={retrying}
          auditedUserId={userDetails?._id}
          showBack={!isLg}
          onBack={() => set_selectedChat(undefined)}
          onRetry={() => selectedChat && getChatHistory(0, selectedChat, 'retry')}
          canLoadEarlier={!loading && !error && !gotAllChats && messages.length > 0}
          loadingEarlier={loadingEarlier}
          onLoadEarlier={() => void loadEarlierMessages()}
          groupActivity={selectedGroupId ? selectedActivity ?? { status: 'loading' } : undefined}
          onRetryGroupActivity={() => selectedGroupId && loadGroupActivity(selectedGroupId)}
        />
      ) : null}
    </div>
  );
};

export default ChatHistory;
