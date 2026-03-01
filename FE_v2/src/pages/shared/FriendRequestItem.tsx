import { format } from "date-fns";
import { Check, X } from "lucide-react";

import { type FriendInvitation } from "@/api/friendsApi";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { getInitials } from "./FriendRow";

// ── Helpers ───────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return format(new Date(iso), "MMM d, yyyy");
  } catch {
    return iso;
  }
}

function statusBadgeVariant(
  status: FriendInvitation["status"],
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "accepted") return "default";
  if (status === "rejected") return "destructive";
  return "secondary";
}

function statusLabel(status: FriendInvitation["status"]): string {
  if (status === "accepted") return "Accepted";
  if (status === "rejected") return "Rejected";
  return "Pending";
}

// ── ReceivedRow ───────────────────────────────────────────────────────────

export interface ReceivedRowProps {
  invitation: FriendInvitation;
  accepting: boolean;
  rejecting: boolean;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}

export function ReceivedRow({
  invitation,
  accepting,
  rejecting,
  onAccept,
  onReject,
}: ReceivedRowProps) {
  const busy = accepting || rejecting;
  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-accent/30 transition-colors">
      <Avatar className="h-10 w-10 flex-shrink-0">
        <AvatarImage
          src={invitation.sender.image}
          alt={invitation.sender.username}
        />
        <AvatarFallback>{getInitials(invitation.sender.username)}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">
          {invitation.sender.username}
        </p>
        <p className="text-xs text-muted-foreground">
          Sent {formatDate(invitation.createdAt)}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          size="sm"
          disabled={busy}
          onClick={() => {
            onAccept(invitation.id);
          }}
        >
          <Check className="h-4 w-4 mr-1" />
          Accept
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => {
            onReject(invitation.id);
          }}
        >
          <X className="h-4 w-4 mr-1" />
          Reject
        </Button>
      </div>
    </div>
  );
}

// ── SentRow ───────────────────────────────────────────────────────────────

export interface SentRowProps {
  invitation: FriendInvitation;
}

export function SentRow({ invitation }: SentRowProps) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-accent/30 transition-colors">
      <Avatar className="h-10 w-10 flex-shrink-0">
        <AvatarImage
          src={invitation.receiver.image}
          alt={invitation.receiver.username}
        />
        <AvatarFallback>
          {getInitials(invitation.receiver.username)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">
          {invitation.receiver.username}
        </p>
        <p className="text-xs text-muted-foreground">
          Sent {formatDate(invitation.createdAt)}
        </p>
      </div>

      <Badge variant={statusBadgeVariant(invitation.status)}>
        {statusLabel(invitation.status)}
      </Badge>
    </div>
  );
}
