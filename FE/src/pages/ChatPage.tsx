import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  KeyboardEvent,
  ChangeEvent,
  useRef,
} from 'react';
import {
  MessageSquare,
  Search,
  Paperclip,
  Send,
  MoreVertical,
  Pin,
  Users,
} from 'lucide-react';
import { useDispatch } from 'react-redux';
import { createCommunityChat } from '../api/api';
import { showAlert } from '../actions/alertActions';
import { updateMe } from '../actions/authActions';

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderInitials: string;
  text: string;
  timestamp: string;
  isOwn: boolean;
}

interface ChatItem {
  id: string;
  name: string;
  subtitle: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  type: 'community' | 'private';
  memberCount?: number;
}

type ActiveTab = 'community' | 'private';

const ChatPage: React.FC = () => {
  const dispatch = useDispatch();
  const communityChats: ChatItem[] = [
    {
      id: 'c1',
      name: 'Seminar – 03/21',
      subtitle: 'Community chat',
      lastMessage: 'See you all tomorrow!',
      timestamp: '10:12',
      unreadCount: 2,
      type: 'community',
      memberCount: 24,
    },
    {
      id: 'c2',
      name: 'Product Strategy Q2',
      subtitle: 'Community chat',
      lastMessage: 'Slides are uploaded.',
      timestamp: 'Yesterday',
      unreadCount: 0,
      type: 'community',
      memberCount: 18,
    },
    {
      id: 'c3',
      name: 'Career Growth Circle',
      subtitle: 'Community chat',
      lastMessage: 'Great session everyone',
      timestamp: 'Mon',
      unreadCount: 5,
      type: 'community',
      memberCount: 31,
    },
  ];

  const privateChats: ChatItem[] = [
    {
      id: 'p1',
      name: 'Priya Mehta',
      subtitle: 'Private chat',
      lastMessage: 'Thanks for the session!',
      timestamp: '09:45',
      unreadCount: 1,
      type: 'private',
    },
    {
      id: 'p2',
      name: 'James Carter',
      subtitle: 'Private chat',
      lastMessage: 'Can we reschedule?',
      timestamp: 'Yesterday',
      unreadCount: 0,
      type: 'private',
    },
  ];

  const [allChats, setAllChats] = useState<ChatItem[]>(() => [...communityChats, ...privateChats]);

  const initialMessages: Record<string, ChatMessage[]> = {
    c1: [
      {
        id: 'm1',
        senderId: 'u_priya',
        senderName: 'Priya Mehta',
        senderInitials: 'PM',
        text: 'Hey everyone, don’t forget the session starts at 3pm tomorrow.',
        timestamp: '09:15',
        isOwn: false,
      },
      {
        id: 'm2',
        senderId: 'u_james',
        senderName: 'James Carter',
        senderInitials: 'JC',
        text: 'Thanks for the reminder! Will the recording be available?',
        timestamp: '09:17',
        isOwn: false,
      },
      {
        id: 'm3',
        senderId: 'u_araavind',
        senderName: 'Araavind Subramoniam',
        senderInitials: 'AS',
        text: 'Yes, recordings are posted within 24 hours after the session.',
        timestamp: '09:20',
        isOwn: true,
      },
      {
        id: 'm4',
        senderId: 'u_priya',
        senderName: 'Priya Mehta',
        senderInitials: 'PM',
        text: 'Perfect. See you all tomorrow!',
        timestamp: '09:22',
        isOwn: false,
      },
      {
        id: 'm5',
        senderId: 'u_riya',
        senderName: 'Riya Nair',
        senderInitials: 'RN',
        text: 'Looking forward to it 🙌',
        timestamp: '09:25',
        isOwn: false,
      },
    ],
    c2: [],
    c3: [],
    p1: [],
    p2: [],
  };

  const [activeTab, setActiveTab] = useState<ActiveTab>('community');
  const [selectedChatId, setSelectedChatId] = useState<string | null>('c1');
  const [messageInput, setMessageInput] = useState<string>('');
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>(initialMessages);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [unreadById, setUnreadById] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    allChats.forEach((chat) => {
      map[chat.id] = chat.unreadCount;
    });
    return map;
  });
  const [headerMenuOpen, setHeaderMenuOpen] = useState<boolean>(false);
  const [createOpen, setCreateOpen] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');
  const [newOpenToAll, setNewOpenToAll] = useState<boolean>(true);
  const [creating, setCreating] = useState<boolean>(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const updateIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    updateIsMobile();
    window.addEventListener('resize', updateIsMobile);
    return () => window.removeEventListener('resize', updateIsMobile);
  }, []);

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setMessageInput(e.target.value);
    autoResizeTextarea();
  };

  const handleAttachClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChatId) return;
    const now = new Date();
    const newMessage: ChatMessage = {
      id: `${selectedChatId}-file-${now.getTime()}`,
      senderId: 'current_expert',
      senderName: 'You',
      senderInitials: 'YO',
      text: `Shared a file: ${file.name}`,
      timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isOwn: true,
    };
    setMessages((prev) => ({
      ...prev,
      [selectedChatId]: [...(prev[selectedChatId] ?? []), newMessage],
    }));
    setUnreadById((prev) => ({
      ...prev,
      [selectedChatId]: 0,
    }));
    e.target.value = '';
  };

  const autoResizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxHeight = 4 * 24;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  };

  useEffect(() => {
    autoResizeTextarea();
  }, [selectedChatId]);

  const chatsForTab: ChatItem[] = useMemo(
    () => allChats.filter((chat) => chat.type === activeTab),
    [allChats, activeTab]
  );

  const filteredChats: ChatItem[] = useMemo(() => {
    if (!searchQuery.trim()) return chatsForTab;
    const q = searchQuery.toLowerCase();
    return chatsForTab.filter((chat) => {
      const name = chat.name.toLowerCase();
      const last = chat.lastMessage.toLowerCase();
      const sub = chat.subtitle.toLowerCase();
      return name.includes(q) || last.includes(q) || sub.includes(q);
    });
  }, [chatsForTab, searchQuery]);

  const selectedChat: ChatItem | undefined = useMemo(
    () => allChats.find((chat) => chat.id === (selectedChatId ?? '')),
    [allChats, selectedChatId]
  );

  const selectedChatMessages: ChatMessage[] = useMemo(() => {
    if (!selectedChatId) return [];
    return messages[selectedChatId] ?? [];
  }, [messages, selectedChatId]);

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
  };

  const handleSelectChat = (chatId: string) => {
    setSelectedChatId(chatId);
    setUnreadById((prev) => ({
      ...prev,
      [chatId]: 0,
    }));
  };

  const handleSendMessage = useCallback(() => {
    if (!selectedChatId || !messageInput.trim()) return;

    const now = new Date();
    const newMessage: ChatMessage = {
      id: `${selectedChatId}-${now.getTime()}`,
      senderId: 'current_expert',
      senderName: 'You',
      senderInitials: 'YO',
      text: messageInput.trim(),
      timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isOwn: true,
    };

    setMessages((prev) => ({
      ...prev,
      [selectedChatId]: [...(prev[selectedChatId] ?? []), newMessage],
    }));
    // Own messages should not create unread for this chat
    setUnreadById((prev) => ({
      ...prev,
      [selectedChatId]: 0,
    }));
    setMessageInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [messageInput, selectedChatId]);

  const handleTextareaKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const showListOnlyOnMobile = isMobile && !selectedChatId;
  const showChatOnlyOnMobile = isMobile && !!selectedChatId;

  const handleOpenCreate = () => {
    if (activeTab !== 'community') {
      dispatch(showAlert('Switch to Community tab to create a community chat'));
      return;
    }
    setCreateOpen(true);
  };

  const handleCreateCommunity = async () => {
    if (!newName.trim()) {
      dispatch(showAlert('Community name is required'));
      return;
    }
    setCreating(true);
    try {
      const res: any = await createCommunityChat({
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        isOpenToAll: newOpenToAll,
      });
      if (res?.status === 'SUCCESS') {
        dispatch(showAlert('Community created'));
        const created = (res as any).chat ?? (res as any).groupChat ?? {};
        const newId: string = created._id || created.id || `local-${Date.now()}`;
        const memberCount =
          Array.isArray(created.participants) && created.participants.length
            ? created.participants.length
            : undefined;

        const newChat: ChatItem = {
          id: newId,
          name: newName.trim(),
          subtitle: 'Community chat',
          lastMessage: '',
          timestamp: 'Just now',
          unreadCount: 0,
          type: 'community',
          memberCount,
        };

        setAllChats((prev) => [...prev, newChat]);
        setUnreadById((prev) => ({ ...prev, [newId]: 0 }));
        setMessages((prev) => ({ ...prev, [newId]: [] }));
        setSelectedChatId(newId);

        setCreateOpen(false);
        setNewName('');
        setNewDescription('');
        setNewOpenToAll(true);

        dispatch(updateMe() as any);
      } else {
        dispatch(showAlert(res?.error || 'Failed to create community'));
      }
    } catch (err) {
      dispatch(showAlert('Failed to create community'));
    } finally {
      setCreating(false);
    }
  };

  const renderChatListItem = (chat: ChatItem) => {
    const isActive = chat.id === selectedChatId;
    const initials = chat.name
      .split(' ')
      .map((part) => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');

    return (
      <button
        key={chat.id}
        onClick={() => handleSelectChat(chat.id)}
        className={[
          'w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors border-l-2',
          isActive
            ? 'bg-teal-50 border-l-teal-600'
            : 'bg-white hover:bg-gray-50 border-l-transparent',
        ].join(' ')}
      >
            <div className="flex-shrink-0">
          {chat.type === 'community' ? (
            <div className="h-9 w-9 rounded-full bg-teal-100 flex items-center justify-center text-xs font-semibold text-teal-800">
              <Users className="h-4 w-4" />
            </div>
          ) : (
            <div className="h-9 w-9 rounded-full bg-teal-700 text-white text-xs font-semibold flex items-center justify-center">
              {initials}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-gray-900">{chat.name}</div>
              <div className="text-[11px] text-gray-400">{chat.subtitle}</div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[11px] text-gray-400 whitespace-nowrap">
                {chat.timestamp}
              </span>
              {unreadById[chat.id] > 0 && (
                <span className="inline-flex min-w-[1.25rem] h-5 items-center justify-center rounded-full bg-teal-700 text-[10px] font-semibold text-white px-1">
                  {unreadById[chat.id]}
                </span>
              )}
            </div>
          </div>
          <div className="mt-1 text-[12px] text-gray-400 truncate">{chat.lastMessage}</div>
        </div>
      </button>
    );
  };

  const renderMessages = () => {
    if (!selectedChatId || !selectedChat) return null;

    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-stone-200 bg-wl-page px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSelectedChatId(null)}
              className="mr-1 inline-flex items-center justify-center rounded-full border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 md:hidden"
            >
              ←
            </button>

            <div
              className={
                selectedChat.type === 'community'
                  ? 'hidden md:flex h-10 w-10 items-center justify-center rounded-full bg-[#e8f0f8] text-[#234C6A]'
                  : 'hidden md:flex h-10 w-10 items-center justify-center rounded-full bg-teal-700 text-sm font-semibold text-white'
              }
            >
              {selectedChat.type === 'community' ? (
                <Users className="h-5 w-5" />
              ) : (
                selectedChat.name
                  .split(' ')
                  .map((part) => part.charAt(0).toUpperCase())
                  .slice(0, 2)
                  .join('')
              )}
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-gray-900">
                  {selectedChat.name}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                {selectedChat.type === 'community' && selectedChat.memberCount != null && (
                  <span>{selectedChat.memberCount} members</span>
                )}
                {selectedChat.type === 'private' && <span>Private conversation</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
            >
              <Pin className="h-4 w-4" />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setHeaderMenuOpen((open) => !open)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              {headerMenuOpen && selectedChat && (
                <div className="absolute right-0 mt-2 w-44 rounded-lg border border-gray-200 bg-white py-1 text-xs shadow-md z-20">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-1.5 text-gray-700 hover:bg-gray-50"
                    onClick={() => {
                      setUnreadById((prev) => ({
                        ...prev,
                        [selectedChat.id]: 0,
                      }));
                      setHeaderMenuOpen(false);
                    }}
                  >
                    <span>Mark as read</span>
                  </button>
                  {selectedChat.type === 'community' ? (
                    <>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-1.5 text-gray-700 hover:bg-gray-50"
                        onClick={() => {
                          // placeholder: view members
                          setHeaderMenuOpen(false);
                        }}
                      >
                        <span>View members</span>
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-1.5 text-gray-700 hover:bg-gray-50"
                        onClick={() => {
                          // placeholder: mute
                          setHeaderMenuOpen(false);
                        }}
                      >
                        <span>Mute notifications</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-1.5 text-gray-700 hover:bg-gray-50"
                      onClick={() => {
                        // placeholder: view profile
                        setHeaderMenuOpen(false);
                      }}
                    >
                      <span>View profile</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-wl-page px-4 py-3 md:px-6 md:py-4">
          <div className="mb-4 flex items-center gap-3 text-[11px] text-gray-400">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="uppercase tracking-wide">Today</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <div className="flex flex-col gap-3">
            {selectedChatMessages.map((msg) => (
              <div key={msg.id} className="group flex items-start gap-3">
                <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-700">
                  {msg.senderInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`text-xs font-semibold ${
                      msg.isOwn ? 'text-[#234C6A]' : 'text-gray-900'
                      }`}
                    >
                      {msg.senderName}
                    </span>
                    <span className="text-[11px] text-gray-400">{msg.timestamp}</span>
                  </div>
                  <div className="mt-1 text-sm text-gray-800">{msg.text}</div>
                </div>
                <div className="mt-1 hidden flex-shrink-0 items-center gap-1 text-gray-400 group-hover:flex">
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-gray-100"
                    aria-label="React"
                  >
                    🙂
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-gray-100"
                    aria-label="Reply"
                  >
                    ↩
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-200 bg-white px-3 py-3 md:px-4">
          <div className="flex items-end gap-2">
            <div className="hidden md:flex flex-shrink-0 items-center gap-1 text-gray-400">
              <button
                type="button"
                onClick={handleAttachClick}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100"
              >
                <Paperclip className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
              />
              <textarea
                ref={textareaRef}
                rows={1}
                value={messageInput}
                onChange={handleInputChange}
                onKeyDown={handleTextareaKeyDown}
                className="w-full max-h-32 resize-none rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-[#234C6A] focus:outline-none focus:ring-2 focus:ring-[#234C6A]/10"
                placeholder={
                  selectedChat
                    ? `Message ${selectedChat.name}…`
                    : 'Select a conversation to start messaging…'
                }
                disabled={!selectedChat}
              />
            </div>
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={!selectedChat || !messageInput.trim()}
              className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#234C6A] text-white shadow-sm hover:bg-[#1b3c53] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex md:hidden gap-1 text-gray-400">
            <button
              type="button"
              onClick={handleAttachClick}
              className="inline-flex h-8 px-2 items-center gap-1 rounded-full border border-gray-200 text-xs hover:bg-gray-50"
            >
              <Paperclip className="h-3 w-3" />
              <span>Attach</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderEmptyState = () => (
    <div className="flex h-full flex-col items-center justify-center bg-wl-page px-4 py-8 text-center">
      <div className="mb-4 rounded-full bg-[#e8f0f8] p-4">
        <MessageSquare className="h-8 w-8 text-[#234C6A]" />
      </div>
      <h2 className="text-sm font-semibold text-gray-900">No conversation selected</h2>
      <p className="mt-1 text-sm text-gray-500">
        Choose a chat from the list or start a new one.
      </p>
      <button
        type="button"
        className="mt-4 inline-flex items-center justify-center rounded-md bg-[#234C6A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1b3c53]"
      >
        Browse Communities
      </button>
    </div>
  );

  return (
    <div className="flex h-full w-full bg-white">
      <div
        className={[
          'flex h-full flex-col border-r border-gray-200 bg-white',
          'w-full md:w-80',
          showChatOnlyOnMobile ? 'hidden md:flex' : 'flex',
        ].join(' ')}
      >
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Chats
            </span>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center rounded-md bg-[#234C6A] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#1b3c53]"
            >
              + New
            </button>
          </div>

          <div className="flex gap-1 rounded-full bg-gray-50 p-1 text-xs font-medium text-gray-500">
            <button
              type="button"
              onClick={() => handleTabChange('community')}
              className={[
                'flex-1 rounded-full px-2 py-1 transition-colors',
                activeTab === 'community'
                  ? 'bg-[#234C6A] text-white'
                  : 'text-gray-600 hover:bg-white',
              ].join(' ')}
            >
              Community
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('private')}
              className={[
                'flex-1 rounded-full px-2 py-1 transition-colors',
                activeTab === 'private'
                  ? 'bg-[#234C6A] text-white'
                  : 'text-gray-600 hover:bg-white',
              ].join(' ')}
            >
              Private
            </button>
          </div>

          <div className="mt-3">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-gray-400">
                <Search className="h-3.5 w-3.5" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-gray-200 bg-white py-1.5 pl-7 pr-2 text-xs text-gray-900 placeholder:text-gray-400 focus:border-[#234C6A] focus:outline-none focus:ring-2 focus:ring-[#234C6A]/10"
                placeholder="Search conversations…"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {filteredChats.length === 0 ? (
            <div className="px-2 py-4 text-center text-xs text-gray-400">
              No conversations found.
            </div>
          ) : (
            filteredChats.map(renderChatListItem)
          )}
        </div>
      </div>

      <div
        className={[
          'flex h-full flex-1 flex-col bg-wl-page',
          showListOnlyOnMobile ? 'hidden md:flex' : 'flex',
        ].join(' ')}
      >
        {selectedChatId && selectedChat ? renderMessages() : renderEmptyState()}
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-gray-200 shadow-xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Create community</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Create a new community chat space for your seminars or groups.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50"
              >
                ×
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="mb-1 text-xs font-semibold text-gray-600">Name</div>
                <input
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#234C6A] focus:ring-2 focus:ring-[#234C6A]/20"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Product Strategy Circle"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-gray-600">Description</div>
                <textarea
                  className="w-full min-h-[80px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#234C6A] focus:ring-2 focus:ring-[#234C6A]/20"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="What is this community for?"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={newOpenToAll}
                  onChange={(e) => setNewOpenToAll(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-[#234C6A] focus:ring-[#234C6A]"
                />
                Open to all users
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={creating}
                onClick={handleCreateCommunity}
                className="inline-flex items-center gap-2 rounded-xl bg-[#234C6A] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1b3c53] disabled:opacity-60"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;

