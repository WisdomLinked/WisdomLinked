import { useState, useEffect, useCallback } from "react";
import { adminChatsApi, AdminConversation, AdminMessage } from "@/api/adminApi";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import {
  Search,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  User,
  FileText,
  Settings,
} from "lucide-react";

interface MsgPagination {
  page: number;
  total: number;
  totalPages: number;
}

interface ConvPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function MessageTypeBadge({ type }: { type: AdminMessage["type"] }) {
  if (type === "text") return null;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-muted ml-2">
      {type === "file" ? (
        <FileText className="h-3 w-3" />
      ) : (
        <Settings className="h-3 w-3" />
      )}
      {type}
    </span>
  );
}

function ConversationMessages({
  conversationId,
}: {
  conversationId: string;
}) {
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<MsgPagination>({
    page: 1,
    total: 0,
    totalPages: 0,
  });

  const fetchMessages = useCallback(
    async (page: number) => {
      try {
        setLoading(true);
        const response = await adminChatsApi.getMessages(conversationId, {
          page,
          limit: 20,
        });
        setMessages(response.items);
        setPagination({
          page,
          total: response.pagination.total,
          totalPages: response.pagination.totalPages,
        });
      } catch (error) {
        console.error("Failed to fetch messages:", error);
      } finally {
        setLoading(false);
      }
    },
    [conversationId],
  );

  useEffect(() => {
    fetchMessages(1);
  }, [fetchMessages]);

  if (loading) {
    return (
      <div className="py-4">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {messages.map((msg) => (
        <div key={msg.id} className="p-3 bg-muted/50 rounded border">
          <div className="flex items-center gap-2">
            <User className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm font-medium">{msg.authorUsername}</span>
            <MessageTypeBadge type={msg.type} />
            <span className="text-xs text-muted-foreground ml-auto">
              {new Date(msg.createdAt).toLocaleString()}
            </span>
          </div>
          <p className="text-sm mt-1">{msg.content}</p>
        </div>
      ))}

      {messages.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No messages
        </p>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            disabled={pagination.page === 1}
            onClick={() => fetchMessages(pagination.page - 1)}
          >
            Previous
          </Button>
          <span className="px-3 py-1.5 text-sm">
            {pagination.page} / {pagination.totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={pagination.page === pagination.totalPages}
            onClick={() => fetchMessages(pagination.page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

export function AdminChats() {
  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<ConvPagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await adminChatsApi.listConversations({
        search: search || undefined,
        page: pagination.page,
        limit: pagination.limit,
      });
      setConversations(response.items);
      setPagination((p) => ({
        ...p,
        total: response.pagination.total,
        totalPages: response.pagination.totalPages,
      }));
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    } finally {
      setLoading(false);
    }
  }, [search, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Chat History</h1>
        <p className="text-muted-foreground mt-1">
          View all user conversations (read-only)
        </p>
      </div>

      <div className="grid md:grid-cols-1 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Total Conversations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pagination.total}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by participant username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Conversations ({pagination.total})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {conversations.map((conv) => (
                <div key={conv.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">
                        {conv.participants.join(", ")}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1 truncate">
                        {conv.lastMessagePreview}
                      </p>
                      <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                        <span>
                          {conv.messageCount} message
                          {conv.messageCount !== 1 ? "s" : ""}
                        </span>
                        <span>
                          {new Date(conv.lastMessageAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setExpandedId(
                          expandedId === conv.id ? null : conv.id,
                        )
                      }
                    >
                      {expandedId === conv.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {expandedId === conv.id && (
                    <ConversationMessages conversationId={conv.id} />
                  )}
                </div>
              ))}

              {conversations.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No conversations found
                </div>
              )}
            </div>

            {pagination.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  disabled={pagination.page === 1}
                  onClick={() =>
                    setPagination((p) => ({ ...p, page: p.page - 1 }))
                  }
                >
                  Previous
                </Button>
                <span className="px-4 py-2">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={pagination.page === pagination.totalPages}
                  onClick={() =>
                    setPagination((p) => ({ ...p, page: p.page + 1 }))
                  }
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
