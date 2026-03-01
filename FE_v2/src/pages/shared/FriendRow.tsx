import { UserMinus } from "lucide-react";

import { type FriendUser } from "@/api/friendsApi";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────

export function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

// ── OnlineDot ─────────────────────────────────────────────────────────────

export function OnlineDot({ online }: { online: boolean }) {
  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 rounded-full flex-shrink-0",
        online ? "bg-green-500" : "bg-muted-foreground/40",
      )}
      aria-label={online ? "Online" : "Offline"}
    />
  );
}

// ── RowSkeleton ───────────────────────────────────────────────────────────

export function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-8 w-20" />
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────

import { Users } from "lucide-react";

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3 text-muted-foreground">
      <Users className="h-10 w-10 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ── FriendRow ─────────────────────────────────────────────────────────────

export interface FriendRowProps {
  friend: FriendUser;
  online: boolean;
  removing: boolean;
  onRemove: (id: string) => void;
}

export function FriendRow({
  friend,
  online,
  removing,
  onRemove,
}: FriendRowProps) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-accent/30 transition-colors">
      <div className="relative flex-shrink-0">
        <Avatar className="h-10 w-10">
          <AvatarImage src={friend.image} alt={friend.username} />
          <AvatarFallback>{getInitials(friend.username)}</AvatarFallback>
        </Avatar>
        <span className="absolute bottom-0 right-0">
          <OnlineDot online={online} />
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{friend.username}</p>
        <p className="text-xs text-muted-foreground capitalize">{friend.role}</p>
      </div>

      <span className="text-xs text-muted-foreground hidden sm:block">
        {online ? "Online" : "Offline"}
      </span>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={removing}>
            <UserMinus className="h-4 w-4 mr-1.5" />
            Remove
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Friend</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-semibold">{friend.username}</span> from your
              friends list? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                onRemove(friend.id);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
