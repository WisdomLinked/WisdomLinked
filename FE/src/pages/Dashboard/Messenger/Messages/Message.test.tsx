import React from 'react';
import { render, screen } from '@testing-library/react';
import Message from './Message';

describe('Message outgoing rendering', () => {
    const baseProps = {
        hideDate: true,
        date: new Date().toISOString(),
        incomingMessage: false,
        theme: 'light',
        messageId: 'm1',
        roomId: 'r1',
        canDelete: true,
        deleteForMeAvailable: true,
        onDeleteMessage: async () => undefined,
    };

    it('shows delete action for long outgoing text messages', () => {
        const longText = 'a'.repeat(1500);
        render(<Message {...baseProps} content={longText} />);
        expect(screen.getByLabelText('Delete message')).toBeInTheDocument();
    });

    it('shows delete action for outgoing call-duration template messages', () => {
        const callText =
            'Call Lasted for: 35m#####2026-04-26T10:00:00.000Z#####2026-04-26T10:35:00.000Z';
        render(<Message {...baseProps} content={callText} />);
        expect(screen.getByLabelText('Delete message')).toBeInTheDocument();
        expect(screen.getByText(/Call Lasted for:/i)).toBeInTheDocument();
    });
});

