import React, { useMemo, useState } from 'react';
import { MessageCircle, Users } from 'lucide-react';

type ChatSummary = {
  id: string;
  title: string;
  type: 'community' | 'private';
  lastMessage: string;
  unread?: number;
};

type ChatMessage = {
  id: string;
  from: 'me' | 'other';
  author: string;
  text: string;
  time: string;
};

const communityChats: ChatSummary[] = [
  {
    id: 'room_ml',
    title: "ML Fellows · Public room",
    type: 'community',
    lastMessage: 'Drop your project updates for tomorrow.',
    unread: 3,
  },
  {
    id: 'room_seminars',
    title: 'Seminar announcements',
    type: 'community',
    lastMessage: 'New session added: AI for healthcare systems.',
  },
];

const privateChats: ChatSummary[] = [
  {
    id: 'dm_chen',
    title: 'Dr. Emily Chen',
    type: 'private',
    lastMessage: 'Let’s lock the time for next week.',
  },
  {
    id: 'dm_ortiz',
    title: 'Prof. Daniel Ortiz',
    type: 'private',
    lastMessage: 'Share your draft before Friday.',
  },
];

const initialMessages: Record<string, ChatMessage[]> = {
  room_ml: [
    {
      id: '1',
      from: 'other',
      author: 'Moderator',
      text: 'Welcome to the ML Fellows room. Share questions and progress here.',
      time: '09:05',
    },
    {
      id: '2',
      from: 'me',
      author: 'You',
      text: 'Does anyone have reading suggestions on transformers for time series?',
      time: '09:12',
    },
  ],
  dm_chen: [
    {
      id: '3',
      from: 'other',
      author: 'Dr. Chen',
      text: 'Share your latest resume before our next call.',
      time: '18:20',
    },
  ],
};

const StudentChat: React.FC = () => {
  const [activeChatId, setActiveChatId] = useState<string>('room_ml');
  const [draft, setDraft] = useState('');
  const [communityQuery, setCommunityQuery] = useState('');
  const [privateQuery, setPrivateQuery] = useState('');
  const [messagesByChat, setMessagesByChat] = useState<Record<string, ChatMessage[]>>(
    initialMessages,
  );

  const allChats = useMemo(
    () => [...communityChats, ...privateChats],
    [],
  );

  const filteredCommunity = useMemo(
    () =>
      communityChats.filter(c => {
        const q = communityQuery.trim().toLowerCase();
        if (!q) return true;
        return (
          c.title.toLowerCase().includes(q) ||
          c.lastMessage.toLowerCase().includes(q)
        );
      }),
    [communityQuery],
  );

  const filteredPrivate = useMemo(
    () =>
      privateChats.filter(c => {
        const q = privateQuery.trim().toLowerCase();
        if (!q) return true;
        return (
          c.title.toLowerCase().includes(q) ||
          c.lastMessage.toLowerCase().includes(q)
        );
      }),
    [privateQuery],
  );

  const activeChat =
    allChats.find(c => c.id === activeChatId) ?? communityChats[0];

  const messages = messagesByChat[activeChatId] ?? [];

  const handleSend = () => {
    if (!draft.trim()) return;
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msg: ChatMessage = {
      id: `${activeChatId}-${now.getTime()}`,
      from: 'me',
      author: 'You',
      text: draft.trim(),
      time,
    };
    setMessagesByChat(prev => ({
      ...prev,
      [activeChatId]: [...(prev[activeChatId] ?? []), msg],
    }));
    setDraft('');
  };

  return (
    <div className="flex h-full bg-wl-chatGold text-slate-900">
      {/* Left: chat list */}
      <aside className="hidden md:flex md:w-80 lg:w-96 flex-col border-r border-slate-200 bg-white">
        <div className="px-4 pt-4 pb-3 border-b border-slate-200">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Shared community chats
          </p>
          <div className="mt-2 rounded-lg bg-slate-100 px-3 py-2 flex items-center gap-2 text-xs text-slate-500">
            <MessageCircle className="h-3.5 w-3.5 text-slate-500 shrink-0" aria-hidden />
            <input
              type="text"
              value={communityQuery}
              onChange={e => setCommunityQuery(e.target.value)}
              placeholder="Search by name or last message…"
              aria-label="Search community chats by title or last message"
              className="flex-1 min-w-0 bg-transparent outline-none text-xs text-slate-700 placeholder:text-slate-400"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          <div>
            {filteredCommunity.length === 0 ? (
              <p className="px-2 py-3 text-[11px] text-slate-500">
                {communityQuery.trim() ? 'No community chats match your search.' : 'No community chats.'}
              </p>
            ) : (
              filteredCommunity.map(chat => {
                const active = chat.id === activeChatId;
                return (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => setActiveChatId(chat.id)}
                    className={`w-full rounded-xl px-3 py-2 text-left text-xs mb-1 flex items-start gap-2 transition-colors ${
                      active ? 'bg-[#E8EEF4] text-slate-900' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="mt-0.5">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-[#234C6A] text-[10px]">
                        <Users className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-semibold text-[11px]">
                          {chat.title}
                        </p>
                        {chat.unread ? (
                          <span className="ml-1 rounded-full bg-emerald-500/20 px-1.5 text-[10px] text-emerald-600">
                            {chat.unread}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500">
                        {chat.lastMessage}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="pt-1 border-t border-slate-200">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Private chats
            </p>
            <div className="rounded-lg bg-slate-100 px-3 py-2 mb-2 flex items-center gap-2 text-xs text-slate-500">
              <MessageCircle className="h-3.5 w-3.5 text-slate-500 shrink-0" aria-hidden />
              <input
                type="text"
                value={privateQuery}
                onChange={e => setPrivateQuery(e.target.value)}
                placeholder="Search by name or last message…"
                aria-label="Search private chats by title or last message"
                className="flex-1 min-w-0 bg-transparent outline-none text-xs text-slate-700 placeholder:text-slate-400"
              />
            </div>
            {filteredPrivate.length === 0 ? (
              <p className="px-2 py-3 text-[11px] text-slate-500">
                {privateQuery.trim() ? 'No private chats match your search.' : 'No private chats.'}
              </p>
            ) : (
              filteredPrivate.map(chat => {
                const active = chat.id === activeChatId;
                return (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => setActiveChatId(chat.id)}
                    className={`w-full rounded-xl px-3 py-2 text-left text-xs mb-1 flex items-start gap-2 transition-colors ${
                      active ? 'bg-[#E8EEF4] text-slate-900' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="mt-0.5">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-[10px] text-white">
                        {chat.title
                          .split(' ')
                          .map(w => w[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-semibold text-[11px]">
                        {chat.title}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500">
                        {chat.lastMessage}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </aside>

      {/* Right: chat window */}
      <section className="flex flex-1 flex-col bg-wl-chatGold">
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-white">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {activeChat.type === 'community' ? 'Community room' : 'Private chat'}
            </p>
            <h2 className="text-sm font-semibold text-slate-900">
              {activeChat.title}
            </h2>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.map(msg => (
            <div
              key={msg.id}
                className={`flex ${msg.from === 'me' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-xs ${
                    msg.from === 'me'
                      ? 'bg-[#234C6A] text-white rounded-br-sm'
                      : 'bg-white text-slate-900 border border-slate-200 rounded-bl-sm'
                  }`}
              >
                <p className="mb-0.5 text-[10px] opacity-80">
                  {msg.author} · {msg.time}
                </p>
                <p className="whitespace-pre-wrap">{msg.text}</p>
              </div>
            </div>
          ))}
          {messages.length === 0 && (
            <p className="mt-10 text-center text-xs text-slate-500">
              No messages yet. Say hello to start the conversation.
            </p>
          )}
        </div>
        <footer className="border-t border-slate-200 px-3 py-2 bg-white">
          <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5">
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="flex-1 bg-transparent text-xs text-slate-900 placeholder:text-slate-400 outline-none"
              placeholder="Type a message…"
            />
            <button
              type="button"
              onClick={handleSend}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#234C6A] text-white text-xs disabled:opacity-50"
              disabled={!draft.trim()}
            >
              ➤
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
};

export default StudentChat;

