import { useRef } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { useDismiss } from './useDismiss';

export const EMOJI_TRIGGER_SELECTOR = '[data-composer-trigger="emoji"]';

type Props = {
  open: boolean;
  onSelect: (emoji: string) => void;
  onClose: () => void;
};

export default function EmojiPopover({ open, onSelect, onClose }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  useDismiss(ref, open, onClose, EMOJI_TRIGGER_SELECTOR);
  if (!open) return null;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Emoji picker"
      className="absolute bottom-full right-0 z-[1000] mb-2 max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl shadow-lg"
    >
      <Picker
        data={data}
        theme="light"
        autoFocus
        previewPosition="none"
        onEmojiSelect={(emoji: { native?: string }) => {
          if (emoji?.native) onSelect(emoji.native);
        }}
      />
    </div>
  );
}
