import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, Extension, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import DOMPurify from 'dompurify';
import { Loader2, Paperclip, SendHorizontal, Smile } from 'lucide-react';
import { CHAT_FILE_ACCEPT, MAX_CHAT_FILES_PER_MESSAGE } from '../../../utils/chatAttachments';
import AttachmentChips from './AttachmentChips';
import EmojiPopover from './EmojiPopover';
import FormattingToolbar from './FormattingToolbar';
import LinkPopover from './LinkPopover';
import ToolbarButton from './ToolbarButton';
import { useFileAttachments } from './useFileAttachments';

export type ComposerSendPayload = { html: string; text: string; attachments: File[] };

export type MessageComposerProps = {
  onSend: (payload: ComposerSendPayload) => void | Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  maxFileSizeMB?: number;
  maxFiles?: number;
  /** Controlled HTML content (used for per-conversation drafts). Empty editor is ''. */
  value?: string;
  onChange?: (html: string) => void;
  onBlur?: () => void;
};

const OUTGOING_TAGS = ['p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'a'];

export function sanitizeComposerHtml(html: string): string {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: OUTGOING_TAGS,
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
  return clean.replace(/^(?:<p>(?:<br>)?<\/p>)+|(?:<p>(?:<br>)?<\/p>)+$/g, '').trim();
}

const EDITOR_CLASS = [
  'chat-composer-editor',
  'min-h-[1.625em] max-h-[calc(8*1.625em)] overflow-y-auto',
  'text-[15px] leading-relaxed text-slate-800 break-words outline-none',
  '[&_p]:m-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5',
  '[&_a]:text-blue-600 [&_a]:underline',
].join(' ');

export default function MessageComposer({
  onSend,
  disabled = false,
  placeholder = 'Write a message…',
  maxFileSizeMB = 10,
  maxFiles = MAX_CHAT_FILES_PER_MESSAGE,
  value,
  onChange,
  onBlur,
}: MessageComposerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkInitialUrl, setLinkInitialUrl] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);

  const { items, error, dragOver, addFiles, removeFile, clearFiles, dragHandlers } = useFileAttachments({
    maxFileSizeMB,
    maxFiles,
  });

  const lastEmittedRef = useRef(value ?? '');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onBlurRef = useRef(onBlur);
  onBlurRef.current = onBlur;
  const sendRef = useRef<() => void>(() => {});
  const openLinkRef = useRef<() => void>(() => {});
  const addFilesRef = useRef(addFiles);
  addFilesRef.current = addFiles;

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
        trailingNode: false,
        link: false,
        underline: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: 'https',
        protocols: ['http', 'https', 'mailto'],
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
      }),
      Placeholder.configure({ placeholder }),
      Extension.create({
        name: 'composerKeys',
        priority: 1000,
        addKeyboardShortcuts() {
          return {
            Enter: ({ editor }) => {
              if (editor.isActive('listItem')) return false;
              sendRef.current();
              return true;
            },
            'Mod-Enter': () => {
              sendRef.current();
              return true;
            },
            'Mod-Shift-x': ({ editor }) => editor.commands.toggleStrike(),
            'Mod-k': () => {
              openLinkRef.current();
              return true;
            },
          };
        },
      }),
    ],
    // Extensions are created once; the placeholder only changes between conversations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const editor = useEditor({
    extensions,
    content: value ?? '',
    editable: !disabled,
    editorProps: {
      attributes: {
        class: EDITOR_CLASS,
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': 'Message',
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files || []);
        if (!files.length) return false;
        addFilesRef.current(files);
        return true;
      },
      handleDrop: (_view, event) => {
        const files = Array.from((event as DragEvent).dataTransfer?.files || []);
        if (!files.length) return false;
        event.preventDefault();
        addFilesRef.current(files);
        return true;
      },
    },
    onUpdate: ({ editor: e }) => {
      const html = e.isEmpty ? '' : e.getHTML();
      lastEmittedRef.current = html;
      onChangeRef.current?.(html);
    },
    onBlur: () => onBlurRef.current?.(),
  });

  const hasText = useEditorState({
    editor,
    selector: ({ editor: e }) => !!e && e.getText().trim().length > 0,
  });

  useEffect(() => {
    if (!editor || value === undefined || value === lastEmittedRef.current) return;
    lastEmittedRef.current = value;
    editor.commands.setContent(value || '', { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    if (editor && !sendingRef.current) editor.setEditable(!disabled, false);
  }, [editor, disabled]);

  const canSend = !disabled && !sending && (hasText || items.length > 0);

  const send = async () => {
    if (!editor || disabled || sendingRef.current) return;
    const text = editor.getText({ blockSeparator: '\n' }).trim();
    const attachments = items.map((item) => item.file);
    if (!text && !attachments.length) return;
    const html = text ? sanitizeComposerHtml(editor.getHTML()) : '';

    sendingRef.current = true;
    setSending(true);
    editor.setEditable(false, false);
    try {
      await onSend({ html, text, attachments });
      editor.commands.clearContent(true);
      clearFiles();
      setLinkOpen(false);
      setEmojiOpen(false);
    } catch {
      // The caller reports send failures; keep the content so it can be retried.
    } finally {
      sendingRef.current = false;
      setSending(false);
      editor.setEditable(!disabled, false);
      editor.commands.focus('end');
    }
  };
  sendRef.current = () => void send();

  const toggleLink = () => {
    if (!editor) return;
    if (linkOpen) {
      setLinkOpen(false);
      return;
    }
    setEmojiOpen(false);
    setLinkInitialUrl(String(editor.getAttributes('link').href || ''));
    setLinkOpen(true);
  };
  openLinkRef.current = toggleLink;

  const closeLink = useCallback(() => {
    setLinkOpen(false);
    editor?.commands.focus();
  }, [editor]);

  const applyLink = (href: string) => {
    if (!editor) return;
    const chain = editor.chain().focus();
    if (editor.isActive('link')) {
      chain.extendMarkRange('link').setLink({ href }).run();
    } else if (editor.state.selection.empty) {
      chain
        .insertContent([
          { type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] },
          { type: 'text', text: ' ' },
        ])
        .run();
    } else {
      chain.setLink({ href }).run();
    }
    setLinkOpen(false);
  };

  const removeLink = () => {
    editor?.chain().focus().extendMarkRange('link').unsetLink().run();
    setLinkOpen(false);
  };

  const closeEmoji = useCallback(() => {
    setEmojiOpen(false);
    editor?.commands.focus();
  }, [editor]);

  const insertEmoji = (emoji: string) => {
    editor?.chain().focus().insertContent(emoji).run();
    setEmojiOpen(false);
  };

  const busy = disabled || sending;

  return (
    <div
      className={`relative flex w-full min-w-0 flex-col gap-1 rounded-2xl border bg-white p-1.5 transition-colors ${
        dragOver
          ? 'border-[#234C6A] bg-[#234C6A]/[0.03] ring-2 ring-[#234C6A]/10'
          : 'border-slate-200 focus-within:border-[#234C6A]/60 focus-within:ring-2 focus-within:ring-[#234C6A]/10'
      }`}
      {...dragHandlers}
    >
      <AttachmentChips items={items} onRemove={removeFile} disabled={sending} />
      {error ? (
        <p className="px-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {editor ? (
        <div className="border-b border-slate-100 pb-1">
          <FormattingToolbar editor={editor} disabled={busy} linkOpen={linkOpen} onLinkClick={toggleLink} />
        </div>
      ) : null}

      <EditorContent editor={editor} className="px-2.5 pt-1" />

      <div className="flex items-center gap-1">
        <div className="flex min-w-0 flex-1 items-center gap-0.5">
          <ToolbarButton
            label="Attach files"
            icon={Paperclip}
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={CHAT_FILE_ACCEPT}
            className="hidden"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        <span data-composer-trigger="emoji" className="inline-flex shrink-0">
          <ToolbarButton
            label="Add emoji"
            icon={Smile}
            pressable
            active={emojiOpen}
            expanded={emojiOpen}
            disabled={busy}
            onClick={() => {
              setLinkOpen(false);
              setEmojiOpen((v) => !v);
            }}
          />
        </span>
        <button
          type="button"
          title="Send (Enter)"
          aria-label="Send message"
          aria-busy={sending}
          disabled={!canSend}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void send()}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#234C6A] text-white transition-colors hover:bg-[#1b3c53] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          {sending ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ) : (
            <SendHorizontal className="h-5 w-5" aria-hidden />
          )}
        </button>
      </div>

      <LinkPopover
        open={linkOpen}
        initialUrl={linkInitialUrl}
        hasLink={!!editor?.isActive('link')}
        onApply={applyLink}
        onRemove={removeLink}
        onClose={closeLink}
      />
      <EmojiPopover open={emojiOpen} onSelect={insertEmoji} onClose={closeEmoji} />

      {dragOver ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl text-sm font-medium text-[#234C6A]">
          <span className="rounded-full bg-white/90 px-3 py-1 shadow-sm">Drop files to attach</span>
        </div>
      ) : null}
    </div>
  );
}
