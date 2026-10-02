import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Search, X } from 'lucide-react';
import SignupModal from '../SignupModal';
import SiteSearchBox from '../search/SiteSearchBox';

const sectionLinks = [
  { label: 'About Us', to: '/' },
  { label: 'Services', to: '/' },
  { label: 'Guidelines', to: '/' },
  { label: 'Pricing', to: '/' },
  { label: 'Resources', to: '/resources' },
  { label: 'Contact Us', to: '/' },
] as const;

export default function PublicPageShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const onResources = location.pathname.startsWith('/resources');

  const go = (to: string) => {
    setMobileMenuOpen(false);
    setMobileSearchOpen(false);
    navigate(to);
  };

  return (
    <div
      className="min-h-screen flex flex-col text-slate-900"
      style={{ fontFamily: "'DM Sans', sans-serif", backgroundColor: '#F8FAFC' }}
    >
      {showSignupModal ? (
        <SignupModal
          onClose={() => setShowSignupModal(false)}
          onGoLogin={() => {
            setShowSignupModal(false);
            navigate('/login');
          }}
        />
      ) : null}

      <style>{`
        .font-display { font-family: 'Playfair Display', serif; }
        .nav-link { position: relative; }
        .nav-link::after { content: ''; position: absolute; bottom: -2px; left: 0; width: 0; height: 2px; background: #9AA6B2; transition: width 0.3s ease; }
        .nav-link:hover::after, .nav-link.is-active::after { width: 100%; }
        .btn-primary { background: linear-gradient(135deg, #234C6A, #456882); transition: all 0.3s ease; }
        .btn-primary:hover { background: linear-gradient(135deg, #1B3C53, #234C6A); box-shadow: 0 12px 40px rgba(26,53,72,0.38); transform: translateY(-1px); }
        .card-hover { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .card-hover:hover { transform: translateY(-6px); box-shadow: 0 20px 60px -10px rgba(0,0,0,0.15); }
        .footer-bg { background: #1B3C53; }
        .section-label { letter-spacing: 0.15em; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
      `}</style>

      <header
        data-wl-header
        className="fixed left-0 right-0 z-40 bg-[#F8FAFC]/95 backdrop-blur-md shadow-sm border-b border-[#BCCCDC]"
        style={{ top: 'var(--wl-banner-offset, 0px)' }}
      >
        <div className="grid h-16 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-6 sm:h-[4.5rem] lg:px-8 2xl:px-12">
          <Link to="/" className="flex shrink-0 items-center gap-3 group">
            <img src="/logos/main_gold_blue.svg" alt="WisdomLinked" className="h-10 w-auto max-w-[200px] object-contain object-left" />
            <div className="leading-none">
              <div className="font-display font-bold text-[1.35rem] text-slate-900">WisdomLinked</div>
            </div>
          </Link>

          <div className="hidden min-w-0 items-center justify-center gap-4 lg:flex xl:gap-5 2xl:gap-6">
            <nav className="flex shrink-0 items-center gap-4 xl:gap-5 2xl:gap-6" aria-label="Main">
              {sectionLinks.map(item => {
                const active = item.to === '/resources' && onResources;
                if (item.to === '/resources') {
                  return (
                    <Link
                      key={item.label}
                      to="/resources"
                      className={`nav-link whitespace-nowrap text-sm font-semibold tracking-wide transition-colors ${
                        active ? 'is-active text-[#234C6A]' : 'text-slate-900 hover:text-[#234C6A]'
                      }`}
                      aria-current={active ? 'page' : undefined}
                    >
                      {item.label}
                    </Link>
                  );
                }
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => go(item.to)}
                    className="nav-link whitespace-nowrap text-sm font-semibold tracking-wide text-slate-900 transition-colors hover:text-[#234C6A]"
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
            <div className="min-w-[220px] max-w-[380px] flex-1 xl:min-w-[260px] xl:max-w-[440px]">
              <SiteSearchBox
                audience="public"
                variant="nav"
                showShortcutHint
                placeholder="Search mentors, universities, or topics"
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2">
            <div className="hidden items-center gap-3 lg:flex">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="h-10 px-5 rounded-full border border-[#BCCCDC] text-slate-900 hover:border-[#9AA6B2] hover:text-[#234C6A] transition-all text-sm font-semibold bg-white/85"
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setShowSignupModal(true)}
                className="btn-primary h-10 px-5 rounded-full text-white font-semibold text-sm shadow-md shadow-[#BCCCDC]"
              >
                Sign Up
              </button>
            </div>
            <div className="flex items-center gap-2 lg:hidden">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/85 text-slate-600 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/40"
                aria-label={mobileSearchOpen ? 'Close search' : 'Open search'}
                aria-expanded={mobileSearchOpen}
                onClick={() => {
                  setMobileSearchOpen(open => !open);
                  setMobileMenuOpen(false);
                }}
              >
                <Search className="h-[18px] w-[18px]" aria-hidden />
              </button>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-100 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/40"
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileMenuOpen}
                onClick={() => {
                  setMobileMenuOpen(v => !v);
                  setMobileSearchOpen(false);
                }}
              >
                {mobileMenuOpen ? <X className="w-5 h-5 text-slate-600" /> : <Menu className="w-5 h-5 text-slate-600" />}
              </button>
            </div>
          </div>
        </div>

        {mobileSearchOpen ? (
          <div className="border-t border-[#BCCCDC] bg-[#F8FAFC] px-6 py-3 lg:hidden">
            <SiteSearchBox
              audience="public"
              variant="nav"
              autoFocus
              placeholder="Search mentors, universities, or topics"
            />
          </div>
        ) : null}

        {mobileMenuOpen ? (
          <div className="space-y-3 border-t border-[#BCCCDC] bg-[#F8FAFC] px-6 py-4 lg:hidden">
            {sectionLinks.map(item =>
              item.to === '/resources' ? (
                <Link
                  key={item.label}
                  to="/resources"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setMobileSearchOpen(false);
                  }}
                  className="block w-full py-1 text-left font-semibold text-slate-700 transition-colors hover:text-[#234C6A]"
                >
                  {item.label}
                </Link>
              ) : (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => go(item.to)}
                  className="block w-full py-1 text-left font-semibold text-slate-700 transition-colors hover:text-[#234C6A]"
                >
                  {item.label}
                </button>
              ),
            )}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate('/login');
                }}
                className="flex-1 py-2.5 rounded-full border border-slate-300 text-sm font-semibold text-slate-700"
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setShowSignupModal(true);
                }}
                className="flex-1 py-2.5 btn-primary rounded-full text-sm font-semibold text-white"
              >
                Sign Up
              </button>
            </div>
          </div>
        ) : null}
      </header>

      <div className="flex-1 flex flex-col pt-20 sm:pt-24">{children}</div>

      <footer className="footer-bg text-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <Link to="/" className="flex items-center gap-3">
              <img src="/logos/b_w.svg" alt="" className="h-8 w-auto max-w-[160px] object-contain object-left" />
              <span className="font-display font-bold text-base text-white">WisdomLinked</span>
            </Link>
            <p className="text-slate-500 text-sm">© 2026 WisdomLinked. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
