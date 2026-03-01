import { useCallback, useState } from "react";
import { Search, UserPlus } from "lucide-react";

import { friendsApi } from "@/api/friendsApi";
import {
  searchApi,
  type CustomerResult,
  type ExpertResult,
} from "@/api/searchApi";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import { Skeleton } from "@/components/ui/skeleton";

import { getInitials } from "./FriendRow";

// ── Normalised search result ──────────────────────────────────────────────

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

// ── Add Friend Panel ──────────────────────────────────────────────────────

interface AddFriendPanelProps {
  onInvitationSent: () => void;
}

export function AddFriendPanel({ onInvitationSent }: AddFriendPanelProps) {
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
