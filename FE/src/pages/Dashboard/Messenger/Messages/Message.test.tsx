import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
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

    it('confirms before deleting a message for everyone', async () => {
        const user = userEvent.setup();
        const onDeleteMessage = vi.fn(async () => undefined);
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
        render(<Message {...baseProps} content="hello" onDeleteMessage={onDeleteMessage} />);

        await user.click(screen.getByLabelText('Delete message'));
        await user.click(screen.getByText('Delete for everyone'));

        expect(confirmSpy).toHaveBeenCalledWith('Delete this message for everyone? This cannot be undone.');
        expect(onDeleteMessage).not.toHaveBeenCalled();
        confirmSpy.mockRestore();
    });

    it('renders a single immediate parent quote for stacked reply HTML', () => {
        const html =
            '<blockquote><strong>Replying to Alice</strong><br>first</blockquote>' +
            '<blockquote class="wl-reply-quote" data-wl-reply-id="parent-2"><strong>Replying to Bob</strong><br>second</blockquote>' +
            '<p>my answer</p>';
        render(
            <Message
                {...baseProps}
                content={html}
                onJumpToParent={vi.fn()}
            />,
        );
        expect(screen.getByText('Bob')).toBeInTheDocument();
        expect(screen.getByText('second')).toBeInTheDocument();
        expect(screen.getByText('my answer')).toBeInTheDocument();
        expect(screen.queryByText('Alice')).not.toBeInTheDocument();
        expect(screen.queryByText(/replying to/i)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /jump to message from bob/i })).toBeInTheDocument();
    });
});

