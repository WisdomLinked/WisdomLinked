import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';
import { OVERLAY_Z_PANEL } from '../../../../utils/overlayLayers';

export type UserActionsUser = {
  _id?: string;
  email?: string;
  role?: string;
  status?: string;
};

type Item = {
  id: string;
  label: string;
  onSelect: () => void;
  className?: string;
};

const MENU_MIN_WIDTH = 176;

export default function UserActionsMenu({
  user,
  isReviewQueue,
  onApprove,
  onBlock,
  onManage,
  onImpersonate,
  onAudit,
}: {
  user: UserActionsUser;
  isReviewQueue: boolean;
  onApprove: () => void;
  onBlock: () => void;
  onManage: () => void;
  onImpersonate: () => void;
  onAudit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const showReviewActions = isReviewQueue || user.status === 'review';

  const items = useMemo<Item[]>(() => {
    const next: Item[] = [];
    if (showReviewActions) {
      next.push({ id: 'approve', label: 'Approve', onSelect: onApprove, className: 'text-green' });
      next.push({ id: 'block', label: 'Block', onSelect: onBlock, className: 'text-red' });
    }
    next.push({ id: 'manage', label: 'Manage', onSelect: onManage });
    if (user.role !== 'admin') {
      next.push({ id: 'impersonate', label: 'Impersonate', onSelect: onImpersonate });
    }
    next.push({ id: 'audit', label: 'Audit', onSelect: onAudit });
    return next;
  }, [showReviewActions, user.role, onApprove, onBlock, onManage, onImpersonate, onAudit]);

  const updatePosition = () => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menuWidth = Math.max(MENU_MIN_WIDTH, menu?.offsetWidth ?? MENU_MIN_WIDTH);
    const menuHeight = menu?.offsetHeight ?? items.length * 36 + 8;
    let left = rect.right - menuWidth;
    left = Math.min(left, window.innerWidth - menuWidth - 8);
    left = Math.max(8, left);
    let top = rect.bottom + 4;
    if (top + menuHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - menuHeight - 4);
    }
    setCoords({ top, left });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onReposition = () => updatePosition();
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    itemRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex(0);
    }
  };

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => (i + 1) % items.length);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => (i - 1 + items.length) % items.length);
    }
  };

  return (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="User actions"
        onClick={e => {
          e.stopPropagation();
          setOpen(v => !v);
        }}
        onKeyDown={onTriggerKeyDown}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-wl-muted hover:bg-wl-brandSoft hover:text-wl-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wl-brand/50"
      >
        <MoreVertical size={16} aria-hidden />
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-label="User actions"
              onKeyDown={onMenuKeyDown}
              className="fixed min-w-[176px] rounded-xl border border-wl-line bg-white py-1 shadow-lg"
              style={{
                top: coords?.top ?? 0,
                left: coords?.left ?? 0,
                zIndex: OVERLAY_Z_PANEL,
                visibility: coords ? 'visible' : 'hidden',
              }}
            >
              {items.map((item, index) => (
                <button
                  key={item.id}
                  ref={el => {
                    itemRefs.current[index] = el;
                  }}
                  type="button"
                  role="menuitem"
                  tabIndex={index === activeIndex ? 0 : -1}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-wl-pageAlt focus:bg-wl-pageAlt focus:outline-none ${item.className ?? 'text-wl-ink'}`}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
