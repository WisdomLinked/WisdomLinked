import {
  type Conversation,
  type ConversationParticipant,
} from "@/atoms/chatAtoms";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/utils/timeUtils";

// ── Helpers ───────────────────────────────────────────────────────────────

export function getOtherParticipant(
  conv: Conversation,
  currentUserId: string,
): ConversationParticipant | null {
  return conv.participants.find((p) => p.userId !== currentUserId) ?? null;
}

// ── OnlineDot ─────────────────────────────────────────────────────────────

interface OnlineDotProps {
  online: boolean;
}

export function OnlineDot({ online }: OnlineDotProps) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full flex-shrink-0",
        online ? "bg-green-500" : "bg-muted-foreground/40",
      )}
      aria-label={online ? "Online" : "Offline"}
    />
  );
}

// ── ConversationItem ──────────────────────────────────────────────────────

export interface ConversationItemProps {
  conv: Conversation;
  currentUserId: string;
  isActive: boolean;
  isOnline: (userId: string) => boolean;
  onSelect: (id: string) => void;
}

export function ConversationItem({
  conv,
  currentUserId,
  isActive,
  isOnline,
  onSelect,
}: ConversationItemProps) {
  const other = getOtherParticipant(conv, currentUserId);
  const displayName = other?.username ?? "Unknown";
  const online = other !== null ? isOnline(other.userId) : false;

  return (
    <button
      type="button"
      className={cn(
        "w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors border-b border-border/50 last:border-b-0",
        isActive && "bg-accent",
      )}
      onClick={() => {
        onSelect(conv.id);
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Avatar placeholder */}
        <div className="relative flex-shrink-0">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <span className="absolute bottom-0 right-0">
            <OnlineDot online={online} />
          </span>
        </div>

        {/* Name + last message */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium truncate">{displayName}</span>
            {conv.lastMessageAt !== null && (
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {formatRelativeTime(conv.lastMessageAt)}
              </span>
            )}
          </div>
          {conv.lastMessage !== null && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {conv.lastMessage}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
