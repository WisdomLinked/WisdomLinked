import { format, isToday, isYesterday } from 'date-fns';

/** Bubble / row timestamps in the message thread: e.g. May 3, 12:46 AM */
export function formatMessageTime(date: Date): string {
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    return format(date, 'MMM d, h:mm a');
}

/** Date divider labels only: Today, Yesterday, or Sunday, May 3 */
export function formatDividerDate(date: Date): string {
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE, MMMM d');
}
