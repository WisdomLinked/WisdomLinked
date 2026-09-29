import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import Message from './Message';
import { WL_REPLY_WIRE_PREFIX } from '../../../../utils/chatReplyLayout';

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

    it('shows delete for me only on incoming thread bubbles when canDeleteForEveryone is false', async () => {
        const user = userEvent.setup();
        render(
            <Message
                {...baseProps}
                incomingMessage
                threadBubbleShellClassName="rounded-lg bg-slate-100"
                canDelete
                canDeleteForEveryone={false}
                content="peer says hi"
            />,
        );

        await user.click(screen.getByLabelText('Delete message'));
        expect(screen.getByText('Delete for me')).toBeInTheDocument();
        expect(screen.queryByText('Delete for everyone')).not.toBeInTheDocument();
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

    it('renders wire-format RC reply without Replying to label', () => {
        const wire = `${WL_REPLY_WIRE_PREFIX}|p1|${encodeURIComponent('Khussal Pradhan')}|${encodeURIComponent('supp bro')}|\n?going good la`;
        render(
            <Message
                {...baseProps}
                content={wire}
                onJumpToParent={vi.fn()}
                replyPeerDisplayName="Khussal Pradhan"
            />,
        );
        expect(screen.getByText('Khussal Pradhan')).toBeInTheDocument();
        expect(screen.getByText('supp bro')).toBeInTheDocument();
        expect(screen.getByText('?going good la')).toBeInTheDocument();
        expect(screen.queryByText(/replying to/i)).not.toBeInTheDocument();
    });

    it('renders rich wire-format messages with formatting preserved', () => {
        const html = '<p><strong>bold</strong> text</p>';
        const wire = `__WL_HTML__|${encodeURIComponent(html)}`;
        render(<Message {...baseProps} content={wire} />);
        expect(screen.getByText('bold').tagName.toLowerCase()).toBe('strong');
        expect(screen.getByText(/text/)).toBeInTheDocument();
    });

    it('renders list wire-format messages with list items', () => {
        const html = '<ol><li data-list="ordered">one</li><li data-list="bullet">two</li></ol>';
        const wire = `__WL_HTML__|${encodeURIComponent(html)}`;
        const { container } = render(<Message {...baseProps} content={wire} />);
        expect(container.querySelector('ol li[data-list="ordered"]')).toBeTruthy();
        expect(container.querySelector('ol li[data-list="bullet"]')).toBeTruthy();
    });
});


describe('Message image attachments', () => {
    const IMG = 'https://wl.blr1.digitaloceanspaces.com/chatFiles/1_shot.png';
    const PDF = 'https://wl.blr1.digitaloceanspaces.com/chatFiles/1_report.pdf';
    const imageContent = `Chatfile: ${IMG}#####shot.png`;
    const pdfContent = `Chatfile: ${PDF}#####report.pdf`;

    const baseProps = {
        hideDate: true,
        date: new Date().toISOString(),
        theme: 'light',
        messageId: 'm9',
        roomId: 'r9',
    };

    it('renders an outgoing picture as a picture, not a file chip', () => {
        render(<Message {...baseProps} incomingMessage={false} content={imageContent} />);

        const img = screen.getByAltText('shot.png') as HTMLImageElement;
        expect(img).toBeInTheDocument();
        expect(img.src).toBe(IMG);
        expect(screen.queryByText(/📄/)).not.toBeInTheDocument();
    });

    it('renders an incoming picture as a picture', () => {
        render(<Message {...baseProps} incomingMessage content={imageContent} />);

        expect(screen.getByAltText('shot.png')).toBeInTheDocument();
        expect(screen.queryByText(/📄/)).not.toBeInTheDocument();
    });

    it('keeps the file chip for documents', () => {
        render(<Message {...baseProps} incomingMessage={false} content={pdfContent} />);

        expect(screen.queryByAltText('report.pdf')).not.toBeInTheDocument();
        expect(screen.getByText(/📄/)).toBeInTheDocument();
        expect(screen.getByTitle('Download file')).toBeInTheDocument();
    });

    it('opens the preview when the picture is clicked', async () => {
        const user = userEvent.setup();
        render(<Message {...baseProps} incomingMessage={false} content={imageContent} />);

        await user.click(screen.getByLabelText('Open image shot.png'));

        expect(screen.getByText('File Preview')).toBeInTheDocument();
    });

    it('falls back to the file chip when the picture cannot load', () => {
        render(<Message {...baseProps} incomingMessage={false} content={imageContent} />);

        fireEvent.error(screen.getByAltText('shot.png'));

        expect(screen.queryByAltText('shot.png')).not.toBeInTheDocument();
        expect(screen.getByText(/📄/)).toBeInTheDocument();
        expect(screen.getByTitle('Download file')).toBeInTheDocument();
    });

    it('still offers delete and reply on a picture message', () => {
        render(
            <Message
                {...baseProps}
                incomingMessage
                content={imageContent}
                canDelete
                onDeleteMessage={async () => undefined}
                onReplyMessage={() => undefined}
            />,
        );

        expect(screen.getByAltText('shot.png')).toBeInTheDocument();
        expect(screen.getByLabelText('Delete message')).toBeInTheDocument();
        expect(screen.getByLabelText('Reply to message')).toBeInTheDocument();
    });
});
