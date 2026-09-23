import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Award, GraduationCap } from 'lucide-react';
import { getGuides, type Guide, type GuideIcon } from '../api/guides';
import PublicPageShell from '../components/landing/PublicPageShell';

const ICONS: Record<GuideIcon, typeof GraduationCap> = {
  graduation: GraduationCap,
  award: Award,
};

export default function Resources() {
  const [guides, setGuides] = useState<Guide[]>([]);

  useEffect(() => {
    let cancelled = false;
    getGuides().then(rows => {
      if (!cancelled) setGuides(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PublicPageShell>
      <section className="px-4 sm:px-6 pb-16 sm:pb-24" style={{ backgroundColor: '#F0F4F8' }}>
        <div className="max-w-7xl mx-auto pt-10 sm:pt-16">
          <div className="text-center mb-10 sm:mb-14">
            <div className="section-label text-[#234C6A] mb-4">Resources</div>
            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Guides for students
            </h1>
            <p className="text-slate-600 text-base sm:text-lg max-w-2xl mx-auto">
              Practical advice on graduate school, scholarships, and building a stronger application.
            </p>
          </div>

          {guides.length === 0 ? (
            <p className="text-center text-slate-500">Loading guides…</p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {guides.map(guide => {
                const Icon = ICONS[guide.icon] || GraduationCap;
                return (
                  <li key={guide.id}>
                    <Link
                      to={`/resources/${guide.slug}`}
                      className="card-hover flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"
                    >
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E8EEF4] text-[#234C6A]"
                        aria-hidden
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                      <h2 className="mt-5 font-display text-2xl font-bold text-slate-900">{guide.title}</h2>
                      <p className="mt-3 flex-1 text-sm sm:text-base text-slate-600 leading-relaxed">
                        {guide.description}
                      </p>
                      <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#234C6A]">
                        Read guide
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </PublicPageShell>
  );
}
