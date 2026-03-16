import React, { useState } from 'react';

const POPUP_MESSAGE = 'Update your preferences in the profile section after logging in to receive better service.';

const BASE_URL = (process.env.REACT_APP_API_BASE_URL || '').replace(/\/$/, '');
function getAuthRedirectUrl(provider: string, role?: string) {
  const envUrl = process.env[`REACT_APP_${provider.toUpperCase()}_AUTH_URL`];
  const base = envUrl || (BASE_URL ? `${BASE_URL}/auth/${provider}` : '#');
  if (base === '#') return base;
  return role ? `${base}?role=${role}` : base;
}

/* Minimal brand SVG icons (24x24) */
const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const FacebookIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
    <path d="M24 12c0-6.627-5.373-12-12-12S0 5.373 0 12c0 5.99 4.388 10.954 10.125 11.854V15.47H7.078V12h3.047V9.356c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.234 2.686.234v2.953H15.83c-1.491 0-1.956.925-1.956 1.874V12h3.328l-.532 3.469h-2.796v8.385C19.612 22.954 24 17.99 24 12z" fill="#1877F2"/>
  </svg>
);

const XIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="#000000"/>
  </svg>
);

export default function SocialAuthBlock({ role }: { role?: string } = {}) {
  const [showPopup, setShowPopup] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<string | null>(null); // 'google' | 'facebook' | 'twitter'

  const handleSocialClick = (provider: string) => {
    setPendingProvider(provider);
    setShowPopup(true);
  };

  const handleContinue = () => {
    if (pendingProvider) {
      const url = getAuthRedirectUrl(pendingProvider, role);
      if (url && url !== '#') window.location.href = url;
    }
    setShowPopup(false);
    setPendingProvider(null);
  };

  return (
    <>
      <div className="mt-6">
        <div className="relative flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Or continue with</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => handleSocialClick('google')}
            className="flex items-center justify-center gap-2 w-full flex-1 min-w-0 py-3 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:border-slate-300 hover:bg-slate-50 transition-colors"
            aria-label="Continue with Google"
          >
            <GoogleIcon /> <span className="hidden sm:inline">Google</span>
          </button>
          <button
            type="button"
            onClick={() => handleSocialClick('facebook')}
            className="flex items-center justify-center gap-2 w-full flex-1 min-w-0 py-3 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:border-slate-300 hover:bg-slate-50 transition-colors"
            aria-label="Continue with Facebook"
          >
            <FacebookIcon /> <span className="hidden sm:inline">Facebook</span>
          </button>
          <button
            type="button"
            onClick={() => handleSocialClick('twitter')}
            className="flex items-center justify-center gap-2 w-full flex-1 min-w-0 py-3 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:border-slate-300 hover:bg-slate-50 transition-colors"
            aria-label="Continue with X"
          >
            <XIcon /> <span className="hidden sm:inline">X</span>
          </button>
        </div>
      </div>

      {showPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)' }}
          onClick={() => { setShowPopup(false); setPendingProvider(null); }}
        >
          <div
            className="w-full max-w-sm rounded-2xl overflow-hidden shadow-xl border border-slate-200"
            style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #234C6A, #456882)' }} />
            <div className="p-6">
              <p className="text-slate-700 text-sm leading-relaxed text-center">
                {POPUP_MESSAGE}
              </p>
              <button
                type="button"
                onClick={handleContinue}
                className="mt-5 w-full py-3 rounded-xl text-sm font-semibold text-white transition-colors"
                style={{ background: 'linear-gradient(135deg, #234C6A 0%, #456882 100%)' }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
