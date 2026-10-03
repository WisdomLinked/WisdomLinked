import React from 'react';
import { PLAN_CHART, PLAN_MONTHS, type TimelineStage } from '../../content/resourcesTimeline';
import { FOCUS_RING, MOTION } from './styles';

type Props = {
  stages: TimelineStage[];
  activeId: string;
  onSelect: (id: string) => void;
};

const MIN_BAR_PERCENT = 2.5;
const GRID_STEP_MONTHS = 3;
const GRID_LINES = Array.from({ length: PLAN_MONTHS / GRID_STEP_MONTHS - 1 }, (_, i) => ((i + 1) * GRID_STEP_MONTHS * 100) / PLAN_MONTHS);
const ROW_GRID = 'grid grid-cols-[96px_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[132px_minmax(0,1fr)]';

const toPercent = (months: number) => ((months + PLAN_MONTHS) / PLAN_MONTHS) * 100;

export default function PlanChart({ stages, activeId, onSelect }: Props) {
  return (
    <nav aria-label={PLAN_CHART.ariaLabel} className="min-w-0 rounded-2xl border border-res-line bg-res-tint p-[22px]">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-bold text-slate-900">{PLAN_CHART.title}</p>
        <p className="text-xs text-slate-500">{PLAN_CHART.note}</p>
      </div>

      <ol className="mt-4 space-y-1">
        {stages.map((stage) => {
          const active = stage.id === activeId;
          const left = toPercent(stage.monthsFrom);
          const width = Math.max(((stage.monthsTo - stage.monthsFrom) / PLAN_MONTHS) * 100, MIN_BAR_PERCENT);
          return (
            <li key={stage.id}>
              <a
                href={`#${stage.id}`}
                aria-current={active ? 'step' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  onSelect(stage.id);
                }}
                className={`group ${ROW_GRID} rounded-md py-1 ${FOCUS_RING} focus-visible:ring-offset-res-tint`}
              >
                <span
                  className={`truncate text-[13px] transition-colors ${MOTION} group-hover:text-slate-900 ${
                    active ? 'text-slate-900' : 'text-slate-600'
                  }`}
                >
                  <span className="font-bold text-wl-brand">{stage.number}</span> {stage.title}
                </span>
                <span className="relative h-3.5 overflow-hidden rounded-full bg-white" aria-hidden>
                  {GRID_LINES.map((x) => (
                    <span key={x} className="absolute inset-y-0 w-px bg-res-line" style={{ left: `${x}%` }} />
                  ))}
                  <span
                    className={`absolute inset-y-0 rounded-full transition-colors ${MOTION} group-hover:bg-wl-brand ${
                      active ? 'bg-wl-brand' : 'bg-res-blue/[0.55]'
                    }`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                  />
                </span>
              </a>
            </li>
          );
        })}
      </ol>

      <div className={`${ROW_GRID} mt-2`} aria-hidden>
        <span />
        <span className="relative h-4 text-[11px] text-slate-500">
          {PLAN_CHART.axis.map((label, i) => {
            const last = i === PLAN_CHART.axis.length - 1;
            const x = (i * 100) / (PLAN_CHART.axis.length - 1);
            const shift = i === 0 ? '0' : last ? '-100%' : '-50%';
            return (
              <span
                key={`${label}-${i}`}
                className={`absolute top-0 whitespace-nowrap ${last ? 'font-bold text-res-gold' : ''} ${
                  i % 2 === 1 ? 'hidden sm:inline' : ''
                }`}
                style={{ left: `${x}%`, transform: `translateX(${shift})` }}
              >
                {label}
              </span>
            );
          })}
        </span>
      </div>
    </nav>
  );
}
