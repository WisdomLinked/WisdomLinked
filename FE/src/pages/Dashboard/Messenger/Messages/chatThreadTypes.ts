export interface ChatMessage {
    id: string;
    senderId: string;
    content: string;
    timestamp: Date;
    status?: 'sent' | 'delivered' | 'read';
}

export interface MessageGroup {
    senderId: string;
    messages: ChatMessage[];
    isSelf: boolean;
}
