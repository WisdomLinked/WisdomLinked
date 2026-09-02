import React from "react";
import { X } from "lucide-react";

export type ReplyQuoteCardVariant = "incoming" | "outgoing" | "composer";

export type ReplyQuoteCardProps = {
  authorName: string;
  excerpt: string;
  variant: ReplyQuoteCardVariant;
  theme?: string;
  parentMessageId?: string;
  onJumpToParent?: (messageId: string) => void;
  onCancel?: () => void;
  className?: string;
};

export default function ReplyQuoteCard({
  authorName,
  excerpt,
  variant,
  theme = "dark",
  parentMessageId,
  onJumpToParent,
  onCancel,
  className = "",
}: ReplyQuoteCardProps) {
  const clickable = Boolean(parentMessageId && onJumpToParent && variant !== "composer");
  const displayExcerpt = String(excerpt || "").trim() || "Message";

  const shell =
    variant === "composer"
      ? theme === "light"
        ? "rounded-lg border border-stone-200 bg-[#EDEAE4] px-3 py-2"
        : "rounded-lg border border-white/10 bg-black/70 px-3 py-2"
      : variant === "outgoing"
        ? "mb-2 rounded-r-md border-l-[3px] border-white/50 bg-black/25 pl-2.5 pr-2 py-1.5"
        : theme === "light"
          ? "mb-2 rounded-r-md border-l-[3px] border-[#6264A7] bg-white/90 pl-2.5 pr-2 py-1.5"
          : "mb-2 rounded-r-md border-l-[3px] border-[#7fdcc8]/80 bg-black/30 pl-2.5 pr-2 py-1.5";

  const authorCls =
    variant === "outgoing"
      ? "text-xs font-semibold text-[#7fdcc8]"
      : variant === "composer"
        ? theme === "light"
          ? "text-xs font-semibold text-[#234C6A]"
          : "text-xs font-semibold text-[#31B099]"
        : theme === "light"
          ? "text-xs font-semibold text-[#6264A7]"
          : "text-xs font-semibold text-[#7fdcc8]";

  const excerptCls =
    variant === "outgoing"
      ? "mt-0.5 line-clamp-2 text-xs leading-snug break-words text-white/90"
      : variant === "composer"
        ? theme === "light"
          ? "mt-0.5 line-clamp-2 text-xs leading-snug break-words text-stone-600"
          : "mt-0.5 line-clamp-2 text-xs leading-snug break-words text-slate-300"
        : theme === "light"
          ? "mt-0.5 line-clamp-2 text-xs leading-snug break-words text-slate-600"
          : "mt-0.5 line-clamp-2 text-xs leading-snug break-words text-white/90";

  const interactiveCls = clickable
    ? "cursor-pointer transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6264A7]/40"
    : "";

  const handleClick = () => {
    if (!clickable || !parentMessageId || !onJumpToParent) return;
    onJumpToParent(parentMessageId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!clickable) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  const content = (
    <div className="min-w-0 flex-1">
      <div className={authorCls}>{authorName}</div>
      <div className={excerptCls}>{displayExcerpt}</div>
    </div>
  );

  return (
    <div className={`flex items-start gap-2 ${className}`.trim()}>
      {clickable ? (
        <button
          type="button"
          className={`${shell} ${interactiveCls} w-full min-w-0 text-left`}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          aria-label={`Jump to message from ${authorName}`}
        >
          {content}
        </button>
      ) : (
        <div className={`${shell} min-w-0 flex-1`}>{content}</div>
      )}
      {onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          className={
            theme === "light"
              ? "shrink-0 rounded-md p-1 text-stone-500 hover:bg-white/70 hover:text-stone-800"
              : "shrink-0 rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white"
          }
          aria-label="Cancel reply"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
