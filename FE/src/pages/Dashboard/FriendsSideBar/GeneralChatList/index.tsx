import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { useAppSelector } from '../../../../store';
import GeneralChatListItem from './GeneralChatListItem';
import { styled } from '@mui/system';

const MainContainer = styled('div')({
  flexGrow: 1,
  width: '100%',
  margin: '20px 0',
});

const SearchInput = styled('input')({
  width: '100%',
  padding: '10px',
  marginBottom: '20px',
  borderRadius: '5px',
  border: '1px solid #444',
  fontSize: '16px',
  backgroundColor: '#222',
  color: '#fff',
  outline: 'none',
  caretColor: '#00ffff',
  '::placeholder': {
    color: '#888',
  },
});

export default function GeneralChatList({
  variant = 'dark',
}: {
  variant?: 'dark' | 'light';
}) {
  const {
    auth: { userDetails },
  } = useAppSelector((state) => state);
  const [updatedGeneralChats, set_updatedGeneralChats] = useState<any>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    const temp: any[] = [];
    let globalChat: any;
    let adminChat: any;
    let generalChat: any;
    userDetails.generalChats?.forEach((item: any) => {
      const chat = {
        ...item,
        missedChats: userDetails?.missedChats?.[item?._id] || 0,
      };
      if (item.name === 'Global Chat') {
        chat.type = 'global';
        globalChat = chat;
      } else if (item.name === 'Admin') {
        chat.type = 'admin';
        adminChat = chat;
      } else if (item.admin._id === userDetails.userId) {
        chat.type = 'mine';
        generalChat = chat;
      } else {
        temp.push(chat);
      }
    });
    if (generalChat) {
      temp.unshift(generalChat);
    }
    if (globalChat) {
      temp.unshift(globalChat);
    }
    if (adminChat) {
      temp.unshift(adminChat);
    }
    set_updatedGeneralChats([...temp]);
  }, [userDetails]);

  const filteredGeneralChats = updatedGeneralChats.filter((chat: any) =>
    chat.name?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (variant === 'light') {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 px-3 pb-2 pt-1">
          <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-wl-muted">
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
            <input
              type="text"
              placeholder="Search chats…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-xs text-wl-ink outline-none placeholder:text-slate-400"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-3">
          {filteredGeneralChats.map((chat: any) => (
            <GeneralChatListItem
              chat={chat}
              key={chat._id}
              missedChats={chat.missedChats}
              lastChatDate={chat.updatedAt}
              variant="light"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <MainContainer>
      <SearchInput
        type="text"
        placeholder="Search by user name..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {filteredGeneralChats.map((chat: any) => (
        <GeneralChatListItem
          chat={chat}
          key={chat._id}
          missedChats={chat.missedChats}
          lastChatDate={chat.updatedAt}
          variant="dark"
        />
      ))}
    </MainContainer>
  );
}
