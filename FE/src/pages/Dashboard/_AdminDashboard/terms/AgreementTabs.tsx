import React, { useRef } from 'react';
import {
  AGREEMENT_KEYS,
  FOCUS,
  type AgreementContract,
  type AgreementKey,
} from './termsModel';

export default function AgreementTabs({
  contracts,
  selected,
  onSelect,
}: {
  contracts: AgreementContract[];
  selected: AgreementKey;
  onSelect: (key: AgreementKey) => void;
}) {
  const refs = useRef<Partial<Record<AgreementKey, HTMLButtonElement | null>>>({});

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = AGREEMENT_KEYS.indexOf(selected);
    if (index < 0) return;
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % AGREEMENT_KEYS.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + AGREEMENT_KEYS.length) % AGREEMENT_KEYS.length;
    else return;
    event.preventDefault();
    const key = AGREEMENT_KEYS[next];
    onSelect(key);
    refs.current[key]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Agreement type"
      className="flex gap-6 border-b border-slate-200"
      onKeyDown={onKeyDown}
    >
      {contracts.map(contract => {
        const active = contract.key === selected;
        const current = contract.versions[0];
        return (
          <button
            key={contract.key}
            type="button"
            role="tab"
            id={`terms-tab-${contract.key}`}
            aria-selected={active}
            aria-controls={`terms-panel-${contract.key}`}
            tabIndex={active ? 0 : -1}
            ref={node => {
              refs.current[contract.key] = node;
            }}
            onClick={() => onSelect(contract.key)}
            className={`${FOCUS} relative -mb-px inline-flex items-center gap-2 border-b-2 py-3 text-sm ${
              active
                ? 'border-slate-900 font-semibold text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {contract.label}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              v{current.number}
            </span>
          </button>
        );
      })}
    </div>
  );
}
