import { useCallback, useEffect, useState, type FormEvent, type KeyboardEvent, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { SendHorizontal } from 'lucide-react';

type Props = {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  responding?: boolean;
  onSend: (text: string) => void;
};

export default function HelpBotInput({ inputRef, responding, onSend }: Props) {
  const [value, setValue] = useState('');

  const resize = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const line = 22;
    const max = line * 4;
    el.style.height = `${Math.min(Math.max(el.scrollHeight, line), max)}px`;
  }, [inputRef]);

  useEffect(() => {
    resize();
  }, [value, resize]);

  const canSend = Boolean(value.trim()) && !responding;

  const submit = () => {
    const text = value.trim();
    if (!text || responding) return;
    onSend(text);
    setValue('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter') return;
    if (event.shiftKey) return;
    event.preventDefault();
    submit();
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  return (
    <div className="shrink-0 border-t border-slate-100 bg-white p-3">
      <form onSubmit={onSubmit}>
        <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 transition focus-within:border-[#234C6A] focus-within:ring-2 focus-within:ring-[#234C6A]/10">
          <textarea
            ref={inputRef}
            rows={1}
            disabled={responding}
            placeholder="Ask a question…"
            aria-label="Ask a question"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            className="min-h-[36px] max-h-[88px] min-w-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-[22px] text-slate-800 placeholder:text-slate-400 outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={!canSend}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#234C6A] text-white transition hover:bg-[#1b3c53] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/40 disabled:opacity-40"
          >
            <SendHorizontal className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </form>
      <p className="mt-2 text-center text-[11px] text-slate-400">
        AI can make mistakes. Need a person?{' '}
        <Link
          to="/contactus"
          className="rounded font-medium text-[#234C6A] underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/40"
        >
          Contact support
        </Link>
      </p>
    </div>
  );
}
