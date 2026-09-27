import Badge from '../../ui/Badge';
import DiscoveryCarouselShell, { useDiscoveryCarousel } from './DiscoveryCarouselShell';
import type { DiscoveryExpert } from '../../../utils/studentDiscovery';

type Props = {
  items: DiscoveryExpert[];
  onViewProfile: (id: string) => void;
};

export default function NewExpertsCard({ items, onViewProfile }: Props) {
  const { index, fading, prev, next } = useDiscoveryCarousel(items.length);
  const item = items[index];

  return (
    <DiscoveryCarouselShell
      title="New experts"
      count={items.length}
      index={index}
      onPrev={prev}
      onNext={next}
      fading={fading}
      empty={
        <p className="py-5 text-center text-sm text-slate-500">
          New experts will appear here as they join.
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
        <>
          <div className="mb-3 h-48 w-full overflow-hidden rounded-xl bg-slate-100">
            {item.image ? (
              <img
                src={item.image}
                alt={item.name}
                className="h-full w-full object-cover object-center"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-slate-300">
                No photo
              </div>
            )}
          </div>
          <div className="mb-1.5">
            <Badge category="Expert">{item.isNew ? 'New expert' : 'Expert'}</Badge>
          </div>
          <h4 className="mb-0.5 text-lg font-semibold text-slate-900">{item.name}</h4>
          <p className="text-sm leading-snug text-slate-500 line-clamp-2">
            {item.institution || item.title}
          </p>
          {item.field ? (
            <p className="mt-1 text-xs text-slate-600">
              Field: {item.field}
            </p>
          ) : null}
        </>
      ) : null}
    </DiscoveryCarouselShell>
  );
}
