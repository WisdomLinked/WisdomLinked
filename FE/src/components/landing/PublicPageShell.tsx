import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import SignupModal from '../SignupModal';

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
  const [showSignupModal, setShowSignupModal] = useState(false);
  const onResources = location.pathname.startsWith('/resources');

  const go = (to: string) => {
    setMobileMenuOpen(false);
    navigate(to);
  };

  return (
    <div className="min-h-screen text-slate-900" style={{ fontFamily: "'DM Sans', sans-serif", backgroundColor: '#F8FAFC' }}>
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
        className="fixed left-0 right-0 z-40 bg-[#F8FAFC]/95 backdrop-blur-md shadow-sm border-b border-[#BCCCDC]"
        style={{ top: 'var(--wl-banner-offset, 0px)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16 sm:h-[4.5rem] py-3 sm:py-4">
          <Link to="/" className="flex items-center gap-3 group">
            <img src="/logos/main_gold_blue.svg" alt="WisdomLinked" className="h-10 w-auto max-w-[200px] object-contain object-left" />
            <div className="leading-none">
              <div className="font-display font-bold text-[1.35rem] text-slate-900">WisdomLinked</div>
            </div>
          </Link>
          <nav className="hidden lg:flex items-center gap-8" aria-label="Main">
            {sectionLinks.map(item => {
              const active = item.to === '/resources' && onResources;
              if (item.to === '/resources') {
                return (
                  <Link
                    key={item.label}
                    to="/resources"
                    className={`nav-link text-sm font-semibold tracking-wide transition-colors ${
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
                  className="nav-link text-slate-900 hover:text-[#234C6A] transition-colors text-sm font-semibold tracking-wide"
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
          <div className="hidden lg:flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="px-5 py-2.5 rounded-full border border-[#BCCCDC] text-slate-900 hover:border-[#9AA6B2] hover:text-[#234C6A] transition-all text-sm font-semibold bg-white/85"
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setShowSignupModal(true)}
              className="btn-primary px-5 py-2.5 rounded-full text-white font-semibold text-sm shadow-md shadow-[#BCCCDC]"
            >
              Sign Up
            </button>
          </div>
          <button
            type="button"
            className="lg:hidden p-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition"
            onClick={() => setMobileMenuOpen(v => !v)}
            aria-expanded={mobileMenuOpen}
            aria-label="Open menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-slate-600" /> : <Menu className="w-5 h-5 text-slate-600" />}
          </button>
        </div>
        {mobileMenuOpen ? (
          <div className="lg:hidden border-t border-[#BCCCDC] bg-[#F8FAFC] px-4 sm:px-6 py-4 space-y-3">
            {sectionLinks.map(item =>
              item.to === '/resources' ? (
                <Link
                  key={item.label}
                  to="/resources"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block w-full text-left text-slate-700 hover:text-[#234C6A] font-semibold py-1 transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => go(item.to)}
                  className="block w-full text-left text-slate-700 hover:text-[#234C6A] font-semibold py-1 transition-colors"
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
                className="flex-1 py-2.5 rounded-full border border-slate-300 text-slate-700 text-sm font-semibold"
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setShowSignupModal(true);
                }}
                className="flex-1 py-2.5 btn-primary rounded-full text-white text-sm font-semibold"
              >
                Sign Up
              </button>
            </div>
          </div>
        ) : null}
      </header>

      <div className="pt-20 sm:pt-24">{children}</div>

      <footer className="footer-bg text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <Link to="/" className="flex items-center gap-3">
              <img src="/logos/b_w.svg" alt="" className="h-10 w-auto max-w-[200px] object-contain object-left" />
              <span className="font-display font-bold text-lg text-white">WisdomLinked</span>
            </Link>
            <p className="text-slate-500 text-sm">© 2026 WisdomLinked. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
