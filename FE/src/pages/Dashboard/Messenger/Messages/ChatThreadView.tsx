import React, { useMemo } from 'react';
import type { Message as MessageModel } from '../../../../actions/types';
import { formatDividerDate, formatMessageTime } from '../../../../utils/formatMessageTime';
import Message from './Message';
import MeetingCard from '../../../../components/MeetingCard';
import ChatSystemNotice from './ChatSystemNotice';
import { parseMeetingMessageContent } from '../../../../utils/meetingMessage';
import { groupMessages } from './groupMessages';
import type { ChatMessage, MessageGroup } from './chatThreadTypes';
import type { ReplyDraft } from '../ChatDetails';

type DisplayMessage = MessageModel & { type?: string };

export type ChatThreadViewProps = {
    displayMessages: DisplayMessage[];
    theme: string;
    isOutgoingMessage: (message: DisplayMessage) => boolean;
    deliveryForMessage: (message: DisplayMessage) => 'sending' | 'sent' | 'delivered' | 'seen' | undefined;
    groupSenderLabel: (message: DisplayMessage) => string;
    chosenGroupChatDetails: unknown;
    chosenChatDetails: unknown;
    profileImages: Map<string, string>;
    userDetails: { _id?: string; id?: string; userId?: string; role?: string; status?: string };
    friends: Array<{ _id?: string }>;
    handleDeleteMessage: (messageId: string, mode: 'me' | 'both') => Promise<void>;
    onReplyMessage?: (reply: ReplyDraft) => void;
    rcChannelId: string | null;
    conversationId: string | null;
    myRcUserId: string | null;
};

type BubbleTimelineItem = {
    kind: 'bubble';
    group: MessageGroup;
    sources: DisplayMessage[];
};

type TimelineItem =
    | { kind: 'date'; date: Date }
    | { kind: 'system'; message: DisplayMessage }
    | {
          kind: 'meeting-started';
          message: DisplayMessage;
          meeting: Extract<ReturnType<typeof parseMeetingMessageContent>, { type: 'started' }>;
      }
    | {
          kind: 'meeting-ended';
          message: DisplayMessage;
          meeting: Extract<ReturnType<typeof parseMeetingMessageContent>, { type: 'ended' }>;
      }
    | { kind: 'legacy'; message: DisplayMessage }
    | BubbleTimelineItem;

function calendarDayKey(d: Date): string {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function isLegacyStandaloneContent(content: string): boolean {
    const c = String(content || '');
    if (c.startsWith('Chatfile: ')) return true;
    return c.startsWith('Call Lasted for:') || c.startsWith('Seminar Lasted for:');
}

function initialsFromLabel(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
        const a = parts[0].charAt(0);
        const b = parts[parts.length - 1].charAt(0);
        return `${a}${b}`.toUpperCase();
    }
    if (parts.length === 1 && parts[0].length >= 2) {
        return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0]?.charAt(0) || '?').toUpperCase();
}

function stripMessageText(raw: string): string {
    if (typeof document === 'undefined') {
        return raw
            .replace(/<blockquote\b[^>]*>[\s\S]*?<\/blockquote>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    const node = document.createElement('div');
    node.innerHTML = raw;
    node.querySelectorAll('blockquote').forEach((quote) => quote.remove());
    return (node.textContent || node.innerText || '')
        .replace(/\bReplying to\s+(You|[\w\s.@-]+)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function replyDraftFromMessage(message: DisplayMessage, authorName: string): ReplyDraft {
    const text = stripMessageText(String(message.content || ''));
    return {
        messageId: String(message._id),
        authorName: authorName || 'Message',
        excerpt: text.length > 140 ? `${text.slice(0, 140)}...` : text,
    };
}

function toChatMessage(
    src: DisplayMessage,
    delivery: 'sending' | 'sent' | 'delivered' | 'seen' | undefined,
): ChatMessage {
    let status: ChatMessage['status'];
    if (delivery === 'seen') status = 'read';
    else if (delivery === 'delivered') status = 'delivered';
    else if (delivery === 'sent' || delivery === 'sending') status = 'sent';

    return {
        id: String(src._id),
        senderId: String(src.author._id),
        content: String(src.content ?? ''),
        timestamp: new Date(src.createdAt),
        status,
    };
}

function bubbleShellClass(isSelf: boolean, index: number, n: number): string {
    if (isSelf) {
        const base = 'bg-[#1A3A4A] text-white ';
        return `${base}rounded-2xl`;
    }
    const base = 'bg-white border border-gray-200 text-gray-900 ';
    return `${base}rounded-2xl`;
}

function marginAfterBubble(cur: BubbleTimelineItem, next: TimelineItem | undefined): string {
    if (!next) return '';
    if (next.kind === 'bubble') {
        return cur.group.isSelf === next.group.isSelf ? 'mb-1' : 'mb-3';
    }
    return 'mb-2';
}

function marginAfterNonBubble(next: TimelineItem | undefined): string {
    if (!next) return '';
    return 'mb-2';
}

function buildTimeline(
    displayMessages: DisplayMessage[],
    selfSenderIds: ReadonlySet<string>,
    isOutgoingMessage: (m: DisplayMessage) => boolean,
    deliveryForMessage: (m: DisplayMessage) => 'sending' | 'sent' | 'delivered' | 'seen' | undefined,
): TimelineItem[] {
    const timeline: TimelineItem[] = [];
    let buffer: DisplayMessage[] = [];
    let lastDayKey: string | null = null;

    const flushBuffer = () => {
        if (buffer.length === 0) return;
        const chatMsgs = buffer.map((src) => toChatMessage(src, deliveryForMessage(src)));
        const groups = groupMessages(chatMsgs, selfSenderIds);
        let offset = 0;
        for (const g of groups) {
            const sources = buffer.slice(offset, offset + g.messages.length);
            offset += g.messages.length;
            timeline.push({ kind: 'bubble', group: g, sources });
        }
        buffer = [];
    };

    for (const message of displayMessages) {
        const created = new Date(message.createdAt);
        const dayKey = calendarDayKey(created);
        if (lastDayKey !== dayKey) {
            flushBuffer();
            timeline.push({ kind: 'date', date: created });
            lastDayKey = dayKey;
        }

        if (message.type === 'wl-community-sys') {
            flushBuffer();
            timeline.push({ kind: 'system', message });
            continue;
        }

        const meetingData = parseMeetingMessageContent(String(message.content || ''));
        if (meetingData?.type === 'started') {
            flushBuffer();
            timeline.push({ kind: 'meeting-started', message, meeting: meetingData });
            continue;
        }
        if (meetingData?.type === 'ended') {
            flushBuffer();
            timeline.push({ kind: 'meeting-ended', message, meeting: meetingData });
            continue;
        }

        if (isLegacyStandaloneContent(String(message.content || ''))) {
            flushBuffer();
            timeline.push({ kind: 'legacy', message });
            continue;
        }

        buffer.push(message);
    }

    flushBuffer();
    return timeline;
}

const ChatThreadView: React.FC<ChatThreadViewProps> = ({
    displayMessages,
    theme,
    isOutgoingMessage,
    deliveryForMessage,
    groupSenderLabel,
    chosenGroupChatDetails,
    chosenChatDetails,
    profileImages,
    userDetails,
    friends,
    handleDeleteMessage,
    onReplyMessage,
    rcChannelId,
    conversationId,
    myRcUserId,
}) => {
    const selfSenderIds = useMemo(() => {
        const s = new Set<string>();
        [userDetails?._id, userDetails?.id, userDetails?.userId, myRcUserId].forEach((x) => {
            if (x != null && x !== '') s.add(String(x));
        });
        return s;
    }, [userDetails?._id, userDetails?.id, userDetails?.userId, myRcUserId]);

    const timeline = useMemo(
        () => buildTimeline(displayMessages, selfSenderIds, isOutgoingMessage, deliveryForMessage),
        [displayMessages, selfSenderIds, isOutgoingMessage, deliveryForMessage],
    );

    const showGroupNames = Boolean(chosenGroupChatDetails) && !chosenChatDetails;

    return (
        <>
            {timeline.map((entry, idx) => {
                const next = timeline[idx + 1];
                const key =
                    entry.kind === 'date'
                        ? `d-${entry.date.toISOString()}`
                        : `${entry.kind}-${entry.kind === 'bubble' ? entry.sources[0]?._id : (entry as { message: DisplayMessage }).message._id}-${idx}`;

                if (entry.kind === 'date') {
                    return (
                        <div key={key} className="flex items-center gap-3 my-5">
                            <div className="flex-1 h-px bg-gray-200" />
                            <span className="text-xs text-gray-400 font-medium whitespace-nowrap">
                                {formatDividerDate(entry.date)}
                            </span>
                            <div className="flex-1 h-px bg-gray-200" />
                        </div>
                    );
                }

                if (entry.kind === 'system') {
                    return (
                        <div key={key} className={`w-full px-2 sm:px-3 ${marginAfterNonBubble(next)}`}>
                            <ChatSystemNotice text={entry.message.content} theme={theme} />
                        </div>
                    );
                }

                if (entry.kind === 'meeting-started') {
                    return (
                        <div key={key} className={`w-full px-2 sm:px-3 ${marginAfterNonBubble(next)}`}>
                            <MeetingCard
                                meetingThreadId={entry.meeting.meetingThreadId}
                                jitsiRoomName={entry.meeting.jitsiRoomName}
                                starterName={entry.meeting.starterName}
                                startedAt={entry.message.createdAt}
                                isEnded={false}
                                theme={theme === 'light' ? 'light' : 'dark'}
                            />
                        </div>
                    );
                }

                if (entry.kind === 'meeting-ended') {
                    return (
                        <div key={key} className={`w-full px-2 sm:px-3 ${marginAfterNonBubble(next)}`}>
                            <MeetingCard
                                meetingThreadId={entry.meeting.meetingThreadId}
                                jitsiRoomName=""
                                starterName=""
                                isEnded
                                duration={entry.meeting.duration}
                                participantCount={entry.meeting.participantCount}
                                theme={theme === 'light' ? 'light' : 'dark'}
                            />
                        </div>
                    );
                }

                if (entry.kind === 'legacy') {
                    const m = entry.message;
                    const incomingMessage = !isOutgoingMessage(m);
                    const isFriend = friends.some((x) => String(x._id) === String(m.author._id));
                    const disableBookButton =
                        m.author?.role === 'admin' ||
                        userDetails?.role === 'admin' ||
                        userDetails?.status === 'review' ||
                        m.author?.status === 'review';

                    return (
                        <div key={key} className={`w-full px-2 sm:px-3 ${marginAfterNonBubble(next)}`}>
                            <Message
                                content={m.content}
                                userId={m.author._id}
                                username={m.author.username}
                                image={profileImages.get(m.author._id)}
                                role={m.author.role}
                                status={m.author.status}
                                sameAuthor={false}
                                date={m.createdAt}
                                incomingMessage={incomingMessage}
                                isFriend={isFriend}
                                disableBookButton={disableBookButton}
                                myRole={userDetails?.role}
                                hideDate
                                theme={theme}
                                deliveryStatus={deliveryForMessage(m)}
                                messageId={m._id}
                                roomId={rcChannelId}
                                canDelete={!incomingMessage && !String(m._id).startsWith('temp-')}
                                deleteForMeAvailable={Boolean(
                                    (chosenChatDetails && conversationId) ||
                                        (chosenGroupChatDetails &&
                                            Boolean(
                                                (chosenGroupChatDetails as { groupId?: string }).groupId ||
                                                    (chosenGroupChatDetails as { _id?: string })._id,
                                            )),
                                )}
                                onDeleteMessage={handleDeleteMessage}
                                onReplyMessage={() => onReplyMessage?.(replyDraftFromMessage(m, m.author?.username || 'Message'))}
                            />
                            <p
                                className={`text-xs text-gray-400 mt-1 ${
                                    incomingMessage ? 'pl-2 sm:pl-4' : 'pr-2 sm:pr-4 text-right'
                                }`}
                            >
                                {formatMessageTime(new Date(m.createdAt))}
                            </p>
                        </div>
                    );
                }

                const { group, sources } = entry;
                const lastSrc = sources[sources.length - 1];
                const timeLabel = formatMessageTime(
                    lastSrc.createdAt ? new Date(lastSrc.createdAt) : new Date(),
                );
                const mb = marginAfterBubble(entry, next);

                if (group.isSelf) {
                    const lastStatus = deliveryForMessage(lastSrc);
                    const showTicks =
                        lastStatus === 'delivered' || lastStatus === 'seen' || lastStatus === 'sent';

                    return (
                        <div key={key} className={`flex w-full justify-end px-2 sm:px-3 ${mb}`}>
                            <div className="flex max-w-[min(100%,36rem)] flex-col items-end gap-0.5">
                                {group.messages.map((cm, i) => {
                                    const src = sources[i];
                                    const shell = bubbleShellClass(true, i, group.messages.length);
                                    const isLast = i === group.messages.length - 1;
                                    return (
                                        <Message
                                            key={cm.id}
                                            content={src.content}
                                            userId={src.author._id}
                                            username={src.author.username}
                                            image={profileImages.get(src.author._id)}
                                            role={src.author.role}
                                            status={src.author.status}
                                            sameAuthor={false}
                                            date={src.createdAt}
                                            incomingMessage={false}
                                            hideDate
                                            theme={theme}
                                            threadBubbleShellClassName={shell}
                                            showDeleteAffix={isLast}
                                            deliveryStatus={undefined}
                                            messageId={src._id}
                                            roomId={rcChannelId}
                                            canDelete={isLast && !String(src._id).startsWith('temp-')}
                                            deleteForMeAvailable={Boolean(
                                                (chosenChatDetails && conversationId) ||
                                                    (chosenGroupChatDetails &&
                                                        Boolean(
                                                            (chosenGroupChatDetails as { groupId?: string }).groupId ||
                                                                (chosenGroupChatDetails as { _id?: string })._id,
                                                        )),
                                            )}
                                            onDeleteMessage={handleDeleteMessage}
                                            onReplyMessage={() => onReplyMessage?.(replyDraftFromMessage(src, 'You'))}
                                        />
                                    );
                                })}
                                <p className="text-xs text-gray-400 mt-1 self-end flex items-center gap-1">
                                    {timeLabel}
                                    {showTicks ? <span className="text-[#C9A84C]">✓✓</span> : null}
                                </p>
                            </div>
                        </div>
                    );
                }

                const firstSrc = sources[0];
                const displayName = groupSenderLabel(firstSrc);
                const avatarLetter = initialsFromLabel(displayName);

                return (
                    <div key={key} className={`relative w-full pl-10 pr-2 sm:pr-3 ${mb}`}>
                        <div
                            className="absolute left-0 bottom-5 flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-700"
                            aria-hidden
                        >
                            {avatarLetter}
                        </div>
                        <div className="flex min-w-0 max-w-[min(100%,36rem)] flex-col items-start gap-0.5">
                            {showGroupNames ? (
                                <div
                                    className={`mb-0.5 pl-0.5 text-[11px] font-semibold ${
                                        theme === 'light' ? 'text-slate-600' : 'text-slate-300'
                                    }`}
                                >
                                    {displayName}
                                </div>
                            ) : null}
                            {group.messages.map((cm, i) => {
                                const src = sources[i];
                                const shell = bubbleShellClass(false, i, group.messages.length);
                                return (
                                    <Message
                                        key={cm.id}
                                        content={src.content}
                                        userId={src.author._id}
                                        username={src.author.username}
                                        image={profileImages.get(src.author._id)}
                                        role={src.author.role}
                                        status={src.author.status}
                                        sameAuthor={false}
                                        date={src.createdAt}
                                        incomingMessage
                                        hideDate
                                        theme={theme}
                                        threadBubbleShellClassName={shell}
                                        deliveryStatus={undefined}
                                        messageId={src._id}
                                        roomId={rcChannelId}
                                        canDelete={false}
                                        onDeleteMessage={handleDeleteMessage}
                                        onReplyMessage={() => onReplyMessage?.(replyDraftFromMessage(src, groupSenderLabel(src)))}
                                    />
                                );
                            })}
                            <p className="text-xs text-gray-400 mt-1 self-start">{timeLabel}</p>
                        </div>
                    </div>
                );
            })}
        </>
    );
};

export default ChatThreadView;
