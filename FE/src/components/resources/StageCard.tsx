import React from 'react';
import { FileText, IdCard, ListChecks, PencilLine, Plane, UserSearch, Wallet, type LucideIcon } from 'lucide-react';
import type { StageBody, StageIcon, TimelineStage } from '../../content/resourcesTimeline';
import Checklist from './Checklist';
import ExamGrid from './ExamGrid';
import ExpertPromo from './ExpertPromo';
import GuideCards from './GuideCards';
import LinkList from './LinkList';
import RichText from './RichText';
import StepFlow from './StepFlow';
import { stageHeadingId } from './useActiveStage';
import { useResourceLinks } from './useResourceLinks';

const ICONS: Record<StageIcon, LucideIcon> = {
  'list-checks': ListChecks,
  'user-search': UserSearch,
  'pencil-line': PencilLine,
  'file-text': FileText,
  wallet: Wallet,
  'id-card': IdCard,
  plane: Plane,
};

function Body({ body }: { body: StageBody }) {
  const links = useResourceLinks();
  switch (body.type) {
    case 'links':
      return <LinkList items={body.items} note={body.note} />;
    case 'exams':
      return <ExamGrid items={body.items} />;
    case 'guides':
      return (
        <GuideCards items={body.items} footnote={body.footnote} ctaHref={links.guidesHref} ctaLabel={links.guidesLabel} />
      );
    case 'steps':
      return <StepFlow items={body.items} note={body.note} />;
    case 'expertPromo':
      return <ExpertPromo promo={body.promo} href={links.expertHref} />;
    case 'checklist':
      return <Checklist label={body.label} items={body.items} />;
    default:
      return null;
  }
}

export default function StageCard({ stage }: { stage: TimelineStage }) {
  const Icon = ICONS[stage.icon];
  const headingId = stageHeadingId(stage.id);
  return (
    <section
      id={stage.id}
      aria-labelledby={headingId}
      className="scroll-mt-28 rounded-[18px] border border-res-line bg-white p-5 shadow-res-card sm:p-7"
    >
      <div className="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-x-4 gap-y-4 sm:grid-cols-[48px_minmax(0,1fr)_auto]">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-res-soft text-wl-brand" aria-hidden>
          <Icon className="h-6 w-6" strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-res-blue">{stage.timeRange}</p>
          <h2 id={headingId} tabIndex={-1} className="mt-0.5 font-display text-2xl font-bold text-slate-900 outline-none">
            {stage.title}
          </h2>
        </div>
        <div className="col-span-2 rounded-xl bg-res-gold-soft px-4 py-3 text-left sm:col-span-1 sm:text-right">
          <p className="font-display sm:whitespace-nowrap text-[1.35rem] font-bold leading-tight text-res-gold">
            {stage.keyFact.value}
          </p>
          <p className="mt-0.5 max-w-[13rem] text-xs leading-snug text-slate-600 sm:ml-auto">{stage.keyFact.caption}</p>
        </div>
      </div>

      <div className="mt-5 max-w-[64ch] space-y-3 leading-relaxed text-slate-600">
        {stage.intro.map((paragraph, i) => (
          <p key={i}>
            <RichText parts={paragraph} />
          </p>
        ))}
      </div>

      {stage.body?.length ? (
        <div className="mt-5 space-y-4">
          {stage.body.map((body, i) => (
            <Body key={`${body.type}-${i}`} body={body} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
