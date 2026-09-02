import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Tooltip } from '@mui/material';
import { setChosenGroupChatDetails } from '../../../../actions/chatActions';
import { useAppSelector } from '../../../../store';
import { formatDate } from '../../../../actions/common';
import InboxIcon from '@mui/icons-material/MoveToInbox';
import typing_image from '../../../../assets/images/typing.gif';

const GeneralChatListItem = ({
  chat,
  clickHandler,
  isActive,
  missedChats,
  lastChatDate,
  variant = 'dark',
}: {
  chat: any;
  clickHandler?: () => void;
  isActive?: boolean;
  missedChats?: number;
  lastChatDate?: string;
  variant?: 'dark' | 'light';
}) => {
  const dispatch = useDispatch();

  const {
    chat: { chosenGroupChatDetails, groupTyping },
    auth: { userDetails },
  } = useAppSelector((state) => state);
  const isChatActive = clickHandler ? isActive : chosenGroupChatDetails?.groupId === chat?._id;

  const [typingUsers, set_typingUsers] = React.useState<any[]>([]);
  useEffect(() => {
    const typing = groupTyping.find((item) => item.chatId === chat?._id);
    const temp: any[] = [];
    if (typing) {
      for (const x in typing) {
        if (typing[x] === true && x !== userDetails.userId) {
          temp.push(x);
        }
      }
    }
    set_typingUsers([...temp]);
  }, [groupTyping, chat?._id, userDetails.userId]);

  const onClick = () => {
    if (clickHandler) {
      clickHandler();
    } else {
      dispatch(
        setChosenGroupChatDetails({
          ...chat,
          groupId: chat?._id,
          groupName: chat.name,
        }),
      );
      dispatch({
        type: 'updateMissedChatsOfGeneralChat',
        payload: { receiverId: chat._id, count: 0 },
      });
    }
  };

  const iconAccentLight =
    chat.type === 'admin'
      ? 'border border-brownyellow/40 bg-amber-50 text-brownyellow'
      : chat.type === 'global'
        ? 'border border-wl-brand/25 bg-wl-brandSoft text-wl-brand'
        : chat.type === 'mine'
          ? 'border border-green/35 bg-emerald-50 text-green'
          : 'border border-wl-line bg-slate-100 text-wl-muted';

  if (variant === 'light') {
    return (
      <Tooltip title={chat.groupName || chat.name}>
        <button
          type="button"
          onClick={onClick}
          className={`relative flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
            isChatActive
              ? 'bg-wl-brandSoft shadow-sm ring-1 ring-wl-brand/20'
              : 'hover:bg-slate-100'
          } ${chat.admin?.status === 'review' ? 'opacity-60' : ''}`}
        >
          <div
            title={chat.admin?.status === 'review' ? 'Chat admin is under review' : ''}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconAccentLight}`}
          >
            <InboxIcon style={{ fontSize: 18 }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <span className="truncate text-[12px] font-semibold text-wl-ink">
                {chat.name} {chat.type === 'mine' && '(Me)'}
              </span>
              {lastChatDate ? (
                <span className="shrink-0 text-[10px] text-wl-muted">
                  {formatDate(new Date(lastChatDate))}
                </span>
              ) : null}
            </div>
            <div className="mt-1 flex items-center justify-end gap-2">
              {!isChatActive && typingUsers.length ? (
                <img src={typing_image} className="h-7 w-auto" alt="" />
              ) : null}
              {missedChats ? (
                <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-semibold text-white shadow-sm">
                  {missedChats}
                </span>
              ) : null}
            </div>
          </div>
        </button>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={chat.groupName || chat.name}>
      <button
        type="button"
        onClick={onClick}
        className={`relative mt-0 flex w-full items-center space-x-4 rounded-md px-2 py-[6px] ${
          isChatActive ? 'bg-darkgrey-1' : 'hover:bg-darkgrey-1'
        } ${
          chat.type === 'admin'
            ? 'text-brownyellow'
            : chat.type === 'global'
              ? 'text-blue'
              : chat.type === 'mine'
                ? 'text-green'
                : 'text-lightgrey'
        }`}
      >
        <div
          title={chat.admin?.status === 'review' ? 'Chat admin is under review' : ''}
          className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
            chat.type === 'admin'
              ? 'border-brownyellow'
              : chat.type === 'global'
                ? 'border-blue'
                : chat.type === 'mine'
                  ? 'border-green'
                  : 'border-lightgrey'
          } ${chat.admin?.status === 'review' ? 'opacity-50' : ''}`}
        >
          <InboxIcon fontSize="small" />
        </div>
        <div className="w-[calc(100%-50px)]">
          <div className="text-md w-full truncate text-left">
            {chat.name} {chat.type === 'mine' && '(Me)'}
          </div>
        </div>
        <div className="absolute right-0 top-0 flex h-full w-[100px] flex-col justify-between py-2 pr-2">
          <div className="flex items-center justify-end space-x-2">
            {!isChatActive && typingUsers.length ? (
              <img src={typing_image} className="w-[35px]" alt="" />
            ) : null}
            {missedChats ? (
              <div className="rounded-full bg-red px-1.5 text-sm text-lightgrey drop-shadow-md">
                {missedChats}
              </div>
            ) : null}
          </div>
          {lastChatDate ? (
            <div className="rounded-full px-1 text-right text-[12px] font-thin text-grey">
              {formatDate(new Date(lastChatDate))}
            </div>
          ) : null}
        </div>
      </button>
    </Tooltip>
  );
};

export default GeneralChatListItem;
