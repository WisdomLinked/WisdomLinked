import { useEffect, useRef, useState } from 'react';
import { useDismiss } from './useDismiss';

export const LINK_TRIGGER_SELECTOR = '[data-composer-trigger="link"]';

type Props = {
  open: boolean;
  initialUrl: string;
  hasLink: boolean;
  onApply: (url: string) => void;
  onRemove: () => void;
  onClose: () => void;
};

export function normalizeLinkUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const withProtocol = /^(https?:\/\/|mailto:)/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withProtocol);
    if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) return null;
    if (url.protocol !== 'mailto:' && !url.hostname.includes('.') && url.hostname !== 'localhost') return null;
    return withProtocol;
  } catch {
    return null;
  }
}

export default function LinkPopover({ open, initialUrl, hasLink, onApply, onRemove, onClose }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [url, setUrl] = useState(initialUrl);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUrl(initialUrl);
    setInvalid(false);
    requestAnimationFrame(() => inputRef.current?.select());
  }, [open, initialUrl]);

  useDismiss(ref, open, onClose, LINK_TRIGGER_SELECTOR);

  if (!open) return null;

  const apply = () => {
    const normalized = normalizeLinkUrl(url);
    if (!normalized) {
      setInvalid(true);
      return;
    }
    onApply(normalized);
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Insert link"
      className="absolute bottom-full left-0 z-[1000] mb-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
    >
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <label className="sr-only" htmlFor="composer-link-url">
          Link URL
        </label>
        <input
          id="composer-link-url"
          ref={inputRef}
          type="text"
          inputMode="url"
          autoComplete="off"
          placeholder="Paste or type a link"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setInvalid(false);
          }}
          aria-invalid={invalid}
          className={`h-10 w-full rounded-lg border px-3 text-sm text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/30 ${
            invalid ? 'border-red-300' : 'border-slate-200 focus:border-[#234C6A]'
          }`}
        />
        {invalid ? <p className="px-1 text-xs text-red-600">Enter a valid web address.</p> : null}
        <div className="flex items-center justify-end gap-2">
          {hasLink ? (
            <button
              type="button"
              onClick={onRemove}
              className="h-9 rounded-lg px-3 text-sm font-medium text-red-600 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
            >
              Remove
            </button>
          ) : null}
          <button
            type="submit"
            className="h-9 rounded-lg bg-[#234C6A] px-3 text-sm font-semibold text-white hover:bg-[#1b3c53] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/40"
          >
            Apply
          </button>
        </div>
      </form>
    </div>
  );
}
