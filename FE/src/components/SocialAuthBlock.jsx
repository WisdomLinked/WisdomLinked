import React, { useState } from 'react';

const POPUP_MESSAGE = 'Update your preferences in the profile section after logging in to receive better service.';

const BASE_URL = (process.env.REACT_APP_API_BASE_URL || '').replace(/\/$/, '');
function getAuthRedirectUrl(provider) {
  const envUrl = process.env[`REACT_APP_${provider.toUpperCase()}_AUTH_URL`];
  if (envUrl) return envUrl;
  return BASE_URL ? `${BASE_URL}/auth/${provider}` : `#`;
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

const DiscordIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" fill="#5865F2"/>
  </svg>
);

export default function SocialAuthBlock() {
  const [showPopup, setShowPopup] = useState(false);
  const [pendingProvider, setPendingProvider] = useState(null); // 'google' | 'facebook' | 'discord'

  const handleSocialClick = (provider) => {
    setPendingProvider(provider);
    setShowPopup(true);
  };

  const handleContinue = () => {
    if (pendingProvider) {
      const url = getAuthRedirectUrl(pendingProvider);
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
            onClick={() => handleSocialClick('discord')}
            className="flex items-center justify-center gap-2 w-full flex-1 min-w-0 py-3 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:border-slate-300 hover:bg-slate-50 transition-colors"
            aria-label="Continue with Discord"
          >
            <DiscordIcon /> <span className="hidden sm:inline">Discord</span>
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
