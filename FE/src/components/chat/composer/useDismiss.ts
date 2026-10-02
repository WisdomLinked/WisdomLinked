import { useEffect, type RefObject } from 'react';

/**
 * Calls `onDismiss` on Escape or a pointer press outside `ref`. Presses on elements
 * matching `ignoreSelector` (the popover's own trigger) are ignored so the trigger can toggle it.
 */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onDismiss: () => void,
  ignoreSelector?: string,
) {
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Element | null;
      if (!target || ref.current?.contains(target)) return;
      if (ignoreSelector && target.closest?.(ignoreSelector)) return;
      onDismiss();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onDismiss();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [ref, open, onDismiss, ignoreSelector]);
}
