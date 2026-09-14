import React, { useEffect, useState } from 'react';
import { ArrowRight, Building2, GraduationCap } from 'lucide-react';
import { getFeaturedExperts } from '../api/api';

export type FeaturedExpertType = 'academic' | 'industry';

export type FeaturedExpert = {
  id: string;
  name: string;
  title: string;
  organization: string;
  type: FeaturedExpertType;
  photoUrl: string;
};

export const mockExperts: FeaturedExpert[] = [
  {
    id: 'bruce-wang',
    name: 'Dr. Bruce Wang',
    title: 'Professor of Transportation Engineering',
    organization: 'UC Berkeley',
    type: 'academic',
    photoUrl: '',
  },
  {
    id: 'mei-chen',
    name: 'Dr. Mei Chen',
    title: 'Associate Professor of Traffic Systems',
    organization: 'MIT',
    type: 'academic',
    photoUrl: '',
  },
  {
    id: 'james-okonkwo',
    name: 'Prof. James Okonkwo',
    title: 'Chair of Civil & Transportation',
    organization: 'Imperial College London',
    type: 'academic',
    photoUrl: '',
  },
  {
    id: 'sarah-lindholm',
    name: 'Dr. Sarah Lindholm',
    title: 'Professor of Transit Planning',
    organization: 'KTH',
    type: 'academic',
    photoUrl: '',
  },
  {
    id: 'priya-raman',
    name: 'Priya Raman',
    title: 'Principal Transportation Planner',
    organization: 'AECOM',
    type: 'industry',
    photoUrl: '',
  },
  {
    id: 'michael-torres',
    name: 'Michael Torres',
    title: 'Director of Traffic Operations',
    organization: 'WSP',
    type: 'industry',
    photoUrl: '',
  },
  {
    id: 'elena-vasquez',
    name: 'Elena Vasquez',
    title: 'Senior Mobility Engineer',
    organization: 'Arup',
    type: 'industry',
    photoUrl: '',
  },
  {
    id: 'david-kim',
    name: 'David Kim',
    title: 'Head of Intelligent Transportation',
    organization: 'HDR',
    type: 'industry',
    photoUrl: '',
  },
];

export function expertInitials(name: string): string {
  return name
    .replace(/^(Dr|Prof|Professor)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();
}

export function resolveFeaturedPhotoSrc(photoUrl: string): string {
  const v = String(photoUrl || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v) || v.startsWith('/') || /^data:/i.test(v)) return v;
  return `/api/image-fetch?file=${encodeURIComponent(v)}&folder=small`;
}

export function ExpertPhoto({
  name,
  photoUrl,
  size = 'md',
}: {
  name: string;
  photoUrl: string;
  size?: 'sm' | 'md';
}) {
  const [failed, setFailed] = useState(false);
  const src = resolveFeaturedPhotoSrc(photoUrl);
  const showPhoto = Boolean(src) && !failed;
  const box = size === 'sm' ? 'h-10 w-10 text-xs' : 'h-16 w-16 text-sm';

  if (showPhoto) {
    return (
      <img
        src={src}
        alt={name}
        className={`${box} rounded-full object-cover border border-slate-200`}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={`flex ${box} items-center justify-center rounded-full bg-[#E8EEF4] font-bold text-[#234C6A]`}
      aria-hidden
    >
      {expertInitials(name)}
    </div>
  );
}

export default function FeaturedExperts({ onViewAll }: { onViewAll: () => void }) {
  const [experts, setExperts] = useState<FeaturedExpert[]>(mockExperts);

  useEffect(() => {
    let cancelled = false;
    getFeaturedExperts().then(rows => {
      if (cancelled) return;
      if (rows.length) {
        setExperts(
          rows.map(row => ({
            id: row.id,
            name: row.name,
            title: row.title,
            organization: row.organization,
            type: row.type,
            photoUrl: row.photoUrl || '',
          })),
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="relative py-16 sm:py-20 md:py-28 px-4 sm:px-6 scroll-mt-20" style={{ backgroundColor: '#F0F4F8' }}>
      <div className="page-dots-layer page-dots-layer--animated" aria-hidden="true" />
      <div className="relative z-10 max-w-7xl mx-auto">
        <div className="text-center mb-10 sm:mb-16">
          <div className="inline-block section-label text-[#234C6A] mb-4">Our Network</div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            Learn From Leaders in Transportation Engineering
          </h2>
          <p className="text-slate-600 text-base sm:text-lg">
            Professors and industry experts ready to guide you
          </p>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {experts.map(expert => {
            const OrgIcon = expert.type === 'academic' ? GraduationCap : Building2;
            return (
              <li
                key={expert.id}
                className="card-hover rounded-2xl border border-slate-200 p-5 sm:p-6"
                style={{
                  background:
                    'linear-gradient(rgba(69,104,130,0.06), rgba(69,104,130,0.06)), #F0F4F8',
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <ExpertPhoto name={expert.name} photoUrl={expert.photoUrl} />
                  <span
                    className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      expert.type === 'academic'
                        ? 'bg-[#E8EEF4] text-[#234C6A]'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {expert.type === 'academic' ? 'Academic' : 'Industry'}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">{expert.name}</h3>
                <p className="mt-1 text-sm text-slate-600 leading-snug">{expert.title}</p>
                <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <OrgIcon className="h-3.5 w-3.5 shrink-0 text-[#234C6A]" aria-hidden />
                  <span>{expert.organization}</span>
                </p>
              </li>
            );
          })}
        </ul>

        <div className="mt-10 sm:mt-12 flex justify-center">
          <button
            type="button"
            onClick={onViewAll}
            className="group btn-primary inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-md shadow-[#BCCCDC]"
          >
            View all experts
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
          </button>
        </div>
      </div>
    </section>
  );
}
