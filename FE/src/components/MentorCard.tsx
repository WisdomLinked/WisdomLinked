import React, { useEffect, useMemo, useState } from 'react';
import { MapPin, Briefcase, GraduationCap, Users } from 'lucide-react';
import { isDisplayImageUrl } from '../utils/profileImage';

export interface MentorCardProps {
  id: string | number;
  name: string;
  title: string;
  institution: string;
  field: string;
  experience: string;
  services: string[];
  image: string | null;
  isNew: boolean;
  compact?: boolean;
  /** Shown on the card; updates when the user follows or unfollows from this page. */
  followerCount?: number;
  /** Expert resume file path or URL (students may open from profile). */
  resume?: string | null;
  /** Account status from the BE; only 'active' experts can be booked. */
  status?: string;
  onViewProfile?: (mentor: MentorCardProps) => void;
  isFollowing?: boolean;
  onToggleFollow?: (mentorId: string | number) => void;
}

const serviceColorByIndex = (index: number) => {
  if (index === 0) return 'border-[#1A3A4A] text-[#1A3A4A]';
  if (index === 1) return 'border-[#C9A84C] text-[#C9A84C]';
  if (index === 2) return 'border-[#E07B54] text-[#E07B54]';
  return 'border-[#E5E2DB] text-[#1A3A4A]';
};

const MentorCard: React.FC<MentorCardProps> = ({
  name,
  title,
  institution,
  field,
  experience,
  services,
  image,
  isNew,
  compact = false,
  followerCount = 0,
  resume = null,
  status,
  onViewProfile,
  id,
  isFollowing = false,
  onToggleFollow,
}) => {
  // Experts still in review (or otherwise not active) cannot be booked — mirrors the
  // legacy experts list which disabled the "Select" button for review experts.
  const isBookable = status === undefined || status === 'active';
  const aiHeadshotUrl = (seed: string) =>
    `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(seed)}`;

  const placeholder = useMemo(() => aiHeadshotUrl(name), [name]);
  const initialSrc =
    image && isDisplayImageUrl(image) ? image : placeholder;
  const [imgSrc, setImgSrc] = useState(initialSrc);

  useEffect(() => {
    setImgSrc(image && isDisplayImageUrl(image) ? image : placeholder);
  }, [image, placeholder]);

  const mentorPayload: MentorCardProps = {
    id,
    name,
    title,
    institution,
    field,
    experience,
    services,
    image,
    isNew,
    compact,
    followerCount,
    resume,
    status,
  };

  const canView = Boolean(onViewProfile) && isBookable;
  const handleView = () => {
    if (!canView) return;
    onViewProfile?.(mentorPayload);
  };

  return (
    <article
      onClick={handleView}
      role={canView ? 'button' : undefined}
      tabIndex={canView ? 0 : undefined}
      onKeyDown={e => {
        if (!canView) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleView();
        }
      }}
      className={`group relative flex flex-col rounded-xl border border-[#E5E2DB] bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(26,58,74,0.18)] ${
        compact ? 'p-4' : 'p-5'
      }`}
    >
      {onToggleFollow ? (
        <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onToggleFollow(id);
            }}
            className={`rounded-[4px] border px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm transition-colors ${
              isFollowing
                ? 'border-slate-500 bg-slate-500 hover:bg-slate-600'
                : 'border-slate-600 bg-slate-600 hover:bg-slate-700'
            }`}
          >
            {isFollowing ? 'Following' : 'Follow +'}
          </button>
        </div>
      ) : null}

      <div className={`flex gap-4 ${onToggleFollow ? 'pr-[4.75rem]' : ''}`}>
        <div className="relative shrink-0">
          <div className="h-28 w-20 overflow-hidden rounded-md bg-[#1A3A4A]/90 text-white flex items-center justify-center text-sm font-semibold">
            <img
              src={imgSrc}
              alt={name}
              className="h-full w-full object-cover"
              onError={() => setImgSrc(placeholder)}
            />
          </div>
          {isNew && (
            <span className="absolute -top-2 left-0 rounded-sm bg-[#C9A84C] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#1A3A4A] shadow-sm">
              NEW
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-[1.1rem] font-medium text-[#1A3A4A] leading-snug">
            {name}
          </h3>
          <p className="mt-1 text-[0.85rem] text-[#7A7A72] leading-snug line-clamp-2">
            {title}
          </p>
          <p className="mt-1 flex items-center gap-1 text-[0.8rem] text-[#7A7A72]">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            <span className="truncate">{institution}</span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.78rem] text-[#1A3A4A]">
            <span className="inline-flex items-center gap-1 rounded-[3px] bg-[#F5F3EF] px-2 py-1">
              <GraduationCap className="h-3.5 w-3.5" aria-hidden />
              <span>{field}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-[3px] bg-[#F5F3EF] px-2 py-1">
              <Briefcase className="h-3.5 w-3.5" aria-hidden />
              <span>{experience} experience</span>
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-[#E5E2DB] pt-3">
        <p className="mb-2 flex items-center gap-1 text-[0.7rem] font-medium uppercase tracking-[0.18em] text-[#7A7A72]">
          <Users className="h-3 w-3" aria-hidden />
          <span>Provides</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {services.map((service, idx) => (
            <span
              key={service}
              className={`inline-flex items-center rounded-[3px] border px-2 py-0.5 text-[0.75rem] ${serviceColorByIndex(
                idx,
              )}`}
            >
              {service}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        {isBookable ? (
          <button
            type="button"
            className="rounded-[4px] bg-[#1A3A4A] px-3 py-1.5 text-[0.78rem] font-semibold text-white hover:bg-[#122635]"
            onClick={e => {
              e.stopPropagation();
              handleView();
            }}
          >
            View Profile
          </button>
        ) : (
          <button
            type="button"
            disabled
            title="This expert is not yet available for booking"
            className="cursor-not-allowed rounded-[4px] bg-[#E5E2DB] px-3 py-1.5 text-[0.78rem] font-semibold text-[#7A7A72]"
            onClick={e => e.stopPropagation()}
          >
            In review
          </button>
        )}
      </div>
    </article>
  );
};

export default MentorCard;

