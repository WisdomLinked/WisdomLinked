import React from 'react';
import Messenger from './Dashboard/Messenger/Messenger';
import GeneralChatList from './Dashboard/FriendsSideBar/GeneralChatList';

/**
 * Admin chat: same shell as expert ModernChat — light panel + Messenger theme="light".
 */
export default function AdminChat() {
  return (
    <div className="h-[calc(100vh-56px)] bg-wl-chatGold overflow-hidden">
      <div className="flex h-full">
        <aside className="hidden md:flex md:w-80 lg:w-96 shrink-0 flex-col border-r border-wl-line bg-wl-card shadow-[1px_0_0_rgba(35,76,106,0.06)]">
          <div className="shrink-0 border-b border-wl-line px-4 pt-4 pb-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-wl-muted">
              Chats
            </p>
            <p className="mt-1 text-[13px] font-medium text-wl-ink">Shared community chats</p>
            <p className="mt-0.5 text-[11px] text-wl-muted leading-snug">
              Open a room to message. Search to filter the list.
            </p>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <GeneralChatList variant="light" />
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <Messenger videoChaton={false} theme="light" />
        </main>
      </div>
    </div>
  );
}
