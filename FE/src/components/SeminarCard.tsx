import React from 'react';
import { Calendar as CalendarIcon, Clock, MapPin, BookOpen } from 'lucide-react';

export interface SeminarCardProps {
  id: number;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  field: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  topics: string[];
  image: string | null;
  isRecommended: boolean;
}

const topicColorByIndex = (index: number) => {
  if (index === 0) return 'border-[#1A3A4A] text-[#1A3A4A]';
  if (index === 1) return 'border-[#C9A84C] text-[#C9A84C]';
  if (index === 2) return 'border-[#E07B54] text-[#E07B54]';
  return 'border-[#E5E2DB] text-[#1A3A4A]';
};

const SeminarCard: React.FC<SeminarCardProps> = ({
  title,
  description,
  date,
  time,
  location,
  field,
  level,
  topics,
  image,
}) => {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-[#E5E2DB] bg-white shadow-[0_10px_25px_rgba(26,58,74,0.12)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(26,58,74,0.18)]">
      {/* Image / header */}
      <div className="relative w-full overflow-hidden rounded-t-xl bg-[#1A3A4A]">
        <div className="relative h-40 w-full sm:h-44">
          {image ? (
            <img
              src={image}
              alt={title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-white">
              <BookOpen className="h-8 w-8" aria-hidden />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-black/5 to-transparent" />
        </div>
        {/* Level badge */}
        <div className="absolute left-3 top-3 inline-flex items-center rounded-full bg-[#1A3A4A]/80 px-2.5 py-0.5 text-[0.7rem] font-medium uppercase tracking-[0.14em] text-white backdrop-blur">
          {level}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
        <h3 className="font-serif text-[1.05rem] font-medium leading-snug text-[#1A3A4A]">
          {title}
        </h3>
        <p className="mt-1 line-clamp-2 text-[0.85rem] font-sans text-[#7A7A72]">
          {description}
        </p>

        {/* Meta rows */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.8rem] font-sans text-[#7A7A72]">
          <span className="inline-flex items-center gap-1">
            <CalendarIcon className="h-3.5 w-3.5" aria-hidden />
            <span>
              {date} · {time}
            </span>
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            <span className="truncate">{location}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#1A3A4A]" />
            <span>{field}</span>
          </span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-1 text-[0.78rem] font-sans text-[#7A7A72]">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#C9A84C]" />
            <span>{level}</span>
          </span>
        </div>

        {/* Topics */}
        <div className="mt-3">
          <p className="mb-1 flex items-center gap-1 text-[0.7rem] font-medium uppercase tracking-[0.18em] text-[#7A7A72]">
            <Clock className="h-3 w-3" aria-hidden />
            <span>Topics</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {topics.map((topic, idx) => (
              <span
                key={topic}
                className={`inline-flex items-center rounded-[3px] border px-2 py-0.5 text-[0.75rem] font-medium ${topicColorByIndex(
                  idx,
                )}`}
              >
                {topic}
              </span>
            ))}
          </div>
        </div>

        {/* Button */}
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="w-full rounded-[4px] bg-[#1A3A4A] px-3 py-1.75 text-[0.8rem] font-semibold text-white hover:bg-[#122635]"
          >
            View Details
          </button>
        </div>
      </div>
    </article>
  );
};

export default SeminarCard;

