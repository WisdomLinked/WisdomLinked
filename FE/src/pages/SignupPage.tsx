import React, { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, AlertCircle, User, GraduationCap } from 'lucide-react';
import logo from '../assets/images/logo.png';

const BTN_PRIMARY_STYLE = { background: 'linear-gradient(135deg, #234C6A 0%, #456882 100%)' };
const FOCUS_RING = 'focus:ring-2 focus:ring-[#234C6A]/60 focus:border-[#234C6A]';

export default function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<{ name: string; email: string; password: string; role: 'student' | 'expert' }>({
    name: '',
    email: '',
    password: '',
    role: 'student',
  });
  const [errors, setErrors] = useState<Partial<Record<'name' | 'email' | 'password' | 'role', string>>>({});
  const [submitting, setSubmitting] = useState(false);

  const inputBase = `w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-200 ${FOCUS_RING}`;
  const inputNormal = `${inputBase} border-slate-200`;
  const inputError = `${inputBase} border-red-300 focus:ring-red-300 focus:border-red-400 bg-red-50/30`;

  const validate = () => {
    const e: Partial<Record<'name' | 'email' | 'password' | 'role', string>> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email';
    if (!form.password) e.password = 'Password is required';
    if (!form.role) e.role = 'Select a role';
    return e;
  };

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    const eMap = validate();
    if (Object.keys(eMap).length > 0) {
      setErrors(eMap);
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      navigate('/login-success');
    }, 400);
  };

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: '#F8FAFC' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        .font-display { font-family: 'Playfair Display', serif; }
        .auth-dots-layer {
          position: absolute; inset: 0; pointer-events: none;
          background-color: #F8FAFC;
          background-image: radial-gradient(circle, rgba(188,204,220,0.45) 1.8px, transparent 1.8px);
          background-size: 28px 28px;
        }
        .auth-dots-layer--animate { animation: authDotsDrift 35s linear infinite; }
        @keyframes authDotsDrift { 0% { background-position: 0 0; } 100% { background-position: 28px 28px; } }
      `}</style>

      <div className="auth-dots-layer auth-dots-layer--animate" aria-hidden="true" />
      <div className="relative z-10 flex items-center justify-center p-6 min-h-screen">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md rounded-3xl border border-slate-200 shadow-xl overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }}
        >
          <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #234C6A, #456882)' }} />
          <div className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-12 w-12 rounded-2xl bg-white border border-[#D0DFED] flex items-center justify-center shadow-md shadow-[#D9EAFD] overflow-hidden">
                <img
                  src={logo}
                  alt="WisdomLinked logo"
                  className="h-10 w-10 object-contain"
                />
              </div>
              <span className="font-black text-2xl tracking-[0.12em] uppercase text-slate-900">
                WisdomLinked
              </span>
            </div>

            <h2 className="font-display text-2xl font-bold text-slate-800 mb-1">
              Join WisdomLinked
            </h2>
            <p className="text-slate-500 text-sm mb-6">
              Create your account to start exploring experts and seminars.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <User size={12} aria-hidden="true" /> Full name
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Chen"
                  value={form.name}
                  onChange={e => {
                    setForm(f => ({ ...f, name: e.target.value }));
                    setErrors(er => ({ ...er, name: '' }));
                  }}
                  className={errors.name ? inputError : inputNormal}
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? 'signup-name-error' : undefined}
                />
                {errors.name && (
                  <p
                    id="signup-name-error"
                    className="mt-1 text-xs text-red-500 flex items-center gap-1"
                  >
                    <AlertCircle size={11} aria-hidden="true" />
                    {errors.name}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Mail size={12} aria-hidden="true" /> Email
                  </span>
                </label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={e => {
                    setForm(f => ({ ...f, email: e.target.value }));
                    setErrors(er => ({ ...er, email: '' }));
                  }}
                  className={errors.email ? inputError : inputNormal}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'signup-email-error' : undefined}
                />
                {errors.email && (
                  <p
                    id="signup-email-error"
                    className="mt-1 text-xs text-red-500 flex items-center gap-1"
                  >
                    <AlertCircle size={11} aria-hidden="true" />
                    {errors.email}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Lock size={12} aria-hidden="true" /> Password
                  </span>
                </label>
                <input
                  type="password"
                  placeholder="Create a secure password"
                  value={form.password}
                  onChange={e => {
                    setForm(f => ({ ...f, password: e.target.value }));
                    setErrors(er => ({ ...er, password: '' }));
                  }}
                  className={errors.password ? inputError : inputNormal}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'signup-password-error' : undefined}
                />
                {errors.password && (
                  <p
                    id="signup-password-error"
                    className="mt-1 text-xs text-red-500 flex items-center gap-1"
                  >
                    <AlertCircle size={11} aria-hidden="true" />
                    {errors.password}
                  </p>
                )}
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-600 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <GraduationCap size={12} aria-hidden="true" /> Role
                  </span>
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setForm(f => ({ ...f, role: 'student' }));
                      setErrors(er => ({ ...er, role: '' }));
                    }}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 text-xs sm:text-sm rounded-xl border transition-all ${
                      form.role === 'student'
                        ? 'border-[#234C6A] bg-[#D9EAFD]/80 text-[#234C6A] font-semibold'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-[#456882]/70'
                    }`}
                    aria-pressed={form.role === 'student'}
                  >
                    Student
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setForm(f => ({ ...f, role: 'expert' }));
                      setErrors(er => ({ ...er, role: '' }));
                    }}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 text-xs sm:text-sm rounded-xl border transition-all ${
                      form.role === 'expert'
                        ? 'border-[#234C6A] bg-[#D9EAFD]/80 text-[#234C6A] font-semibold'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-[#456882]/70'
                    }`}
                    aria-pressed={form.role === 'expert'}
                  >
                    Expert
                  </button>
                </div>
                {errors.role && (
                  <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle size={11} aria-hidden="true" />
                    {errors.role}
                  </p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-semibold text-white shadow-lg transition-all duration-200 disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#234C6A]"
              style={submitting ? { background: '#9AA6B2' } : BTN_PRIMARY_STYLE}
            >
              {submitting ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8z"
                    />
                  </svg>
                  Creating account...
                </>
              ) : (
                'Create account'
              )}
            </button>

            <p className="text-center text-slate-500 text-sm mt-4">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="font-semibold hover:underline"
                style={{ color: '#234C6A' }}
              >
                Log in
              </button>
            </p>

            <button
              type="button"
              onClick={() => navigate('/')}
              className="mt-4 w-full py-2.5 rounded-xl border text-sm font-semibold shadow-sm transition-colors"
              style={{
                backgroundColor: '#E8EEF4',
                borderColor: '#234C6A',
                color: '#234C6A',
              }}
            >
              Back to Home
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

