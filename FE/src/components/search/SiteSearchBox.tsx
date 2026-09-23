import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { profileImageFetch, searchSite } from '../../api/api';
import { isDisplayImageUrl } from '../../utils/profileImage';
import {
  SITE_SEARCH_DEBOUNCE_MS,
  adminUserMgmtEmailHref,
  hrefForExpertHit,
  hrefForFindExperts,
  hrefForSeminarHit,
  hrefForStudentSeminars,
  isEmailQuery,
  isSeminarCoverUrl,
  normalizeSiteSearchResponse,
  type SiteSearchAudience,
  type SiteSearchResponse,
} from '../../utils/siteSearch';

function ProfileFilenameImage({
  filename,
  alt,
}: {
  filename?: string;
  alt: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const name = typeof filename === 'string' ? filename.trim() : '';
    setSrc(null);
    if (!name || isSeminarCoverUrl(name) || isDisplayImageUrl(name)) return undefined;
    profileImageFetch(name, 'small').then((fetched) => {
      if (cancelled) return;
      const url = typeof fetched === 'string' ? fetched.trim() : '';
      setSrc(isDisplayImageUrl(url) ? url : null);
    });
    return () => {
      cancelled = true;
    };
  }, [filename]);

  if (!src) return null;
  return <img src={src} alt={alt} className="h-10 w-10 shrink-0 rounded-full object-cover" />;
}

function SeminarCover({ image, alt }: { image?: string; alt: string }) {
  if (!isSeminarCoverUrl(image)) return null;
  return <img src={image} alt={alt} className="h-10 w-14 shrink-0 rounded-md object-cover" />;
}

function ResultShell({
  href,
  children,
}: {
  href: string | null;
  children: React.ReactNode;
}) {
  const className = 'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-[#F5F3EF]';
  if (!href) return <div className={className}>{children}</div>;
  return (
    <Link to={href} className={className}>
      {children}
    </Link>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-2">
      <h2 className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7A7A72]">
        {title}
      </h2>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

export default function SiteSearchBox({
  audience,
  tone = 'light',
}: {
  audience: SiteSearchAudience;
  tone?: 'light' | 'dark';
}) {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const requestRef = useRef(0);
  const [query, setQuery] = useState('');
  // Keyword cards stay until a search response replaces them.
  // A later ask must not clear this list, and a new search must not wipe it before it returns.
  const [searchCards, setSearchCards] = useState<SiteSearchResponse | null>(null);
  const [open, setOpen] = useState(false);

  const trimmed = query.trim();
  const adminEmail = audience === 'admin' && isEmailQuery(trimmed);

  useEffect(() => {
    if (trimmed.length < 2) return undefined;
    if (adminEmail) {
      const timer = window.setTimeout(() => {
        navigate(adminUserMgmtEmailHref(trimmed));
      }, SITE_SEARCH_DEBOUNCE_MS);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      const requestId = ++requestRef.current;
      searchSite(trimmed)
        .then((data) => {
          if (requestId !== requestRef.current) return;
          setSearchCards(normalizeSiteSearchResponse(data));
          setOpen(true);
        })
        .catch(() => {
          // Keep the cards already on screen.
        });
    }, SITE_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [trimmed, adminEmail, navigate]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target || !rootRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const cards = searchCards;
  const showPanel = open && trimmed.length >= 2 && !adminEmail && cards != null;
  const findExpertsHref = hrefForFindExperts(audience, trimmed);
  const seminarsHref = hrefForStudentSeminars(audience, trimmed);
  const hasAny =
    !!cards &&
    (cards.experts.length > 0 ||
      cards.seminars.length > 0 ||
      cards.students.length > 0 ||
      cards.yours.length > 0 ||
      cards.pages.length > 0);

  const inputClass =
    tone === 'dark'
      ? 'w-full bg-transparent text-sm text-white placeholder:text-white/60 outline-none'
      : 'w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 outline-none';
  const shellClass =
    tone === 'dark'
      ? 'flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1.5'
      : 'flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5';

  return (
    <div ref={rootRef} className="relative w-full min-w-0" data-site-search={audience}>
      <div className={shellClass}>
        <Search className={`h-3.5 w-3.5 shrink-0 ${tone === 'dark' ? 'text-white/70' : 'text-slate-400'}`} aria-hidden />
        <input
          type="search"
          value={query}
          aria-label="Search WisdomLinked"
          placeholder="Search"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
          }}
          className={inputClass}
        />
      </div>
      {showPanel ? (
        <div
          data-testid="site-search-results"
          className="absolute left-0 right-0 top-full z-[80] mt-1 max-h-96 overflow-y-auto rounded-xl border border-[#E5E2DB] bg-white p-2 text-slate-800 shadow-[0_16px_40px_rgba(0,0,0,0.14)]"
        >
          {cards!.experts.length > 0 ? (
            <Group title="Experts">
              {cards!.experts.map((expert) => (
                <ResultShell key={expert.id} href={hrefForExpertHit(audience, expert.id)}>
                  <ProfileFilenameImage filename={expert.image} alt={expert.name} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-slate-900">{expert.name}</span>
                    {expert.title ? (
                      <span className="block truncate text-[11px] text-[#7A7A72]">{expert.title}</span>
                    ) : null}
                  </span>
                </ResultShell>
              ))}
            </Group>
          ) : null}
          {cards!.seminars.length > 0 ? (
            <Group title="Seminars">
              {cards!.seminars.map((seminar) => (
                <ResultShell key={seminar.id} href={hrefForSeminarHit(audience, seminar.id)}>
                  <SeminarCover image={seminar.image} alt={`${seminar.name} cover`} />
                  <ProfileFilenameImage filename={seminar.hostImage} alt={`${seminar.name} host`} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-slate-900">{seminar.name}</span>
                    {seminar.description ? (
                      <span className="block truncate text-[11px] text-[#7A7A72]">{seminar.description}</span>
                    ) : null}
                  </span>
                </ResultShell>
              ))}
            </Group>
          ) : null}
          {cards!.students.length > 0 ? (
            <Group title="Students">
              {cards!.students.map((student) => (
                <ResultShell key={student.id} href={null}>
                  <ProfileFilenameImage filename={student.image} alt={student.name} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-slate-900">{student.name}</span>
                    <span className="block truncate text-[11px] text-[#7A7A72]">
                      {[student.degreeSought, student.currentUniversity].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </ResultShell>
              ))}
            </Group>
          ) : null}
          {cards!.yours.length > 0 ? (
            <Group title="Your sessions">
              {cards!.yours.map((session) => (
                <ResultShell key={session.id} href={null}>
                  <ProfileFilenameImage filename={session.expert?.image} alt={session.expert?.name || 'Expert'} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-slate-900">{session.name}</span>
                    <span className="block truncate text-[11px] text-[#7A7A72]">
                      {[session.student?.name, session.expert?.name].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </ResultShell>
              ))}
            </Group>
          ) : null}
          {cards!.pages.length > 0 ? (
            <Group title="Pages">
              {cards!.pages.map((page) => (
                <ResultShell key={`${page.route}-${page.title}`} href={page.route}>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-slate-900">{page.title}</span>
                    {page.snippet ? (
                      <span className="block truncate text-[11px] text-[#7A7A72]">{page.snippet}</span>
                    ) : null}
                  </span>
                </ResultShell>
              ))}
            </Group>
          ) : null}
          {!hasAny ? (
            <p className="px-2 py-3 text-center text-[12px] text-slate-500">No matches</p>
          ) : null}
          {findExpertsHref || seminarsHref ? (
            <div className="mt-1 flex gap-2 border-t border-[#E5E2DB] px-2 pt-2">
              {findExpertsHref ? (
                <Link to={findExpertsHref} className="text-[12px] font-semibold text-[#234C6A] hover:underline">
                  Find experts
                </Link>
              ) : null}
              {seminarsHref ? (
                <Link to={seminarsHref} className="text-[12px] font-semibold text-[#234C6A] hover:underline">
                  Seminars
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
