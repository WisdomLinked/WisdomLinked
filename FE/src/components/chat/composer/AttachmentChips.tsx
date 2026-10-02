import { FileText, X } from 'lucide-react';
import { formatChatFileBytes } from '../../../utils/chatAttachments';
import type { AttachmentItem } from './useFileAttachments';

type Props = {
  items: AttachmentItem[];
  onRemove: (id: string) => void;
  disabled?: boolean;
};

export default function AttachmentChips({ items, onRemove, disabled = false }: Props) {
  if (!items.length) return null;
  return (
    <ul className="flex flex-wrap gap-2 px-1 pt-1" aria-label="Attachments">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex max-w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-1.5 pr-1 text-xs text-slate-700"
        >
          {item.previewUrl ? (
            <img src={item.previewUrl} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-slate-500">
              <FileText className="h-4 w-4" aria-hidden />
            </span>
          )}
          <span className="min-w-0">
            <span className="block max-w-[10rem] truncate font-medium sm:max-w-[14rem]">{item.file.name}</span>
            <span className="block text-[11px] text-slate-500">{formatChatFileBytes(item.file.size)}</span>
          </span>
          <button
            type="button"
            title={`Remove ${item.file.name}`}
            aria-label={`Remove ${item.file.name}`}
            disabled={disabled}
            onClick={() => onRemove(item.id)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/40 disabled:opacity-40"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}
