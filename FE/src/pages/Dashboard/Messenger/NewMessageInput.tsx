import React, { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../store';
import { callApi } from '../../../api/api';
import { notify } from '../../../utils/notify';
import { addNewMessage, setChatChannelInfo } from '../../../actions/chatActions';
import { getOrCreateDM, sendDirectMessage as apiSendDM, sendGroupMessage as apiSendGroup } from '../../../api/chatApi';
import { sendRoomTyping, connectToRC } from '../../../services/rcRealtime';
import { toRocketChatUsername } from '../../../utils/rocketchatUsername';
import { sanitizeMessageHtml } from '../../../utils/safeMessageHtml';
import type { ReplyDraft } from './ChatDetails';
import ReplyQuoteCard from '../../../components/messenger/ReplyQuoteCard';
import MessageComposer from '../../../components/messenger/MessageComposer';
import { buildReplyQuoteHtml, flattenReplyTextForNextQuote } from '../../../utils/chatReplyLayout';
import { chatDraftKey, clearDraft, readDraft, writeDraft } from '../../../utils/chatDraftStore';
import {
  CHAT_FILE_REQUIREMENTS_MESSAGE,
  CHAT_FILE_SIZE_EXCEEDED_MESSAGE,
  isComposerTextEmpty,
  plainTextToSafeMessageHtml,
} from '../../../utils/chatAttachments';

const DRAFT_SAVE_DEBOUNCE_MS = 400;

const escapeReplyText = (value: string): string =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const cleanReplyExcerpt = (value: string): string =>
  flattenReplyTextForNextQuote(String(value || '').replace(/\s+/g, ' ').trim());

function resolveUploadErrorMessage(response: any): string {
  const raw = String(response?.error || response?.message || '').trim();
  if (!raw) return `Could not upload file. ${CHAT_FILE_REQUIREMENTS_MESSAGE}`;
  if (raw.toLowerCase().includes('file too large')) return CHAT_FILE_SIZE_EXCEEDED_MESSAGE;
  return raw;
}

const NewMessageInput: React.FC<{
  theme?: string;
  replyTo?: ReplyDraft | null;
  onCancelReply?: () => void;
}> = ({ theme = 'dark', replyTo, onCancelReply }) => {
  const [_message, set_message] = useState('');
  const dispatch = useDispatch();

  const {
    chat: { chosenChatDetails, chosenGroupChatDetails, conversationId, rcChannelId },
    auth: { userDetails },
  } = useAppSelector((state) => state);
  const rcTypingName = userDetails?.email ? toRocketChatUsername(userDetails.email) : '';
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentTypingOnRef = useRef(false);
  const typingRoomRef = useRef<string | null>(null);

  const ownerId = userDetails?._id ?? userDetails?.id ?? userDetails?.userId ?? null;
  const draftKey = chatDraftKey(ownerId, chosenChatDetails, chosenGroupChatDetails);

  const messageRef = useRef('');
  messageRef.current = _message;
  const draftKeyRef = useRef<string | null>(null);
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredTextRef = useRef('');

  const stopTypingBroadcast = () => {
    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
    }
    const room = typingRoomRef.current;
    if (sentTypingOnRef.current && room && rcTypingName) {
      sendRoomTyping(room, rcTypingName, false);
    }
    sentTypingOnRef.current = false;
    typingRoomRef.current = null;
  };

  const flushDraft = () => {
    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    }
    writeDraft(draftKeyRef.current, messageRef.current);
  };

  const scheduleDraftSave = () => {
    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    const key = draftKeyRef.current;
    draftSaveTimerRef.current = setTimeout(() => {
      draftSaveTimerRef.current = null;
      writeDraft(key, messageRef.current);
    }, DRAFT_SAVE_DEBOUNCE_MS);
  };

  const onComposerChange = (value: string) => {
    set_message(value);
    messageRef.current = value;
    scheduleDraftSave();
  };

  const onBlur = () => {
    stopTypingBroadcast();
    flushDraft();
  };

  const clearComposer = () => {
    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    }
    set_message('');
    messageRef.current = '';
    restoredTextRef.current = '';
    clearDraft(draftKeyRef.current);
  };

  const ensureConversationId = async (): Promise<string | null> => {
    if (!chosenChatDetails) return null;
    let convId = conversationId;
    if (!convId) {
      const dm = await getOrCreateDM(chosenChatDetails.userId);
      if (dm?.conversationId) {
        convId = dm.conversationId;
        dispatch(
          setChatChannelInfo({
            conversationId: dm.conversationId,
            rcChannelId: dm.rcChannelId ?? null,
          }),
        );
      }
    }
    return convId || null;
  };

  const dispatchOutgoingHtml = async (message: string) => {
    const replyHtml = replyTo
      ? buildReplyQuoteHtml({
          messageId: replyTo.messageId,
          authorNameEscaped: escapeReplyText(replyTo.authorName),
          excerptEscaped: escapeReplyText(cleanReplyExcerpt(replyTo.excerpt)),
        })
      : '';
    const safeMessage = sanitizeMessageHtml(`${replyHtml}${message}`);
    if (!safeMessage.trim()) return;

    if (chosenChatDetails) {
      const convId = await ensureConversationId();
      if (convId) {
        const result = await apiSendDM(convId, safeMessage);
        if (result?.message) dispatch(addNewMessage(result.message));
      }
    }
    if (chosenGroupChatDetails) {
      const result = await apiSendGroup(chosenGroupChatDetails.groupId, safeMessage);
      if (result?.message) dispatch(addNewMessage(result.message));
    }
  };

  const uploadAndSendFile = async (file: File) => {
    const response = await callApi('POST', 'auth/uploadChatFile', { email: userDetails.email }, file);
    if (response?.status !== 'SUCCESS' || !response?.chatFile) {
      throw new Error(resolveUploadErrorMessage(response));
    }
    const message = `Chatfile: ${response.chatFile}#####${response.fileName || file.name}`;
    if (chosenChatDetails) {
      const convId = await ensureConversationId();
      if (convId) {
        const result = await apiSendDM(convId, message);
        if (result?.message) dispatch(addNewMessage(result.message));
      }
    } else if (chosenGroupChatDetails) {
      const result = await apiSendGroup(chosenGroupChatDetails.groupId, message);
      if (result?.message) dispatch(addNewMessage(result.message));
    }
  };

  const handleSend = async ({ text, attachments }: { text: string; attachments: File[] }) => {
    try {
      if (!isComposerTextEmpty(text)) {
        await dispatchOutgoingHtml(plainTextToSafeMessageHtml(text));
      }
      for (const file of attachments) {
        await uploadAndSendFile(file);
      }
      clearComposer();
      onCancelReply?.();
    } catch (e: any) {
      notify.error(resolveUploadErrorMessage(e));
      throw e;
    }
  };

  useEffect(() => {
    if (!rcChannelId || !rcTypingName) return;
    void connectToRC();
  }, [rcChannelId, rcTypingName]);

  useEffect(() => {
    if (!rcChannelId || !rcTypingName) return;
    const plain = _message.trim();

    if (plain) {
      if (_message === restoredTextRef.current) return;
      if (!sentTypingOnRef.current) {
        sendRoomTyping(rcChannelId, rcTypingName, true);
        sentTypingOnRef.current = true;
        typingRoomRef.current = rcChannelId;
      }
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = setTimeout(() => {
        sendRoomTyping(rcChannelId, rcTypingName, false);
        sentTypingOnRef.current = false;
        typingRoomRef.current = null;
        typingStopTimerRef.current = null;
      }, 2000);
    } else {
      if (typingStopTimerRef.current) {
        clearTimeout(typingStopTimerRef.current);
        typingStopTimerRef.current = null;
      }
      if (sentTypingOnRef.current) {
        sendRoomTyping(rcChannelId, rcTypingName, false);
        sentTypingOnRef.current = false;
        typingRoomRef.current = null;
      }
    }
  }, [_message, rcChannelId, rcTypingName]);

  useEffect(() => {
    if (draftKeyRef.current === draftKey) return;

    flushDraft();
    stopTypingBroadcast();

    draftKeyRef.current = draftKey;
    const restored = readDraft(draftKey);
    restoredTextRef.current = restored;
    messageRef.current = restored;
    set_message(restored);
  }, [draftKey]);

  const onUnmountRef = useRef<() => void>(() => {});
  onUnmountRef.current = () => {
    flushDraft();
    stopTypingBroadcast();
  };
  useEffect(() => () => onUnmountRef.current(), []);

  const shellClass =
    theme === 'light'
      ? 'relative w-full border-t border-stone-200 bg-wl-page px-2 py-1.5 sm:px-3'
      : 'relative w-full border-t border-transparent p-4 pb-12 pt-0 sm:pb-4';

  return (
    <div className={shellClass}>
      {replyTo ? (
        <ReplyQuoteCard
          className="mb-1"
          authorName={replyTo.authorName}
          excerpt={replyTo.excerpt}
          variant="composer"
          theme={theme}
          onCancel={onCancelReply}
        />
      ) : null}
      <MessageComposer
        value={_message}
        onTextChange={onComposerChange}
        onBlur={onBlur}
        onSend={handleSend}
        placeholder="Write a message…"
      />
    </div>
  );
};

export default NewMessageInput;
