import type { ChatMessage, MessageGroup } from './chatThreadTypes';

const FIVE_MIN_MS = 5 * 60 * 1000;

function isSelfSender(senderId: string, selfSenderIds: ReadonlySet<string>): boolean {
    return selfSenderIds.has(senderId);
}

/**
 * Groups consecutive messages from the same sender, breaking when the sender changes
 * or when the gap between messages exceeds five minutes.
 */
export function groupMessages(messages: ChatMessage[], selfSenderIds: ReadonlySet<string>): MessageGroup[] {
    if (messages.length === 0) return [];

    const groups: MessageGroup[] = [];
    let run: ChatMessage[] = [messages[0]];

    for (let i = 1; i < messages.length; i++) {
        const prev = messages[i - 1];
        const cur = messages[i];
        const gap = cur.timestamp.getTime() - prev.timestamp.getTime();
        const sameSender = cur.senderId === prev.senderId;
        const contiguous = sameSender && gap <= FIVE_MIN_MS;

        if (contiguous) {
            run.push(cur);
        } else {
            groups.push({
                senderId: run[0].senderId,
                messages: run,
                isSelf: isSelfSender(run[0].senderId, selfSenderIds),
            });
            run = [cur];
        }
    }

    groups.push({
        senderId: run[0].senderId,
        messages: run,
        isSelf: isSelfSender(run[0].senderId, selfSenderIds),
    });

    return groups;
}
