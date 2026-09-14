import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Award, GraduationCap } from 'lucide-react';
import { getGuideBySlug, type Guide, type GuideIcon } from '../api/guides';
import { markdownToSafeHtml } from '../utils/guideMarkdown';
import { renderSafeMessageHtml } from '../utils/safeMessageHtml';
import PublicPageShell from '../components/landing/PublicPageShell';

const ICONS: Record<GuideIcon, typeof GraduationCap> = {
  graduation: GraduationCap,
  award: Award,
};

const bodyClass =
  '[&_p]:mb-4 [&_p]:last:mb-0 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-2 [&_a]:font-medium [&_a]:text-[#234C6A] [&_a]:underline [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-slate-900 [&_strong]:font-semibold [&_strong]:text-slate-900';

export default function ResourceGuide() {
  const { slug } = useParams<{ slug: string }>();
  const [guide, setGuide] = useState<Guide | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setGuide(undefined);
    getGuideBySlug(slug || '').then(row => {
      if (!cancelled) setGuide(row);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <PublicPageShell>
      <article className="px-4 sm:px-6 pb-16 sm:pb-24" style={{ backgroundColor: '#F8FAFC' }}>
        <div className="max-w-3xl mx-auto pt-10 sm:pt-16">
          <Link
            to="/resources"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#234C6A] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            All guides
          </Link>

          {guide === undefined ? (
            <p className="mt-10 text-slate-500">Loading guide…</p>
          ) : guide === null ? (
            <div className="mt-10">
              <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900">Guide not found</h1>
              <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
                This guide is unavailable or is not published yet.
              </p>
            </div>
          ) : (
            <GuideArticle guide={guide} />
          )}
        </div>
      </article>
    </PublicPageShell>
  );
}

function GuideArticle({ guide }: { guide: Guide }) {
  const Icon = ICONS[guide.icon] || GraduationCap;
  return (
    <>
              <div className="mt-8 flex h-12 w-12 items-center justify-center rounded-xl bg-[#E8EEF4] text-[#234C6A]" aria-hidden>
                <Icon className="h-6 w-6" />
              </div>
              <h1 className="mt-5 font-display text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900">
                {guide.title}
              </h1>
              <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">{guide.description}</p>

              <nav className="mt-10 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" aria-label="On this page">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-[#234C6A]">In this guide</h2>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm sm:text-base text-slate-700">
                  {guide.sections.map(section => (
                    <li key={section.id}>
                      <a className="font-medium text-[#234C6A] hover:underline" href={`#${section.id}`}>
                        {section.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>

              <ol className="mt-12 space-y-12 sm:space-y-16 list-none">
                {guide.sections.map((section, index) => (
                  <li key={section.id} id={section.id} className="scroll-mt-28">
                    <p className="section-label text-[#234C6A] mb-2">Section {index + 1}</p>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">{section.title}</h2>
                    <div className={`mt-5 text-base sm:text-lg leading-relaxed text-slate-700 ${bodyClass}`}>
                      {renderSafeMessageHtml(markdownToSafeHtml(section.content))}
                    </div>
                  </li>
                ))}
              </ol>
    </>
  );
}
