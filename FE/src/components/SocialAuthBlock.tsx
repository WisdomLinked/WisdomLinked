import React from 'react';
import { detectUserTimeZone } from '../utils/schedulingTimezone';

const BASE_URL = (process.env.REACT_APP_API_BASE_URL || '').replace(/\/$/, '');
function getAuthRedirectUrl(provider: string, role?: string, redirect?: string) {
  const envUrl = process.env[`REACT_APP_${provider.toUpperCase()}_AUTH_URL`];
  const base = envUrl || (BASE_URL ? `${BASE_URL}/auth/${provider}` : '#');
  if (base === '#') return base;
  const params = new URLSearchParams();
  if (role) params.set('role', role);
  if (redirect) params.set('redirect', redirect);
  params.set('timezone', detectUserTimeZone());
  const q = params.toString();
  return q ? `${base}?${q}` : base;
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

export default function SocialAuthBlock({ role, redirect }: { role?: string; redirect?: string } = {}) {
  const navigateTo = (url: string) => {
    window.location.assign(url);
  };
  const handleSocialClick = (provider: string) => {
    const url = getAuthRedirectUrl(provider, role, redirect);
    if (url && url !== '#') navigateTo(url);
  };

  return (
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
      </div>
    </div>
  );
}
