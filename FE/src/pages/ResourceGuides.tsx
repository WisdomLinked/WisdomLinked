import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Award, GraduationCap } from 'lucide-react';
import { getGuides, type Guide, type GuideIcon } from '../api/guides';
import { markdownToSafeHtml } from '../utils/guideMarkdown';
import { renderSafeMessageHtml } from '../utils/safeMessageHtml';
import PublicPageShell from '../components/landing/PublicPageShell';
import { FOCUS_RING } from '../components/resources/styles';

const ICONS: Record<GuideIcon, typeof GraduationCap> = {
  graduation: GraduationCap,
  award: Award,
};

const bodyClass =
  '[&_p]:mb-4 [&_p]:last:mb-0 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-2 [&_a]:font-medium [&_a]:text-[#234C6A] [&_a]:underline [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-slate-900 [&_strong]:font-semibold [&_strong]:text-slate-900';

export default function ResourceGuides() {
  const [guides, setGuides] = useState<Guide[] | null>(null);
  const { hash } = useLocation();

  useEffect(() => {
    let cancelled = false;
    getGuides().then(rows => {
      if (!cancelled) setGuides(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!guides || !hash) return;
    const target = document.getElementById(decodeURIComponent(hash.slice(1)));
    target?.scrollIntoView({ block: 'start' });
  }, [guides, hash]);

  return (
    <PublicPageShell>
      <article className="flex-1 px-4 sm:px-6 pb-16 sm:pb-24" style={{ backgroundColor: '#F8FAFC' }}>
        <div className="max-w-3xl mx-auto pt-10 sm:pt-16">
          <Link
            to="/resources"
            className={`inline-flex items-center gap-2 rounded-sm text-sm font-semibold text-[#234C6A] hover:underline ${FOCUS_RING}`}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to resources
          </Link>

          <h1 className="mt-8 font-display text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900">
            Guides for students
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            Practical advice on graduate school, scholarships, and building a stronger application.
          </p>

          {guides === null ? (
            <p className="mt-10 text-slate-500">Loading guides…</p>
          ) : (
            <>
              <nav className="mt-10 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" aria-label="On this page">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-[#234C6A]">In this guide</h2>
                <ol className="mt-4 space-y-5">
                  {guides.map(guide => (
                    <li key={guide.id}>
                      <a
                        className={`rounded-sm font-semibold text-slate-900 hover:text-[#234C6A] hover:underline ${FOCUS_RING}`}
                        href={`#${guide.slug}`}
                      >
                        {guide.title}
                      </a>
                      <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm sm:text-base text-slate-700">
                        {guide.sections.map(section => (
                          <li key={section.id}>
                            <a
                              className={`rounded-sm font-medium text-[#234C6A] hover:underline ${FOCUS_RING}`}
                              href={`#${section.id}`}
                            >
                              {section.title}
                            </a>
                          </li>
                        ))}
                      </ol>
                    </li>
                  ))}
                </ol>
              </nav>

              <div className="mt-14 space-y-16 sm:space-y-20">
                {guides.map(guide => (
                  <GuideBlock key={guide.id} guide={guide} />
                ))}
              </div>
            </>
          )}
        </div>
      </article>
    </PublicPageShell>
  );
}

function GuideBlock({ guide }: { guide: Guide }) {
  const Icon = ICONS[guide.icon] || GraduationCap;
  const headingId = `${guide.slug}-title`;
  return (
    <section id={guide.slug} aria-labelledby={headingId} className="scroll-mt-28">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E8EEF4] text-[#234C6A]" aria-hidden>
        <Icon className="h-6 w-6" />
      </div>
      <h2 id={headingId} className="mt-5 font-display text-3xl sm:text-4xl font-bold text-slate-900">
        {guide.title}
      </h2>
      <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">{guide.description}</p>

      <ol className="mt-10 space-y-12 list-none">
        {guide.sections.map((section, index) => (
          <li key={section.id} id={section.id} className="scroll-mt-28">
            <p className="section-label text-[#234C6A] mb-2">Section {index + 1}</p>
            <h3 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">{section.title}</h3>
            <div className={`mt-5 text-base sm:text-lg leading-relaxed text-slate-700 ${bodyClass}`}>
              {renderSafeMessageHtml(markdownToSafeHtml(section.content))}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
