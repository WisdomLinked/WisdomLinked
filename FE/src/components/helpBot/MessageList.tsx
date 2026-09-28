import type { RefObject } from 'react';
import type { FeedbackValue, HelpBotMessage } from './types';
import MessageBubble from './MessageBubble';

type Props = {
  messages: HelpBotMessage[];
  listRef: RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  showJumpPill: boolean;
  onJumpToLatest: () => void;
  onRetry: () => void;
  onFeedback: (messageId: string, value: FeedbackValue) => void;
};

function groupMessages(messages: HelpBotMessage[]): HelpBotMessage[][] {
  const groups: HelpBotMessage[][] = [];
  for (const msg of messages) {
    const last = groups[groups.length - 1];
    if (last && last[0].role === msg.role && !last[0].pending && !msg.pending) {
      last.push(msg);
    } else {
      groups.push([msg]);
    }
  }
  return groups;
}

export default function MessageList({
  messages,
  listRef,
  onScroll,
  showJumpPill,
  onJumpToLatest,
  onRetry,
  onFeedback,
}: Props) {
  const groups = groupMessages(messages);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={listRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto bg-white px-4 py-4"
        aria-live="polite"
        aria-relevant="additions"
      >
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group[0].id} className="space-y-1">
              {group.map((msg, index) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isFirstInGroup={index === 0}
                  onRetry={msg.error ? onRetry : undefined}
                  onFeedback={onFeedback}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      {showJumpPill ? (
        <button
          type="button"
          onClick={onJumpToLatest}
          className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#234C6A] shadow-md hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/40"
        >
          ↓ New messages
        </button>
      ) : null}
    </div>
  );
}
