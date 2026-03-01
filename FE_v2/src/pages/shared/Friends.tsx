/**
 * Friends — manages friends list, received invitations, and sent invitations.
 *
 * Tabs:
 *   - Friends:  list of current friends with online status + remove (AlertDialog)
 *   - Received: pending incoming invitations (accept / reject)
 *   - Sent:     outgoing invitations with status badge
 *
 * Add Friend panel: search users by username (experts + customers),
 * then send an invitation.
 */

import { useCallback, useEffect, useState } from "react";

import { format } from "date-fns";
import { Check, Search, UserMinus, UserPlus, Users, X } from "lucide-react";

import {
  friendsApi,
  type FriendInvitation,
  type FriendUser,
} from "@/api/friendsApi";
import {
  searchApi,
  type CustomerResult,
  type ExpertResult,
} from "@/api/searchApi";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePresence } from "@/hooks/usePresence";
import { cn } from "@/lib/utils";

// ── Normalised search result ─────────────────────────────────────────────────

interface SearchResultUser {
  id: string;
  username: string;
  image: string | undefined;
  role: string;
}

function normaliseExpert(e: ExpertResult): SearchResultUser {
  return { id: e.id, username: e.username, image: e.image, role: e.role };
}

function normaliseCustomer(c: CustomerResult): SearchResultUser {
  return { id: c.id, username: c.username, image: c.image, role: c.role };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

function formatDate(iso: string): string {
  try {
    return format(new Date(iso), "MMM d, yyyy");
  } catch {
    return iso;
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function OnlineDot({ online }: { online: boolean }) {
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

function RowSkeleton() {
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

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3 text-muted-foreground">
      <Users className="h-10 w-10 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ── Friends tab ───────────────────────────────────────────────────────────────

interface FriendRowProps {
  friend: FriendUser;
  online: boolean;
  removing: boolean;
  onRemove: (id: string) => void;
}

function FriendRow({ friend, online, removing, onRemove }: FriendRowProps) {
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

// ── Received invitations tab ─────────────────────────────────────────────────

interface ReceivedRowProps {
  invitation: FriendInvitation;
  accepting: boolean;
  rejecting: boolean;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}

function ReceivedRow({
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

// ── Sent invitations tab ─────────────────────────────────────────────────────

interface SentRowProps {
  invitation: FriendInvitation;
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

function SentRow({ invitation }: SentRowProps) {
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

// ── Add Friend panel ──────────────────────────────────────────────────────────

interface AddFriendPanelProps {
  onInvitationSent: () => void;
}

function AddFriendPanel({ onInvitationSent }: AddFriendPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (trimmed === "") return;

    setSearching(true);
    setResults([]);

    try {
      const [expertsRes, customersRes] = await Promise.all([
        searchApi.searchExperts({ name: trimmed, limit: 5 }),
        searchApi.searchCustomers({ name: trimmed, limit: 5 }),
      ]);

      const combined: SearchResultUser[] = [
        ...expertsRes.experts.map(normaliseExpert),
        ...customersRes.customers.map(normaliseCustomer),
      ];

      // Deduplicate by id
      const seen = new Set<string>();
      const unique = combined.filter((u) => {
        if (seen.has(u.id)) return false;
        seen.add(u.id);
        return true;
      });

      setResults(unique);
    } catch {
      if (window.toast) {
        window.toast({
          title: "Search failed",
          description: "Could not search users. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setSearching(false);
    }
  }, [query]);

  const handleSend = useCallback(
    async (receiverId: string) => {
      setSendingTo(receiverId);
      try {
        await friendsApi.sendInvitation(receiverId);
        if (window.toast) {
          window.toast({
            title: "Invitation sent",
            description: "Friend invitation sent successfully.",
          });
        }
        onInvitationSent();
        // Remove the user from results after sending
        setResults((prev) => prev.filter((u) => u.id !== receiverId));
      } catch {
        // apiClient interceptor already shows a toast for request errors
      } finally {
        setSendingTo(null);
      }
    },
    [onInvitationSent],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Add Friend
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <SearchInput
            placeholder="Search by username…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            onClear={() => {
              setQuery("");
              setResults([]);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSearch();
              }
            }}
            className="flex-1"
          />
          <Button
            size="sm"
            onClick={() => {
              handleSearch();
            }}
            disabled={searching || query.trim() === ""}
          >
            <Search className="h-4 w-4 mr-1" />
            Search
          </Button>
        </div>

        {searching && (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 py-1">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        )}

        {!searching && results.length > 0 && (
          <div className="divide-y divide-border rounded-md border">
            {results.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/30 transition-colors"
              >
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={user.image} alt={user.username} />
                  <AvatarFallback className="text-xs">
                    {getInitials(user.username)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.username}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {user.role}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={sendingTo === user.id}
                  onClick={() => {
                    handleSend(user.id);
                  }}
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            ))}
          </div>
        )}

        {!searching && results.length === 0 && query.trim() !== "" && (
          <p className="text-sm text-muted-foreground text-center py-3">
            No users found for &ldquo;{query}&rdquo;
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function Friends() {
  const { isOnline } = usePresence();

  // ── Friends list ─────────────────────────────────────────────────────────
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [friendsFilter, setFriendsFilter] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  // ── Received invitations ─────────────────────────────────────────────────
  const [received, setReceived] = useState<FriendInvitation[]>([]);
  const [receivedLoading, setReceivedLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  // ── Sent invitations ─────────────────────────────────────────────────────
  const [sent, setSent] = useState<FriendInvitation[]>([]);
  const [sentLoading, setSentLoading] = useState(true);

  // ── Data loaders ─────────────────────────────────────────────────────────

  const loadFriends = useCallback(async () => {
    setFriendsLoading(true);
    setFriendsError(null);
    try {
      const res = await friendsApi.listFriends();
      setFriends(res.friends);
    } catch {
      setFriendsError("Failed to load friends list.");
    } finally {
      setFriendsLoading(false);
    }
  }, []);

  const loadReceived = useCallback(async () => {
    setReceivedLoading(true);
    try {
      const res = await friendsApi.listInvitations("received");
      setReceived(res.invitations);
    } catch {
      // apiClient interceptor handles the toast
    } finally {
      setReceivedLoading(false);
    }
  }, []);

  const loadSent = useCallback(async () => {
    setSentLoading(true);
    try {
      const res = await friendsApi.listInvitations("sent");
      setSent(res.invitations);
    } catch {
      // apiClient interceptor handles the toast
    } finally {
      setSentLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFriends();
    loadReceived();
    loadSent();
  }, [loadFriends, loadReceived, loadSent]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleRemoveFriend = useCallback(
    async (friendId: string) => {
      setRemovingId(friendId);
      try {
        await friendsApi.removeFriend(friendId);
        if (window.toast) {
          window.toast({ title: "Friend removed" });
        }
        await loadFriends();
      } catch {
        // apiClient interceptor handles the toast
      } finally {
        setRemovingId(null);
      }
    },
    [loadFriends],
  );

  const handleAccept = useCallback(
    async (invitationId: string) => {
      setAcceptingId(invitationId);
      try {
        await friendsApi.acceptInvitation(invitationId);
        if (window.toast) {
          window.toast({
            title: "Invitation accepted",
            description: "You are now friends!",
          });
        }
        await Promise.all([loadFriends(), loadReceived()]);
      } catch {
        // apiClient interceptor handles the toast
      } finally {
        setAcceptingId(null);
      }
    },
    [loadFriends, loadReceived],
  );

  const handleReject = useCallback(
    async (invitationId: string) => {
      setRejectingId(invitationId);
      try {
        await friendsApi.rejectInvitation(invitationId);
        if (window.toast) {
          window.toast({ title: "Invitation rejected" });
        }
        await loadReceived();
      } catch {
        // apiClient interceptor handles the toast
      } finally {
        setRejectingId(null);
      }
    },
    [loadReceived],
  );

  // ── Derived ───────────────────────────────────────────────────────────────

  const filteredFriends = friends.filter((f) =>
    f.username.toLowerCase().includes(friendsFilter.toLowerCase()),
  );

  const pendingReceived = received.filter((i) => i.status === "pending");

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Friends</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your connections and invitations.
        </p>
      </div>

      {/* Add Friend panel */}
      <AddFriendPanel onInvitationSent={loadSent} />

      <Separator />

      {/* Tabs */}
      <Tabs defaultValue="friends">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="friends" className="flex-1 sm:flex-none">
            Friends
            {friends.length > 0 && (
              <span className="ml-1.5 text-xs opacity-60">({friends.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="received" className="flex-1 sm:flex-none">
            Received
            {pendingReceived.length > 0 && (
              <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                {pendingReceived.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent" className="flex-1 sm:flex-none">
            Sent
            {sent.length > 0 && (
              <span className="ml-1.5 text-xs opacity-60">({sent.length})</span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Friends tab ── */}
        <TabsContent value="friends" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {/* Search bar */}
              <div className="p-4 border-b">
                <SearchInput
                  placeholder="Filter by username…"
                  value={friendsFilter}
                  onChange={(e) => {
                    setFriendsFilter(e.target.value);
                  }}
                  onClear={() => {
                    setFriendsFilter("");
                  }}
                />
              </div>

              {/* List */}
              {friendsLoading ? (
                <div className="divide-y divide-border">
                  {Array.from({ length: 4 }, (_, i) => (
                    <RowSkeleton key={i} />
                  ))}
                </div>
              ) : friendsError !== null ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground">
                  <p className="text-sm text-destructive">{friendsError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      loadFriends();
                    }}
                  >
                    Retry
                  </Button>
                </div>
              ) : filteredFriends.length === 0 ? (
                <EmptyState
                  message={
                    friendsFilter !== ""
                      ? `No friends matching "${friendsFilter}"`
                      : "You have no friends yet. Send an invitation above!"
                  }
                />
              ) : (
                <div className="divide-y divide-border">
                  {filteredFriends.map((friend) => (
                    <FriendRow
                      key={friend.id}
                      friend={friend}
                      online={isOnline(friend.id)}
                      removing={removingId === friend.id}
                      onRemove={handleRemoveFriend}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Received tab ── */}
        <TabsContent value="received" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {receivedLoading ? (
                <div className="divide-y divide-border">
                  {Array.from({ length: 3 }, (_, i) => (
                    <RowSkeleton key={i} />
                  ))}
                </div>
              ) : pendingReceived.length === 0 ? (
                <EmptyState message="No pending invitations." />
              ) : (
                <div className="divide-y divide-border">
                  {pendingReceived.map((inv) => (
                    <ReceivedRow
                      key={inv.id}
                      invitation={inv}
                      accepting={acceptingId === inv.id}
                      rejecting={rejectingId === inv.id}
                      onAccept={handleAccept}
                      onReject={handleReject}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Sent tab ── */}
        <TabsContent value="sent" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {sentLoading ? (
                <div className="divide-y divide-border">
                  {Array.from({ length: 3 }, (_, i) => (
                    <RowSkeleton key={i} />
                  ))}
                </div>
              ) : sent.length === 0 ? (
                <EmptyState message="No invitations sent yet." />
              ) : (
                <div className="divide-y divide-border">
                  {sent.map((inv) => (
                    <SentRow key={inv.id} invitation={inv} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
