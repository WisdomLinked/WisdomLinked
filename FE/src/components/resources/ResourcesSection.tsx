import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CONTAINER_CLASS } from '../landing/Container';
import { RESOURCES_CLOSING, RESOURCES_HEADER, RESOURCES_TIMELINE } from '../../content/resourcesTimeline';
import PlanChart from './PlanChart';
import StageCard from './StageCard';
import TimelinePills from './TimelinePills';
import TimelineRail from './TimelineRail';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, EYEBROW } from './styles';
import { useActiveStage } from './useActiveStage';
import { useResourceLinks } from './useResourceLinks';

export default function ResourcesSection() {
  const ids = useMemo(() => RESOURCES_TIMELINE.map((s) => s.id), []);
  const { activeId, scrollToStage } = useActiveStage(ids);
  const { expertHref } = useResourceLinks();

  return (
    <div className="bg-white">
      <div className="border-b border-res-line">
        <div
          className={`${CONTAINER_CLASS} grid grid-cols-1 items-center gap-10 py-12 sm:py-16 min-[960px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] min-[960px]:gap-14`}
        >
          <div className="min-w-0">
            <p className={`${EYEBROW} mb-4`}>{RESOURCES_HEADER.eyebrow}</p>
            <h1 className="font-display text-[2.1rem] font-bold leading-[1.1] text-slate-900 min-[960px]:text-5xl min-[960px]:leading-[1.1]">
              {RESOURCES_HEADER.heading}
            </h1>
            <p className="mt-5 max-w-[34rem] text-[1.08rem] leading-relaxed text-slate-600">{RESOURCES_HEADER.subtext}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={`#${ids[0]}`}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToStage(ids[0]);
                }}
                className={BUTTON_PRIMARY}
              >
                {RESOURCES_HEADER.startCta}
              </a>
              <Link to={expertHref} className={BUTTON_OUTLINE}>
                {RESOURCES_HEADER.expertCta}
              </Link>
            </div>
          </div>
          <PlanChart stages={RESOURCES_TIMELINE} activeId={activeId} onSelect={scrollToStage} />
        </div>
      </div>

      <div
        className={`${CONTAINER_CLASS} grid grid-cols-1 gap-14 pb-[72px] pt-12 min-[960px]:grid-cols-[220px_minmax(0,1fr)]`}
      >
        <div className="hidden min-[960px]:block">
          <TimelineRail
            label={RESOURCES_HEADER.timelineLabel}
            stages={RESOURCES_TIMELINE}
            activeId={activeId}
            onSelect={scrollToStage}
          />
        </div>
        <div className="min-w-0">
          <div className="mb-6 min-[960px]:hidden">
            <TimelinePills
              label={RESOURCES_HEADER.timelineLabel}
              stages={RESOURCES_TIMELINE}
              activeId={activeId}
              onSelect={scrollToStage}
            />
          </div>
          <ol className="space-y-6">
            {RESOURCES_TIMELINE.map((stage) => (
              <li key={stage.id}>
                <StageCard stage={stage} />
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="border-t border-res-line bg-res-tint">
        <div className={`${CONTAINER_CLASS} flex flex-wrap items-center justify-between gap-6 py-12`}>
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-bold text-slate-900">{RESOURCES_CLOSING.heading}</h2>
            <p className="mt-2 text-slate-600">{RESOURCES_CLOSING.text}</p>
          </div>
          <Link to={expertHref} className={`${BUTTON_PRIMARY} shrink-0 focus-visible:ring-offset-res-tint`}>
            {RESOURCES_CLOSING.cta}
          </Link>
        </div>
      </div>
    </div>
  );
}
