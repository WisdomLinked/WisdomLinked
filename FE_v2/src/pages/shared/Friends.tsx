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

import {
  friendsApi,
  type FriendInvitation,
  type FriendUser,
} from "@/api/friendsApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePresence } from "@/hooks/usePresence";

import { AddFriendPanel } from "./AddFriendPanel";
import {
  EmptyState,
  FriendRow,
  RowSkeleton,
} from "./FriendRow";
import { ReceivedRow, SentRow } from "./FriendRequestItem";

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
