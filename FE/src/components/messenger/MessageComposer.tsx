import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { FileText, Paperclip, SendHorizontal, Smile, X } from 'lucide-react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import {
  CHAT_FILE_ACCEPT,
  CHAT_FILE_REQUIREMENTS_MESSAGE,
  CHAT_FILE_SIZE_EXCEEDED_MESSAGE,
  formatChatFileBytes,
  isAllowedChatFileName,
  isComposerTextEmpty,
  MAX_CHAT_FILE_SIZE_BYTES,
  MAX_CHAT_FILES_PER_MESSAGE,
} from '../../utils/chatAttachments';

export type MessageComposerProps = {
  onSend: (payload: { text: string; attachments: File[] }) => void | Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  value?: string;
  onTextChange?: (value: string) => void;
  onBlur?: () => void;
};

type Chip = {
  id: string;
  file: File;
  previewUrl?: string;
  error?: string;
  progress?: number;
};

function isImageFile(file: File): boolean {
  return /^image\/(jpeg|jpg|png|webp)$/i.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
}

export default function MessageComposer({
  onSend,
  disabled = false,
  placeholder = 'Write a message…',
  value,
  onTextChange,
  onBlur,
}: MessageComposerProps) {
  const reactId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const emojiWrapRef = useRef<HTMLDivElement | null>(null);
  const [internalText, setInternalText] = useState('');
  const [chips, setChips] = useState<Chip[]>([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const text = value !== undefined ? value : internalText;
  const setText = (next: string) => {
    if (value === undefined) setInternalText(next);
    onTextChange?.(next);
  };

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const max = 6 * 24;
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 24), max)}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [text, resizeTextarea]);

  useEffect(() => {
    return () => {
      chips.forEach((chip) => {
        if (chip.previewUrl) URL.revokeObjectURL(chip.previewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!showEmoji) return undefined;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target || !emojiWrapRef.current?.contains(target)) setShowEmoji(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowEmoji(false);
        textareaRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [showEmoji]);

  const addFiles = (incoming: FileList | File[]) => {
    const list = Array.from(incoming || []);
    if (!list.length) return;

    setAttachError(null);
    setChips((prev) => {
      const next = [...prev];
      for (const file of list) {
        if (next.length >= MAX_CHAT_FILES_PER_MESSAGE) {
          setAttachError(`You can attach up to ${MAX_CHAT_FILES_PER_MESSAGE} files per message.`);
          break;
        }
        if (!isAllowedChatFileName(file.name)) {
          next.push({
            id: `${reactId}-${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
            file,
            error: `Unsupported file. ${CHAT_FILE_REQUIREMENTS_MESSAGE}`,
          });
          continue;
        }
        if (file.size > MAX_CHAT_FILE_SIZE_BYTES) {
          next.push({
            id: `${reactId}-${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
            file,
            error: `${CHAT_FILE_SIZE_EXCEEDED_MESSAGE} (${formatChatFileBytes(file.size)})`,
          });
          continue;
        }
        const previewUrl = isImageFile(file) ? URL.createObjectURL(file) : undefined;
        next.push({
          id: `${reactId}-${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
          file,
          previewUrl,
        });
      }
      return next.slice(0, MAX_CHAT_FILES_PER_MESSAGE);
    });
  };

  const removeChip = (id: string) => {
    setChips((prev) => {
      const target = prev.find((c) => c.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((c) => c.id !== id);
    });
  };

  const validFiles = chips.filter((c) => !c.error).map((c) => c.file);
  const hasErrors = chips.some((c) => !!c.error);
  const canSend =
    !disabled &&
    !sending &&
    !hasErrors &&
    (!isComposerTextEmpty(text) || validFiles.length > 0);

  const insertAtCursor = (snippet: string) => {
    const el = textareaRef.current;
    if (!el) {
      setText(text + snippet);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = `${text.slice(0, start)}${snippet}${text.slice(end)}`;
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
      resizeTextarea();
    });
  };

  const handleSend = async () => {
    if (!canSend) return;
    const payloadText = text;
    const payloadFiles = validFiles;
    setSending(true);
    setChips((prev) => prev.map((c) => (c.error ? c : { ...c, progress: 20 })));
    try {
      await onSend({ text: payloadText, attachments: payloadFiles });
      chips.forEach((c) => {
        if (c.previewUrl) URL.revokeObjectURL(c.previewUrl);
      });
      setChips([]);
      setText('');
      setAttachError(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch {
      setChips((prev) =>
        prev.map((c) =>
          c.error ? c : { ...c, progress: undefined, error: c.error || 'Could not send. Try again.' },
        ),
      );
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter') return;
    // Enter sends; Shift+Enter inserts a newline.
    if (event.shiftKey) return;
    event.preventDefault();
    void handleSend();
  };

  return (
    <div
      className={`relative flex w-full flex-col gap-2 rounded-2xl border bg-white p-2 transition-shadow ${
        dragOver
          ? 'border-[#234C6A] ring-2 ring-[#234C6A]/10'
          : 'border-slate-200 focus-within:border-[#234C6A] focus-within:ring-2 focus-within:ring-[#234C6A]/10'
      }`}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
      }}
    >
      {chips.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Attachments">
          {chips.map((chip) => (
            <li
              key={chip.id}
              className={`flex max-w-full items-center gap-2 rounded-xl border px-2 py-1.5 text-xs ${
                chip.error ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              {chip.previewUrl ? (
                <img src={chip.previewUrl} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" />
              ) : (
                <FileText className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{chip.file.name}</span>
                <span className="block text-[10px] text-slate-500">{formatChatFileBytes(chip.file.size)}</span>
                {chip.error ? <span className="mt-0.5 block text-[10px] leading-snug">{chip.error}</span> : null}
                {typeof chip.progress === 'number' && !chip.error ? (
                  <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-slate-200">
                    <span
                      className="block h-full rounded-full bg-[#234C6A] transition-all"
                      style={{ width: `${Math.min(100, Math.max(8, chip.progress))}%` }}
                    />
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => removeChip(chip.id)}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/40"
                aria-label={`Remove ${chip.file.name}`}
                disabled={sending}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {attachError ? <p className="px-1 text-xs text-red-600">{attachError}</p> : null}

      <div className="flex items-end gap-2">
        <button
          type="button"
          title="Attach file"
          aria-label="Attach file"
          disabled={disabled || sending}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/40 disabled:opacity-40"
        >
          <Paperclip className="h-5 w-5" aria-hidden />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept={CHAT_FILE_ACCEPT}
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = '';
          }}
        />

        <textarea
          ref={textareaRef}
          aria-label="Message"
          rows={1}
          disabled={disabled || sending}
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          onPaste={(e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            const files: File[] = [];
            for (const item of Array.from(items)) {
              if (item.kind === 'file' && item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) files.push(file);
              }
            }
            if (files.length) {
              e.preventDefault();
              addFiles(files);
            }
          }}
          className="min-h-6 max-h-[144px] min-w-0 flex-1 resize-none bg-transparent py-2 text-[15px] leading-6 text-slate-800 placeholder:text-slate-400 outline-none focus:outline-none disabled:opacity-60"
        />

        <div ref={emojiWrapRef} className="relative shrink-0">
          <button
            type="button"
            title="Add emoji"
            aria-label="Add emoji"
            aria-expanded={showEmoji}
            disabled={disabled || sending}
            onClick={() => setShowEmoji((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/40 disabled:opacity-40"
          >
            <Smile className="h-5 w-5" aria-hidden />
          </button>
          {showEmoji ? (
            <div className="absolute bottom-12 right-0 z-[1000]">
              <Picker
                data={data}
                onEmojiSelect={(emoji: { native?: string }) => {
                  if (emoji?.native) insertAtCursor(emoji.native);
                  setShowEmoji(false);
                  textareaRef.current?.focus();
                }}
                theme="light"
              />
            </div>
          ) : null}
        </div>

        <button
          type="button"
          aria-label="Send message"
          disabled={!canSend}
          onClick={() => void handleSend()}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#234C6A] text-white transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/40 disabled:pointer-events-none disabled:opacity-35"
        >
          <SendHorizontal className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
