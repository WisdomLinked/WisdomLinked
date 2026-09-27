import { RotateCcw, Sparkles, X } from 'lucide-react';

type Props = {
  onNewChat: () => void;
  onClose: () => void;
};

export default function HelpBotHeader({ onNewChat, onClose }: Props) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 bg-[#234C6A] px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
          <Sparkles className="h-4 w-4 text-white" aria-hidden />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-white">
            WisdomLinked Assistant
          </div>
          <div className="flex items-center gap-1.5 text-xs text-white/70">
            <span
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400"
              aria-hidden
            />
            <span className="truncate">AI-powered · Instant answers</span>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          title="New chat"
          aria-label="New chat"
          onClick={onNewChat}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          title="Close"
          aria-label="Close"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
