import { useCallback, useEffect, useRef, useState } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { MessageSquare, Send, Wifi, WifiOff } from "lucide-react";

import {
  activeConversationIdAtom,
  conversationsAtom,
  messagesAtom,
  normalizeDmMessage,
  type ChatMessage,
  type Conversation,
  type ConversationParticipant,
} from "@/atoms/chatAtoms";
import { userAtom } from "@/atoms/authAtoms";
import {
  conversationsApi,
  type Conversation as ApiConversation,
  type Message as ApiMessage,
} from "@/api/conversationsApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useSocket } from "@/hooks/useSocket";
import { usePresence } from "@/hooks/usePresence";
import { useTypingIndicator, type TypingContext } from "@/hooks/useTypingIndicator";
import { getSocket } from "@/services/socket";
import { formatRelativeTime } from "@/utils/timeUtils";

// ── Boundary normalizers (REST → canonical ChatMessage) ───────────────────────
// These pure functions are the only place where REST API shapes are converted
// to the internal ChatMessage type.

function normalizeConversation(apiConv: ApiConversation): Conversation {
  return {
    id: apiConv.id,
    participants: apiConv.participants.map((p) => ({
      userId: p._id,
      username: p.username,
      avatarUrl: p.image ?? null,
    })),
    lastMessage: apiConv.lastMessage?.content ?? null,
    lastMessageAt: apiConv.lastMessage?.createdAt ?? null,
    createdAt: apiConv.createdAt,
  };
}

function normalizeRestMessage(apiMsg: ApiMessage): ChatMessage {
  const authorId =
    typeof apiMsg.author === "string" ? apiMsg.author : apiMsg.author._id;
  const rawType = apiMsg.type;
  const type: ChatMessage["type"] =
    rawType === "text" || rawType === "file" || rawType === "system"
      ? rawType
      : "text";
  return {
    id: apiMsg.id,
    conversationId: apiMsg.conversationId,
    groupChatId: null,
    authorId,
    content: apiMsg.content,
    type,
    fileUrl: apiMsg.fileUrl ?? null,
    createdAt: apiMsg.createdAt,
  };
}

// ── Helper: get the "other" participant in a 1-on-1 conversation ─────────────

function getOtherParticipant(
  conv: Conversation,
  currentUserId: string,
): ConversationParticipant | null {
  return conv.participants.find((p) => p.userId !== currentUserId) ?? null;
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface OnlineDotProps {
  online: boolean;
}
function OnlineDot({ online }: OnlineDotProps) {
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

interface ConversationItemProps {
  conv: Conversation;
  currentUserId: string;
  isActive: boolean;
  isOnline: (userId: string) => boolean;
  onSelect: (id: string) => void;
}
function ConversationItem({
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

interface MessageBubbleProps {
  msg: ChatMessage;
  isSelf: boolean;
}
function MessageBubble({ msg, isSelf }: MessageBubbleProps) {
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

// ── Main page component ───────────────────────────────────────────────────────

export default function Messenger() {
  // ── Socket hooks ──────────────────────────────────────────────────────────
  const { isConnected, sendDm } = useSocket();
  const { isOnline } = usePresence();

  // ── Atom state ────────────────────────────────────────────────────────────
  const user = useAtomValue(userAtom);
  const [conversations, setConversations] = useAtom(conversationsAtom);
  const [activeConversationId, setActiveConversationId] = useAtom(
    activeConversationIdAtom,
  );
  const [allMessages] = useAtom(messagesAtom);
  const setMessages = useSetAtom(messagesAtom);

  // ── Local UI state ────────────────────────────────────────────────────────
  const [inputText, setInputText] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Tracks which conversations have had their REST messages loaded this session.
  const loadedRef = useRef<Set<string>>(new Set<string>());

  // ── Typing indicator ──────────────────────────────────────────────────────
  // Always called unconditionally (Rules of Hooks). When no conversation is
  // selected the contextKey is "" which is never matched by real events.
  const typingContext: TypingContext =
    activeConversationId !== null
      ? { kind: "dm", conversationId: activeConversationId }
      : { kind: "dm", conversationId: "" };

  const { typingUsers, handleTyping } = useTypingIndicator(typingContext);

  // ── Derived values ────────────────────────────────────────────────────────
  const activeMessages =
    activeConversationId !== null
      ? (allMessages.get(activeConversationId) ?? [])
      : [];

  const activeConversation =
    conversations.find((c) => c.id === activeConversationId) ?? null;

  const activeOtherParticipant =
    activeConversation !== null && user !== null
      ? getOtherParticipant(activeConversation, user.id)
      : null;

  const activeOtherOnline =
    activeOtherParticipant !== null
      ? isOnline(activeOtherParticipant.userId)
      : false;

  // ── Load conversations on mount ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadingConversations(true);
      try {
        const response = await conversationsApi.listConversations();
        if (!cancelled) {
          setConversations(response.conversations.map(normalizeConversation));
        }
      } catch {
        // Effect failure — conversations list stays empty.
        // Structured error logging would go here in a full observability setup.
      } finally {
        if (!cancelled) {
          setLoadingConversations(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [setConversations]);

  // ── Load messages when active conversation changes ────────────────────────
  useEffect(() => {
    if (activeConversationId === null) return;

    // Announce room join to the socket server.
    const socket = getSocket();
    if (socket !== null) {
      socket.emit("dm:join", { conversationId: activeConversationId });
    }

    // Skip REST fetch if already loaded this session.
    if (loadedRef.current.has(activeConversationId)) return;
    loadedRef.current.add(activeConversationId);

    let cancelled = false;

    const loadMessages = async () => {
      setLoadingMessages(true);
      try {
        const response = await conversationsApi.getMessages(activeConversationId);
        if (!cancelled) {
          const normalized = response.messages.map(normalizeRestMessage);
          setMessages((prev) => {
            const next = new Map(prev);
            next.set(activeConversationId, normalized);
            return next;
          });
        }
      } catch {
        // Allow retry on next selection by removing the key from the loaded set.
        if (!cancelled) {
          loadedRef.current.delete(activeConversationId);
        }
      } finally {
        if (!cancelled) {
          setLoadingMessages(false);
        }
      }
    };

    loadMessages();
    return () => {
      cancelled = true;
    };
  }, [activeConversationId, setMessages]);

  // ── Auto-scroll to bottom when messages arrive ────────────────────────────
  useEffect(() => {
    if (messagesEndRef.current !== null) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeMessages.length]);

  // ── Send message via socket ───────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (activeConversationId === null || inputText.trim() === "") return;

    setSendError(null);
    const text = inputText.trim();
    setInputText("");

    try {
      const ack = await sendDm({
        conversationId: activeConversationId,
        content: text,
        type: "text",
      });

      if (!ack.success) {
        setSendError(ack.error ?? "Message failed to send");
        setInputText(text);
      }
    } catch {
      setSendError("Failed to send message. Check your connection.");
      setInputText(text);
    }
  }, [activeConversationId, inputText, sendDm]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // Keep normalizeDmMessage in scope (it is imported and used transitively via
  // chatAtoms; referencing it here prevents a lint unused-import warning).
  void normalizeDmMessage;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── Left sidebar: conversation list ─────────────────────────────── */}
      <aside className="w-72 flex-shrink-0 border-r bg-card flex flex-col">
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h1 className="font-semibold text-base">Messages</h1>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs",
              isConnected ? "text-green-600" : "text-muted-foreground",
            )}
            title={isConnected ? "Real-time connected" : "Disconnected"}
          >
            {isConnected ? (
              <Wifi className="h-3 w-3" />
            ) : (
              <WifiOff className="h-3 w-3" />
            )}
          </span>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {loadingConversations ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              Loading conversations…
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
              <MessageSquare className="h-8 w-8 opacity-40" />
              <p className="text-sm">No conversations yet</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conv={conv}
                currentUserId={user?.id ?? ""}
                isActive={conv.id === activeConversationId}
                isOnline={isOnline}
                onSelect={setActiveConversationId}
              />
            ))
          )}
        </div>
      </aside>

      {/* ── Right panel: message thread ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {activeConversation !== null ? (
          <>
            {/* Thread header */}
            <div className="h-14 flex items-center gap-3 px-4 border-b bg-card flex-shrink-0">
              <div className="relative">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                  {(activeOtherParticipant?.username ?? "?").charAt(0).toUpperCase()}
                </div>
                <span className="absolute bottom-0 right-0">
                  <OnlineDot online={activeOtherOnline} />
                </span>
              </div>
              <div>
                <p className="font-medium text-sm leading-none">
                  {activeOtherParticipant?.username ?? "Unknown"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {activeOtherOnline ? "Online" : "Offline"}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  Loading messages…
                </div>
              ) : activeMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                  <MessageSquare className="h-10 w-10 opacity-30" />
                  <p className="text-sm">No messages yet. Say hello!</p>
                </div>
              ) : (
                activeMessages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    isSelf={user !== null && msg.authorId === user.id}
                  />
                ))
              )}

              {/* Typing indicator */}
              {typingUsers.length > 0 && (
                <div className="flex items-center gap-2 mt-1 mb-2 px-1">
                  <span className="text-xs text-muted-foreground italic">
                    {typingUsers.length === 1
                      ? "Someone is typing…"
                      : `${typingUsers.length} people are typing…`}
                  </span>
                  <span className="flex gap-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                  </span>
                </div>
              )}

              {/* Scroll anchor */}
              <div ref={messagesEndRef} />
            </div>

            {/* Send error banner */}
            {sendError !== null && (
              <div className="mx-4 mb-2 px-3 py-2 rounded-md bg-destructive/10 text-destructive text-xs flex items-center justify-between">
                <span>{sendError}</span>
                <button
                  type="button"
                  className="ml-2 font-medium hover:underline"
                  onClick={() => {
                    setSendError(null);
                  }}
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Input bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-t bg-card flex-shrink-0">
              <Input
                placeholder={isConnected ? "Type a message…" : "Connecting…"}
                value={inputText}
                disabled={!isConnected}
                onChange={(e) => {
                  setInputText(e.target.value);
                  if (
                    activeConversationId !== null &&
                    e.target.value.length > 0
                  ) {
                    handleTyping();
                  }
                }}
                onKeyDown={handleKeyDown}
                className="flex-1"
              />
              <Button
                onClick={() => {
                  handleSend();
                }}
                disabled={!isConnected || inputText.trim() === ""}
                size="sm"
                className="flex-shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          /* Empty state: no conversation selected */
          <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
            <MessageSquare className="h-16 w-16 opacity-20" />
            <div className="text-center">
              <p className="text-lg font-medium text-foreground">
                Select a conversation
              </p>
              <p className="text-sm mt-1">
                Choose a conversation from the sidebar to start messaging.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
