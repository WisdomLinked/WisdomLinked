import React from 'react';
import { MessageSquare, Wallet } from 'lucide-react';
import { AUDIT_FOCUS } from './auditUi';
import type { AuditTab } from './auditModel';

const TABS: Array<{ id: AuditTab; label: string; icon: typeof MessageSquare }> = [
  { id: 'chat', label: 'Chat history', icon: MessageSquare },
  { id: 'payment', label: 'Payment history', icon: Wallet },
];

export default function AuditTabs({
  selected,
  onSelect,
  chatCount,
  paymentCount,
  actions,
}: {
  selected: AuditTab;
  onSelect: (tab: AuditTab) => void;
  chatCount: number;
  paymentCount: number;
  /** Controls that apply to both tabs, shown beside them on wide screens and above them otherwise. */
  actions?: React.ReactNode;
}) {
  const counts: Record<AuditTab, number> = { chat: chatCount, payment: paymentCount };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = TABS.findIndex(tab => tab.id === selected);
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      onSelect(TABS[(index + 1) % TABS.length].id);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      onSelect(TABS[(index - 1 + TABS.length) % TABS.length].id);
    }
  };

  return (
    <div className="flex flex-col-reverse gap-2 border-b border-audit-line xl:flex-row xl:items-end xl:justify-between xl:gap-4">
      <div role="tablist" aria-label="Audit sections" className="flex gap-6" onKeyDown={onKeyDown}>
        {TABS.map(tab => {
          const active = selected === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`audit-tab-${tab.id}`}
              aria-selected={active}
              aria-controls={`audit-panel-${tab.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => onSelect(tab.id)}
              className={`${AUDIT_FOCUS} relative -mb-px inline-flex items-center gap-2 border-b-2 py-3 text-sm ${
                active
                  ? 'border-audit-brand font-semibold text-audit-brand'
                  : 'border-transparent text-audit-muted hover:text-audit-ink'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {tab.label}
              <span className="rounded-full bg-audit-sunken px-1.5 py-0.5 text-xs tabular-nums text-audit-muted">
                {counts[tab.id]}
              </span>
            </button>
          );
        })}
      </div>
      {actions ? <div className="xl:pb-2">{actions}</div> : null}
    </div>
  );
}
