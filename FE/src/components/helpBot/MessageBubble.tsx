import { ThumbsDown, ThumbsUp } from 'lucide-react';
import AnswerText from '../AnswerText';
import type { FeedbackValue, HelpBotMessage } from './types';
import TypingIndicator from './TypingIndicator';

type Props = {
  message: HelpBotMessage;
  onRetry?: () => void;
  onFeedback?: (messageId: string, value: FeedbackValue) => void;
  isFirstInGroup?: boolean;
};

export default function MessageBubble({
  message,
  onRetry,
  onFeedback,
  isFirstInGroup = true,
}: Props) {
  if (message.role === 'user') {
    return (
      <div className={`flex justify-end ${isFirstInGroup ? '' : 'mt-1'}`}>
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-[#234C6A] px-4 py-2.5 text-sm text-white whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.pending) {
    return <TypingIndicator />;
  }

  if (message.error) {
    return (
      <div className={`flex justify-start gap-2 ${isFirstInGroup ? '' : 'mt-1'}`}>
        {isFirstInGroup ? (
          <div
            className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#234C6A]/10"
            aria-hidden
          >
            <span className="h-2 w-2 rounded-full bg-[#234C6A]" />
          </div>
        ) : (
          <div className="w-6 shrink-0" aria-hidden />
        )}
        <div className="max-w-[80%]">
          <div className="rounded-2xl rounded-bl-md bg-red-50 px-4 py-2.5 text-sm text-red-800">
            <p>{message.content || 'Something went wrong.'}</p>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-1.5 text-xs font-semibold text-red-700 underline underline-offset-2 hover:text-red-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded"
              >
                Retry
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const sourceLabel = message.source === 'faq' ? 'From FAQ' : 'AI answer';

  return (
    <div className={`flex justify-start gap-2 ${isFirstInGroup ? '' : 'mt-1'}`}>
      {isFirstInGroup ? (
        <div
          className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#234C6A]/10"
          aria-hidden
        >
          <span className="h-2 w-2 rounded-full bg-[#234C6A]" />
        </div>
      ) : (
        <div className="w-6 shrink-0" aria-hidden />
      )}
      <div className="max-w-[80%] min-w-0">
        <AnswerText
          text={message.content}
          className="rounded-2xl rounded-bl-md bg-slate-100 px-4 py-2.5 text-sm text-slate-800"
        />
        <div className="mt-1 flex items-center gap-2 px-1">
          <span className="text-[11px] text-slate-400">{sourceLabel}</span>
          {message.source === 'ai' && onFeedback ? (
            <span className="inline-flex items-center gap-0.5">
              <button
                type="button"
                title="Helpful"
                aria-label="Helpful"
                onClick={() => onFeedback(message.id, 'up')}
                className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/40"
              >
                <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button
                type="button"
                title="Not helpful"
                aria-label="Not helpful"
                onClick={() => onFeedback(message.id, 'down')}
                className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/40"
              >
                <ThumbsDown className="h-3.5 w-3.5" aria-hidden />
              </button>
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
