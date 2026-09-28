import { useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import HelpBotHeader from './HelpBotHeader';
import WelcomePanel from './WelcomePanel';
import MessageList from './MessageList';
import SuggestionChips from './SuggestionChips';
import HelpBotInput from './HelpBotInput';
import { useHelpBot } from './useHelpBot';

/**
 * HelpBot widget: unchanged floating launcher + redesigned chat panel.
 * Default export is used by Student/Expert/Admin dashboards via `chatbot.tsx`.
 */
export default function HelpBotWidget() {
  const bot = useHelpBot();

  useEffect(() => {
    if (!bot.open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        bot.closeWidget();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [bot.open, bot.closeWidget]);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!bot.open ? (
        <button
          ref={bot.launcherRef}
          type="button"
          onClick={bot.openWidget}
          className="inline-flex items-center gap-2 rounded-lg border border-[#234C6A] bg-[#234C6A] px-3 py-2 shadow-[0_12px_30px_rgba(26,58,74,0.16)] transition-shadow hover:shadow-[0_18px_45px_rgba(26,58,74,0.22)]"
          aria-label="Open HelpBot"
        >
          <MessageSquare className="h-4 w-4 text-white" aria-hidden />
          <span className="text-[13px] font-semibold text-white">HelpBot</span>
        </button>
      ) : (
        <div
          role="dialog"
          aria-label="WisdomLinked Assistant"
          aria-modal="true"
          className="flex h-[600px] max-h-[calc(100vh-120px)] w-[380px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl transition duration-200 ease-out motion-reduce:transition-none max-sm:fixed max-sm:inset-0 max-sm:h-auto max-sm:max-h-none max-sm:w-auto max-sm:max-w-none max-sm:rounded-none"
        >
          <HelpBotHeader onNewChat={bot.resetChat} onClose={bot.closeWidget} />

          {bot.messages.length === 0 ? (
            <div ref={bot.listRef} className="min-h-0 flex-1 overflow-y-auto bg-white">
              <WelcomePanel
                onSelectFaq={(q) => void bot.sendQuestion(q)}
                disabled={bot.pending}
              />
            </div>
          ) : (
            <MessageList
              messages={bot.messages}
              listRef={bot.listRef}
              onScroll={bot.handleListScroll}
              showJumpPill={bot.showJumpPill}
              onJumpToLatest={bot.jumpToLatest}
              onRetry={bot.retryLastError}
              onFeedback={bot.onFeedback}
            />
          )}

          {bot.messages.length > 0 && !bot.pending ? (
            <SuggestionChips
              questions={bot.suggestionChips}
              onSelect={(q) => void bot.sendQuestion(q)}
              disabled={bot.pending}
            />
          ) : null}

          <HelpBotInput
            inputRef={bot.inputRef}
            responding={bot.pending}
            onSend={(text) => void bot.sendQuestion(text)}
          />
        </div>
      )}
    </div>
  );
}
