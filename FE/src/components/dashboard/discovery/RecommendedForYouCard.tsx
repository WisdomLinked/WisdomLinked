import { UserRound } from 'lucide-react';
import DiscoveryCarouselShell, { useDiscoveryCarousel } from './DiscoveryCarouselShell';
import type { DiscoveryExpert } from '../../../utils/studentDiscovery';

type Props = {
  items: DiscoveryExpert[];
  needsProfile: boolean;
  onViewProfile: (id: string) => void;
  onCompleteProfile: () => void;
};

export default function RecommendedForYouCard({
  items,
  needsProfile,
  onViewProfile,
  onCompleteProfile,
}: Props) {
  const { index, fading, prev, next } = useDiscoveryCarousel(items.length);
  const item = items[index];

  if (needsProfile) {
    return (
      <div className="flex h-full min-h-[22rem] flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h3 className="mb-3 text-xl font-semibold text-slate-900">Recommended for you</h3>
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#234C6A]/10 text-[#234C6A]">
              <UserRound className="h-7 w-7" aria-hidden />
            </div>
            <p className="max-w-[240px] text-sm text-slate-600">
              Complete your profile to get personalized recommendations
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCompleteProfile}
          className="inline-flex w-full items-center justify-center rounded-lg bg-[#234C6A] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#1b3c53] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/40"
        >
          Complete profile
        </button>
      </div>
    );
  }

  return (
    <DiscoveryCarouselShell
      title="Recommended for you"
      count={items.length}
      index={index}
      onPrev={prev}
      onNext={next}
      fading={fading}
      empty={
        <p className="py-5 text-center text-sm text-slate-500">
          No matches yet — check back as more experts join.
        </p>
      }
      footer={
        item ? (
          <button
            type="button"
            onClick={() => onViewProfile(item.id)}
            className="inline-flex w-full items-center justify-center rounded-lg border border-[#234c6a] px-3 py-2 text-sm font-semibold text-[#234c6a] transition-colors hover:bg-[#234c6a] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/40"
          >
            View profile
          </button>
        ) : null
      }
    >
      {item ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {item.image ? (
              <img
                src={item.image}
                alt=""
                className="h-16 w-16 shrink-0 rounded-full object-cover bg-slate-100"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg font-semibold text-slate-500">
                {(item.name || '?').slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h4 className="truncate text-lg font-semibold text-slate-900">{item.name}</h4>
              <p className="truncate text-sm text-slate-500">{item.title}</p>
            </div>
          </div>
          {item.tags.length ? (
            <div className="flex flex-wrap gap-1">
              {item.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          {item.reason ? (
            <p className="text-sm leading-snug text-slate-500 line-clamp-3">{item.reason}</p>
          ) : null}
        </div>
      ) : null}
    </DiscoveryCarouselShell>
  );
}
