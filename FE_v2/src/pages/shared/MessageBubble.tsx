import { type ChatMessage } from "@/atoms/chatAtoms";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/utils/timeUtils";

// ── MessageBubble ─────────────────────────────────────────────────────────

export interface MessageBubbleProps {
  msg: ChatMessage;
  isSelf: boolean;
}

export function MessageBubble({ msg, isSelf }: MessageBubbleProps) {
  return (
    <div className={cn("flex gap-2 mb-3", isSelf ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0 mt-1">
        {msg.authorId.charAt(0).toUpperCase()}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          "max-w-[70%] rounded-2xl px-4 py-2 text-sm break-words",
          isSelf
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-muted text-foreground rounded-tl-sm",
        )}
      >
        <p>{msg.content}</p>
        {msg.fileUrl !== null && (
          <a
            href={msg.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline mt-1 block opacity-80"
          >
            Attachment
          </a>
        )}
        <span
          className={cn(
            "text-xs mt-1 block",
            isSelf ? "text-primary-foreground/70" : "text-muted-foreground",
          )}
        >
          {formatRelativeTime(msg.createdAt)}
        </span>
      </div>
    </div>
  );
}
