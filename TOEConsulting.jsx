import React, { useState, useEffect, useRef } from 'react';
import {
  Star, Users, Briefcase, GraduationCap, TrendingUp, MessageCircle, CheckCircle,
  ArrowRight, Sparkles, Menu, X, BookOpen, Globe, ChevronDown, Phone, Mail, User,
  FileText, Send, AlertCircle, Lock, Upload
} from 'lucide-react';

const COUNTRY_CODES = [
  { code: '+1', country: 'US/CA', flag: '🇺🇸' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+86', country: 'China', flag: '🇨🇳' },
  { code: '+81', country: 'Japan', flag: '🇯🇵' },
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+49', country: 'Germany', flag: '🇩🇪' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+55', country: 'Brazil', flag: '🇧🇷' },
  { code: '+82', country: 'Korea', flag: '🇰🇷' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+7', country: 'Russia', flag: '🇷🇺' },
  { code: '+20', country: 'Egypt', flag: '🇪🇬' },
  { code: '+254', country: 'Kenya', flag: '🇰🇪' },
  { code: '+52', country: 'Mexico', flag: '🇲🇽' },
  { code: '+54', country: 'Argentina', flag: '🇦🇷' },
  { code: '+66', country: 'Thailand', flag: '🇹🇭' },
  { code: '+92', country: 'Pakistan', flag: '🇵🇰' },
  { code: '+234', country: 'Nigeria', flag: '🇳🇬' },
];

const ENGINEERING_MAJORS = [
  'Aerospace Engineering', 'Biomedical Engineering', 'Chemical Engineering',
  'Civil Engineering', 'Computer Engineering', 'Electrical Engineering',
  'Environmental Engineering', 'Industrial Engineering', 'Mechanical Engineering',
  'Materials Science & Engineering', 'Nuclear Engineering', 'Petroleum Engineering',
  'Software Engineering', 'Systems Engineering', 'Other',
];

const STUDENT_SERVICES = ['Study abroad', 'Work abroad', 'Research guidance'];

const COUNTRIES = [
  'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France',
  'India', 'China', 'Japan', 'South Korea', 'Singapore', 'UAE', 'Brazil', 'Mexico',
  'Netherlands', 'Switzerland', 'Sweden', 'Italy', 'Spain', 'Pakistan', 'Nigeria',
  'Egypt', 'Kenya', 'South Africa', 'Argentina', 'Thailand', 'Malaysia', 'Other',
];

function ContactFormModal({ onClose }) {
  const [form, setForm] = useState({ name: '', email: '', countryCode: '+1', phone: '', description: '' });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showCountryDrop, setShowCountryDrop] = useState(false);
  const overlayRef = useRef(null);
  const dropRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setShowCountryDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email';
    if (!form.phone.trim()) e.phone = 'Phone number is required';
    else if (!/^\d{6,15}$/.test(form.phone.replace(/\s/g, ''))) e.phone = 'Enter a valid phone number';
    if (!form.description.trim()) e.description = 'Please describe how we can help';
    else if (form.description.trim().length < 20) e.description = 'Please provide at least 20 characters';
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setSubmitting(true);
    setTimeout(() => { setSubmitting(false); setSubmitted(true); }, 1500);
  };

  const selectedCountry = COUNTRY_CODES.find(c => c.code === form.countryCode) || COUNTRY_CODES[0];
  const inputBase = "w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-200 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400";
  const inputNormal = `${inputBase} border-slate-200`;
  const inputError = `${inputBase} border-red-300 focus:ring-red-300 focus:border-red-400 bg-red-50/30`;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,15,35,0.65)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', animation: 'modalIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both' }}
      >
        <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #234C6A, #456882, #234C6A)', backgroundSize: '200%', animation: 'shimmer 3s linear infinite' }} />
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-red-100 text-slate-400 hover:text-red-500 transition-all duration-200 z-10">
          <X size={16} />
        </button>
        <div className="p-7 pb-8">
          {!submitted ? (
            <>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#E8EEF4' }}>
                    <MessageCircle size={16} style={{ color: '#234C6A' }} />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#234C6A' }}>Get In Touch</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-800 leading-tight">Contact Us</h2>
                <p className="text-sm text-slate-500 mt-1">Tell us about your goals and we'll connect you with the right expert.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    <span className="flex items-center gap-1.5"><User size={12} /> Full Name</span>
                  </label>
                  <input type="text" placeholder="e.g. Sarah Chen" value={form.name}
                    onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(er => ({ ...er, name: '' })); }}
                    className={errors.name ? inputError : inputNormal} />
                  {errors.name && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.name}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    <span className="flex items-center gap-1.5"><Mail size={12} /> Email Address</span>
                  </label>
                  <input type="email" placeholder="you@example.com" value={form.email}
                    onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setErrors(er => ({ ...er, email: '' })); }}
                    className={errors.email ? inputError : inputNormal} />
                  {errors.email && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.email}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    <span className="flex items-center gap-1.5"><Phone size={12} /> Contact Number</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="relative" ref={dropRef}>
                      <button type="button" onClick={() => setShowCountryDrop(v => !v)}
                        className="flex items-center gap-1.5 h-full px-3 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 hover:border-[#456882] transition-all duration-200 whitespace-nowrap min-w-[90px]">
                        <span>{selectedCountry.flag}</span>
                        <span className="font-medium">{selectedCountry.code}</span>
                        <ChevronDown size={12} className={`text-slate-400 transition-transform duration-200 ${showCountryDrop ? 'rotate-180' : ''}`} />
                      </button>
                      {showCountryDrop && (
                        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden w-52" style={{ maxHeight: 220, overflowY: 'auto' }}>
                          {COUNTRY_CODES.map(c => (
                            <button key={c.code + c.country} type="button"
                              onClick={() => { setForm(f => ({ ...f, countryCode: c.code })); setShowCountryDrop(false); }}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors hover:bg-[#E8EEF4]/80 ${form.countryCode === c.code ? 'font-semibold' : 'text-slate-700'}`}
                              style={{ backgroundColor: form.countryCode === c.code ? 'rgba(232,238,244,0.9)' : 'transparent', color: form.countryCode === c.code ? '#234C6A' : undefined }}>
                              <span>{c.flag}</span>
                              <span className="font-medium w-10">{c.code}</span>
                              <span className="text-slate-500 text-xs">{c.country}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <input type="tel" placeholder="Phone number" value={form.phone}
                      onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); setErrors(er => ({ ...er, phone: '' })); }}
                      className={`flex-1 ${errors.phone ? inputError : inputNormal}`} />
                  </div>
                  {errors.phone && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.phone}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    <span className="flex items-center gap-1.5"><FileText size={12} /> How can we help you?</span>
                  </label>
                  <textarea rows={4} placeholder="Tell us about your goals — graduate school applications, research guidance, career advice..."
                    value={form.description}
                    onChange={e => { setForm(f => ({ ...f, description: e.target.value })); setErrors(er => ({ ...er, description: '' })); }}
                    className={`${errors.description ? inputError : inputNormal} resize-none`} style={{ lineHeight: 1.6 }} />
                  <div className="flex items-center justify-between mt-1">
                    {errors.description ? <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.description}</p> : <span />}
                    <span className={`text-xs ml-auto ${form.description.length < 20 ? 'text-slate-400' : 'text-emerald-500'}`}>{form.description.length} / 20 min</span>
                  </div>
                </div>
              </div>
              <button onClick={handleSubmit} disabled={submitting}
                className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-semibold text-white shadow-lg transition-all duration-200 disabled:opacity-70"
                style={{ background: submitting ? '#9AA6B2' : 'linear-gradient(135deg, #234C6A 0%, #456882 100%)' }}>
                {submitting ? (
                  <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>Sending...</>
                ) : (<><Send size={15} />Send Message</>)}
              </button>
              <p className="text-center text-xs text-slate-400 mt-3">We typically respond within 24 hours</p>
            </>
          ) : (
            <div className="py-8 flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-5" style={{ animation: 'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both' }}>
                <CheckCircle size={40} className="text-emerald-500" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-2">Message Sent!</h3>
              <p className="text-slate-500 text-sm max-w-xs">Thanks, <span className="font-semibold" style={{ color: '#234C6A' }}>{form.name}</span>! We've received your message and will get back to you at <span className="font-medium">{form.email}</span> within 24 hours.</p>
              <button onClick={onClose} className="mt-7 px-8 py-3 rounded-2xl text-sm font-semibold text-white shadow" style={{ background: 'linear-gradient(135deg, #234C6A 0%, #456882 100%)' }}>Close</button>
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes modalIn { from { opacity: 0; transform: scale(0.88) translateY(24px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes shimmer { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
        @keyframes popIn { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
}

const BTN_PRIMARY_STYLE = { background: 'linear-gradient(135deg, #234C6A 0%, #456882 100%)' };
const FOCUS_RING = 'focus:ring-2 focus:ring-[#234C6A]/60 focus:border-[#234C6A]';
const ACCENT_BG = 'hover:bg-[#D9EAFD]/60';
const ACCENT_SELECTED = 'bg-[#D9EAFD]/70 text-[#234C6A]';

/* ─── Signup Page ────────────────────────────────────────────────────────── */
function SignupPage({ onClose, onGoLogin }) {
  const [role, setRole] = useState(null);
  const inputBase = `w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-200 ${FOCUS_RING}`;
  const inputNormal = `${inputBase} border-slate-200`;
  const inputError = `${inputBase} border-red-300 focus:ring-red-300 focus:border-red-400 bg-red-50/30`;

  if (role === 'student') {
    return <StudentSignupForm onBack={() => setRole(null)} onClose={onClose} onGoLogin={onGoLogin} inputNormal={inputNormal} inputError={inputError} />;
  }
  if (role === 'expert') {
    return <ExpertSignupForm onBack={() => setRole(null)} onClose={onClose} onGoLogin={onGoLogin} inputNormal={inputNormal} inputError={inputError} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#F8FAFC' }}>
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-slate-900 mb-2">Create your account</h1>
          <p className="text-slate-500 text-sm">Choose how you want to join TOE</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <button
            onClick={() => setRole('expert')}
            className="group p-6 rounded-2xl border-2 border-slate-200 bg-white hover:border-[#456882] hover:shadow-lg transition-all duration-300 text-left"
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors" style={{ backgroundColor: '#D9EAFD' }}>
              <Users size={24} className="text-[#234C6A]" />
            </div>
            <h3 className="font-display font-bold text-slate-800 mb-1">Join as an Expert</h3>
            <p className="text-slate-500 text-xs">Share your expertise and mentor students globally</p>
          </button>
          <button
            onClick={() => setRole('student')}
            className="group p-6 rounded-2xl border-2 border-slate-200 bg-white hover:border-[#456882] hover:shadow-lg transition-all duration-300 text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mb-4 group-hover:bg-amber-200 transition-colors">
              <GraduationCap size={24} className="text-amber-600" />
            </div>
            <h3 className="font-display font-bold text-slate-800 mb-1">Join as a student</h3>
            <p className="text-slate-500 text-xs">Get guidance on studies, work abroad & research</p>
          </button>
        </div>
        <p className="text-center text-slate-500 text-sm mt-6">
          Already have an account? <button type="button" onClick={onGoLogin} className="font-semibold text-[#234C6A] hover:underline">Log in</button>
        </p>
        <button onClick={onClose} className="mt-4 w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50">Cancel</button>
      </div>
    </div>
  );
}

function StudentSignupForm({ onBack, onClose, onGoLogin, inputNormal, inputError }) {
  const [form, setForm] = useState({
    fullName: '', majors: [], services: '', country: '', countryCode: '+1', phone: '', email: '', password: '', confirmPassword: '', terms: false
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showMajorDrop, setShowMajorDrop] = useState(false);
  const [showServiceDrop, setShowServiceDrop] = useState(false);
  const [showCountryDrop, setShowCountryDrop] = useState(false);
  const [showCodeDrop, setShowCodeDrop] = useState(false);
  const majorRef = useRef(null);
  const serviceRef = useRef(null);
  const countryRef = useRef(null);
  const codeRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (majorRef.current && !majorRef.current.contains(e.target)) setShowMajorDrop(false);
      if (serviceRef.current && !serviceRef.current.contains(e.target)) setShowServiceDrop(false);
      if (countryRef.current && !countryRef.current.contains(e.target)) setShowCountryDrop(false);
      if (codeRef.current && !codeRef.current.contains(e.target)) setShowCodeDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleMajor = (m) => {
    setForm(f => ({ ...f, majors: f.majors.includes(m) ? f.majors.filter(x => x !== m) : [...f.majors, m] }));
    setErrors(e => ({ ...e, majors: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.fullName.trim()) e.fullName = 'Full name is required';
    if (form.majors.length === 0) e.majors = 'Select at least one major';
    if (!form.services) e.services = 'Select a service';
    if (!form.country) e.country = 'Country is required';
    if (!form.phone.trim()) e.phone = 'Phone number is required';
    else if (!/^\d{6,15}$/.test(form.phone.replace(/\s/g, ''))) e.phone = 'Enter a valid phone number';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 8) e.password = 'Password must be at least 8 characters';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    if (!form.terms) e.terms = 'You must accept the terms and conditions';
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setSubmitting(true);
    setTimeout(() => { setSubmitting(false); setSubmitted(true); }, 1500);
  };

  const selectedCode = COUNTRY_CODES.find(c => c.code === form.countryCode) || COUNTRY_CODES[0];

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#F8FAFC' }}>
        <div className="w-full max-w-md rounded-3xl p-8 text-center shadow-xl border border-slate-200" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f0f7fc 100%)' }}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: '#D9EAFD' }}>
            <CheckCircle size={40} style={{ color: '#234C6A' }} />
          </div>
          <h3 className="text-2xl font-bold text-slate-800 mb-2">Account Created!</h3>
          <p className="text-slate-500 text-sm mb-6">Welcome, {form.fullName}. We've received your registration.</p>
          <button onClick={onClose} className="px-8 py-3 rounded-2xl text-sm font-semibold text-white shadow-md" style={BTN_PRIMARY_STYLE}>Go to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4" style={{ backgroundColor: '#F8FAFC' }}>
      <div className="max-w-xl mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-[#234C6A] text-sm font-semibold mb-6">
          <ArrowRight className="w-4 h-4 rotate-180" /> Back
        </button>
        <div className="rounded-3xl border border-slate-200 shadow-xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }}>
          <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #234C6A, #456882)' }} />
          <div className="p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold text-slate-800 mb-1">Student sign up</h2>
            <p className="text-slate-500 text-sm mb-6">Fill in your details to create an account</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5"><span className="flex items-center gap-1.5"><User size={12} /> Full name</span></label>
                <input type="text" placeholder="e.g. Sarah Chen" value={form.fullName}
                  onChange={e => { setForm(f => ({ ...f, fullName: e.target.value })); setErrors(er => ({ ...er, fullName: '' })); }}
                  className={errors.fullName ? inputError : inputNormal} />
                {errors.fullName && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.fullName}</p>}
              </div>

              <div ref={majorRef} className="relative">
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Majors (select one or more)</label>
                <button type="button" onClick={() => setShowMajorDrop(v => !v)}
                  className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm text-left ${errors.majors ? 'border-red-300 bg-red-50/30' : 'border-slate-200 bg-white'} ${FOCUS_RING} outline-none`}>
                  <span className={form.majors.length ? 'text-slate-800' : 'text-slate-400'}>{form.majors.length ? form.majors.join(', ') : 'Select majors'}</span>
                  <ChevronDown size={16} className={`text-slate-400 transition-transform ${showMajorDrop ? 'rotate-180' : ''}`} />
                </button>
                {showMajorDrop && (
                  <div className="absolute z-50 mt-1 w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-56 overflow-y-auto">
                    {ENGINEERING_MAJORS.map(m => (
                      <button key={m} type="button" onClick={() => toggleMajor(m)}
                        className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors ${form.majors.includes(m) ? `${ACCENT_SELECTED} font-semibold` : `text-slate-700 ${ACCENT_BG}`}`}>
                        {form.majors.includes(m) && <CheckCircle size={14} style={{ color: '#234C6A' }} />}{m}
                      </button>
                    ))}
                  </div>
                )}
                {errors.majors && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.majors}</p>}
              </div>

              <div ref={serviceRef} className="relative">
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Services</label>
                <button type="button" onClick={() => setShowServiceDrop(v => !v)}
                  className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm text-left ${errors.services ? 'border-red-300 bg-red-50/30' : 'border-slate-200 bg-white'} ${FOCUS_RING} outline-none`}>
                  <span className={form.services ? 'text-slate-800' : 'text-slate-400'}>{form.services || 'Select service'}</span>
                  <ChevronDown size={16} className={`text-slate-400 transition-transform ${showServiceDrop ? 'rotate-180' : ''}`} />
                </button>
                {showServiceDrop && (
                  <div className="absolute z-50 mt-1 w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                    {STUDENT_SERVICES.map(s => (
                      <button key={s} type="button" onClick={() => { setForm(f => ({ ...f, services: s })); setShowServiceDrop(false); setErrors(er => ({ ...er, services: '' })); }}
                        className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left ${ACCENT_BG} transition-colors text-slate-700`}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                {errors.services && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.services}</p>}
              </div>

              <div ref={countryRef} className="relative">
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Country</label>
                <button type="button" onClick={() => setShowCountryDrop(v => !v)}
                  className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm text-left ${errors.country ? 'border-red-300 bg-red-50/30' : 'border-slate-200 bg-white'} ${FOCUS_RING} outline-none`}>
                  <span className={form.country ? 'text-slate-800' : 'text-slate-400'}>{form.country || 'Select country'}</span>
                  <ChevronDown size={16} className={`text-slate-400 transition-transform ${showCountryDrop ? 'rotate-180' : ''}`} />
                </button>
                {showCountryDrop && (
                  <div className="absolute z-50 mt-1 w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-56 overflow-y-auto">
                    {COUNTRIES.map(c => (
                      <button key={c} type="button" onClick={() => { setForm(f => ({ ...f, country: c })); setShowCountryDrop(false); setErrors(er => ({ ...er, country: '' })); }}
                        className={`w-full px-4 py-2.5 text-sm text-left ${ACCENT_BG} transition-colors text-slate-700`}>{c}</button>
                    ))}
                  </div>
                )}
                {errors.country && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.country}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5"><span className="flex items-center gap-1.5"><Phone size={12} /> Phone number</span></label>
                <div className="flex gap-2">
                  <div className="relative" ref={codeRef}>
                    <button type="button" onClick={() => setShowCodeDrop(v => !v)}
                      className="flex items-center gap-1.5 h-full px-3 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 hover:border-[#456882] min-w-[90px]">
                      <span>{selectedCode.flag}</span>
                      <span className="font-medium">{selectedCode.code}</span>
                      <ChevronDown size={12} className={`text-slate-400 transition-transform ${showCodeDrop ? 'rotate-180' : ''}`} />
                    </button>
                    {showCodeDrop && (
                      <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden w-52 max-h-56 overflow-y-auto">
                        {COUNTRY_CODES.map(c => (
                          <button key={c.code + c.country} type="button" onClick={() => { setForm(f => ({ ...f, countryCode: c.code })); setShowCodeDrop(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left ${form.countryCode === c.code ? `${ACCENT_SELECTED} font-semibold` : `text-slate-700 ${ACCENT_BG}`}`}>
                            <span>{c.flag}</span><span className="font-medium w-10">{c.code}</span><span className="text-slate-500 text-xs">{c.country}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input type="tel" placeholder="Phone number" value={form.phone}
                    onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); setErrors(er => ({ ...er, phone: '' })); }}
                    className={`flex-1 ${errors.phone ? inputError : inputNormal}`} />
                </div>
                {errors.phone && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.phone}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5"><span className="flex items-center gap-1.5"><Mail size={12} /> Email</span></label>
                <input type="email" placeholder="you@example.com" value={form.email}
                  onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setErrors(er => ({ ...er, email: '' })); }}
                  className={errors.email ? inputError : inputNormal} />
                {errors.email && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.email}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5"><span className="flex items-center gap-1.5"><Lock size={12} /> Password</span></label>
                <input type="password" placeholder="Min. 8 characters" value={form.password}
                  onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setErrors(er => ({ ...er, password: '', confirmPassword: '' })); }}
                  className={errors.password ? inputError : inputNormal} />
                {errors.password && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.password}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Confirm password</label>
                <input type="password" placeholder="Re-enter password" value={form.confirmPassword}
                  onChange={e => { setForm(f => ({ ...f, confirmPassword: e.target.value })); setErrors(er => ({ ...er, confirmPassword: '' })); }}
                  className={errors.confirmPassword ? inputError : inputNormal} />
                {errors.confirmPassword && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.confirmPassword}</p>}
              </div>

              <div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.terms} onChange={e => { setForm(f => ({ ...f, terms: e.target.checked })); setErrors(er => ({ ...er, terms: '' })); }}
                    className="mt-1 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400" />
                  <span className="text-sm text-slate-600">I agree to the <a href="#" className="text-indigo-600 font-semibold hover:underline">Terms and Conditions</a></span>
                </label>
                {errors.terms && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.terms}</p>}
              </div>
            </div>

            <button onClick={handleSubmit} disabled={submitting}
              className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-semibold text-white shadow-lg transition-all duration-200 disabled:opacity-70"
              style={submitting ? { background: '#9AA6B2' } : BTN_PRIMARY_STYLE}>
              {submitting ? (<><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>Creating account...</>) : 'Submit'}
            </button>
            <p className="text-center text-slate-500 text-sm mt-4">
              Already have an account? <button type="button" onClick={onGoLogin} className="font-semibold hover:underline" style={{ color: '#234C6A' }}>Log in</button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpertSignupForm({ onBack, onClose, onGoLogin, inputNormal, inputError }) {
  const [form, setForm] = useState({
    fullName: '', title: '', bio: '', majors: [], servicesOffered: [], country: '', countryCode: '+1', phone: '', email: '', password: '', confirmPassword: '', resumeFile: null, terms: false
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showMajorDrop, setShowMajorDrop] = useState(false);
  const [showServicesDrop, setShowServicesDrop] = useState(false);
  const [showCountryDrop, setShowCountryDrop] = useState(false);
  const [showCodeDrop, setShowCodeDrop] = useState(false);
  const majorRef = useRef(null);
  const servicesRef = useRef(null);
  const countryRef = useRef(null);
  const codeRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (majorRef.current && !majorRef.current.contains(e.target)) setShowMajorDrop(false);
      if (servicesRef.current && !servicesRef.current.contains(e.target)) setShowServicesDrop(false);
      if (countryRef.current && !countryRef.current.contains(e.target)) setShowCountryDrop(false);
      if (codeRef.current && !codeRef.current.contains(e.target)) setShowCodeDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleMajor = (m) => {
    setForm(f => ({ ...f, majors: f.majors.includes(m) ? f.majors.filter(x => x !== m) : [...f.majors, m] }));
    setErrors(e => ({ ...e, majors: '' }));
  };
  const toggleService = (s) => {
    setForm(f => ({ ...f, servicesOffered: f.servicesOffered.includes(s) ? f.servicesOffered.filter(x => x !== s) : [...f.servicesOffered, s] }));
    setErrors(e => ({ ...e, servicesOffered: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.fullName.trim()) e.fullName = 'Full name is required';
    if (!form.title.trim()) e.title = 'Title is required';
    if (!form.bio.trim()) e.bio = 'Short description is required';
    else if (form.bio.trim().length < 30) e.bio = 'Please provide at least 30 characters';
    if (form.majors.length === 0) e.majors = 'Select at least one major';
    if (form.servicesOffered.length === 0) e.servicesOffered = 'Select at least one service';
    if (!form.country) e.country = 'Country is required';
    if (!form.phone.trim()) e.phone = 'Phone number is required';
    else if (!/^\d{6,15}$/.test(form.phone.replace(/\s/g, ''))) e.phone = 'Enter a valid phone number';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 8) e.password = 'Password must be at least 8 characters';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    if (!form.terms) e.terms = 'You must accept the terms and conditions';
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setSubmitting(true);
    setTimeout(() => { setSubmitting(false); setSubmitted(true); }, 1500);
  };

  const selectedCode = COUNTRY_CODES.find(c => c.code === form.countryCode) || COUNTRY_CODES[0];

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#F8FAFC' }}>
        <div className="w-full max-w-md rounded-3xl p-8 text-center shadow-xl border border-slate-200" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f0f7fc 100%)' }}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: '#D9EAFD' }}>
            <CheckCircle size={40} style={{ color: '#234C6A' }} />
          </div>
          <h3 className="text-2xl font-bold text-slate-800 mb-2">Registration Received!</h3>
          <p className="text-slate-500 text-sm mb-6">Thanks, {form.fullName}. We'll review your expert profile and get back to you soon.</p>
          <button onClick={onClose} className="px-8 py-3 rounded-2xl text-sm font-semibold text-white shadow-md" style={BTN_PRIMARY_STYLE}>Go to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4" style={{ backgroundColor: '#F8FAFC' }}>
      <div className="max-w-xl mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-[#234C6A] text-sm font-semibold mb-6">
          <ArrowRight className="w-4 h-4 rotate-180" /> Back
        </button>
        <div className="rounded-3xl border border-slate-200 shadow-xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }}>
          <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #234C6A, #456882)' }} />
          <div className="p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold text-slate-800 mb-1">Expert sign up</h2>
            <p className="text-slate-500 text-sm mb-6">Tell us about your expertise to join as a consultant</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5"><span className="flex items-center gap-1.5"><User size={12} /> Full name</span></label>
                <input type="text" placeholder="e.g. Dr. Jane Smith" value={form.fullName}
                  onChange={e => { setForm(f => ({ ...f, fullName: e.target.value })); setErrors(er => ({ ...er, fullName: '' })); }}
                  className={errors.fullName ? inputError : inputNormal} />
                {errors.fullName && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.fullName}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Title</label>
                <input type="text" placeholder="e.g. Professor, Senior Engineer, Research Scientist" value={form.title}
                  onChange={e => { setForm(f => ({ ...f, title: e.target.value })); setErrors(er => ({ ...er, title: '' })); }}
                  className={errors.title ? inputError : inputNormal} />
                {errors.title && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.title}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Short description / bio</label>
                <textarea rows={4} placeholder="Brief background, expertise areas, and what you can offer..." value={form.bio}
                  onChange={e => { setForm(f => ({ ...f, bio: e.target.value })); setErrors(er => ({ ...er, bio: '' })); }}
                  className={`${errors.bio ? inputError : inputNormal} resize-none`} style={{ lineHeight: 1.5 }} />
                <div className="flex justify-between mt-1"><span className="text-xs text-slate-400">Min. 30 characters</span>{errors.bio && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.bio}</p>}</div>
              </div>

              <div ref={majorRef} className="relative">
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Major(s)</label>
                <button type="button" onClick={() => setShowMajorDrop(v => !v)}
                  className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm text-left ${errors.majors ? 'border-red-300 bg-red-50/30' : 'border-slate-200 bg-white'} ${FOCUS_RING} outline-none`}>
                  <span className={form.majors.length ? 'text-slate-800' : 'text-slate-400'}>{form.majors.length ? form.majors.join(', ') : 'Select majors'}</span>
                  <ChevronDown size={16} className={`text-slate-400 transition-transform ${showMajorDrop ? 'rotate-180' : ''}`} />
                </button>
                {showMajorDrop && (
                  <div className="absolute z-50 mt-1 w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-56 overflow-y-auto">
                    {ENGINEERING_MAJORS.map(m => (
                      <button key={m} type="button" onClick={() => toggleMajor(m)}
                        className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors ${form.majors.includes(m) ? `${ACCENT_SELECTED} font-semibold` : `text-slate-700 ${ACCENT_BG}`}`}>
                        {form.majors.includes(m) && <CheckCircle size={14} style={{ color: '#234C6A' }} />}{m}
                      </button>
                    ))}
                  </div>
                )}
                {errors.majors && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.majors}</p>}
              </div>

              <div ref={servicesRef} className="relative">
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Services offered (select one or more)</label>
                <button type="button" onClick={() => setShowServicesDrop(v => !v)}
                  className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm text-left ${errors.servicesOffered ? 'border-red-300 bg-red-50/30' : 'border-slate-200 bg-white'} ${FOCUS_RING} outline-none`}>
                  <span className={form.servicesOffered.length ? 'text-slate-800' : 'text-slate-400'}>{form.servicesOffered.length ? form.servicesOffered.join(', ') : 'Select services'}</span>
                  <ChevronDown size={16} className={`text-slate-400 transition-transform ${showServicesDrop ? 'rotate-180' : ''}`} />
                </button>
                {showServicesDrop && (
                  <div className="absolute z-50 mt-1 w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                    {STUDENT_SERVICES.map(s => (
                      <button key={s} type="button" onClick={() => toggleService(s)}
                        className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors ${form.servicesOffered.includes(s) ? `${ACCENT_SELECTED} font-semibold` : `text-slate-700 ${ACCENT_BG}`}`}>
                        {form.servicesOffered.includes(s) && <CheckCircle size={14} style={{ color: '#234C6A' }} />}{s}
                      </button>
                    ))}
                  </div>
                )}
                {errors.servicesOffered && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.servicesOffered}</p>}
              </div>

              <div ref={countryRef} className="relative">
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Country</label>
                <button type="button" onClick={() => setShowCountryDrop(v => !v)}
                  className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm text-left ${errors.country ? 'border-red-300 bg-red-50/30' : 'border-slate-200 bg-white'} ${FOCUS_RING} outline-none`}>
                  <span className={form.country ? 'text-slate-800' : 'text-slate-400'}>{form.country || 'Select country'}</span>
                  <ChevronDown size={16} className={`text-slate-400 transition-transform ${showCountryDrop ? 'rotate-180' : ''}`} />
                </button>
                {showCountryDrop && (
                  <div className="absolute z-50 mt-1 w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-56 overflow-y-auto">
                    {COUNTRIES.map(c => (
                      <button key={c} type="button" onClick={() => { setForm(f => ({ ...f, country: c })); setShowCountryDrop(false); setErrors(er => ({ ...er, country: '' })); }}
                        className={`w-full px-4 py-2.5 text-sm text-left ${ACCENT_BG} transition-colors text-slate-700`}>{c}</button>
                    ))}
                  </div>
                )}
                {errors.country && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.country}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5"><span className="flex items-center gap-1.5"><Phone size={12} /> Phone number</span></label>
                <div className="flex gap-2">
                  <div className="relative" ref={codeRef}>
                    <button type="button" onClick={() => setShowCodeDrop(v => !v)}
                      className="flex items-center gap-1.5 h-full px-3 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 hover:border-[#456882] min-w-[90px]">
                      <span>{selectedCode.flag}</span>
                      <span className="font-medium">{selectedCode.code}</span>
                      <ChevronDown size={12} className={`text-slate-400 transition-transform ${showCodeDrop ? 'rotate-180' : ''}`} />
                    </button>
                    {showCodeDrop && (
                      <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden w-52 max-h-56 overflow-y-auto">
                        {COUNTRY_CODES.map(c => (
                          <button key={c.code + c.country} type="button" onClick={() => { setForm(f => ({ ...f, countryCode: c.code })); setShowCodeDrop(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left ${form.countryCode === c.code ? `${ACCENT_SELECTED} font-semibold` : `text-slate-700 ${ACCENT_BG}`}`}>
                            <span>{c.flag}</span><span className="font-medium w-10">{c.code}</span><span className="text-slate-500 text-xs">{c.country}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input type="tel" placeholder="Phone number" value={form.phone}
                    onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); setErrors(er => ({ ...er, phone: '' })); }}
                    className={`flex-1 ${errors.phone ? inputError : inputNormal}`} />
                </div>
                {errors.phone && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.phone}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5"><span className="flex items-center gap-1.5"><Mail size={12} /> Email</span></label>
                <input type="email" placeholder="you@example.com" value={form.email}
                  onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setErrors(er => ({ ...er, email: '' })); }}
                  className={errors.email ? inputError : inputNormal} />
                {errors.email && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.email}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5"><span className="flex items-center gap-1.5"><Lock size={12} /> Password</span></label>
                <input type="password" placeholder="Min. 8 characters" value={form.password}
                  onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setErrors(er => ({ ...er, password: '', confirmPassword: '' })); }}
                  className={errors.password ? inputError : inputNormal} />
                {errors.password && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.password}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Confirm password</label>
                <input type="password" placeholder="Re-enter password" value={form.confirmPassword}
                  onChange={e => { setForm(f => ({ ...f, confirmPassword: e.target.value })); setErrors(er => ({ ...er, confirmPassword: '' })); }}
                  className={errors.confirmPassword ? inputError : inputNormal} />
                {errors.confirmPassword && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.confirmPassword}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5"><span className="flex items-center gap-1.5"><Upload size={12} /> Upload resume (optional)</span></label>
                <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden"
                  onChange={e => setForm(f => ({ ...f, resumeFile: e.target.files?.[0] ?? null }))} />
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-xl border border-slate-200 border-dashed px-4 py-3 text-sm text-slate-500 hover:border-[#456882] hover:bg-[#D9EAFD]/30 transition-colors flex items-center justify-center gap-2">
                  <Upload size={18} />
                  {form.resumeFile ? form.resumeFile.name : 'Choose file (PDF or DOC)'}
                </button>
              </div>

              <div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.terms} onChange={e => { setForm(f => ({ ...f, terms: e.target.checked })); setErrors(er => ({ ...er, terms: '' })); }}
                    className="mt-1 w-4 h-4 rounded border-slate-300 focus:ring-[#234C6A]" style={{ color: '#234C6A' }} />
                  <span className="text-sm text-slate-600">I agree to the <a href="#" className="font-semibold hover:underline" style={{ color: '#234C6A' }}>Terms and Conditions</a></span>
                </label>
                {errors.terms && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.terms}</p>}
              </div>
            </div>

            <button onClick={handleSubmit} disabled={submitting}
              className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-semibold text-white shadow-lg transition-all duration-200 disabled:opacity-70"
              style={submitting ? { background: '#9AA6B2' } : BTN_PRIMARY_STYLE}>
              {submitting ? (<><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>Registering...</>) : 'Register'}
            </button>
            <p className="text-center text-slate-500 text-sm mt-4">
              Already have an account? <button type="button" onClick={onGoLogin} className="font-semibold hover:underline" style={{ color: '#234C6A' }}>Log in</button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Login Page ────────────────────────────────────────────────────────── */
function LoginPage({ onClose, onGoSignup }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const inputBase = `w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-200 ${FOCUS_RING}`;
  const inputNormal = `${inputBase} border-slate-200`;
  const inputError = `${inputBase} border-red-300 focus:ring-red-300 focus:border-red-400 bg-red-50/30`;

  const validate = () => {
    const e = {};
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email';
    if (!form.password) e.password = 'Password is required';
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setSubmitting(true);
    setTimeout(() => setSubmitting(false), 1200);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#F8FAFC' }}>
      <div className="w-full max-w-md rounded-3xl border border-slate-200 shadow-xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }}>
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #234C6A, #456882)' }} />
        <div className="p-8">
          <h2 className="font-display text-2xl font-bold text-slate-800 mb-1">Welcome back</h2>
          <p className="text-slate-500 text-sm mb-6">Sign in to your TOE account</p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5"><span className="flex items-center gap-1.5"><Mail size={12} /> Email</span></label>
              <input type="email" placeholder="you@example.com" value={form.email}
                onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setErrors(er => ({ ...er, email: '' })); }}
                className={errors.email ? inputError : inputNormal} />
              {errors.email && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.email}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5"><span className="flex items-center gap-1.5"><Lock size={12} /> Password</span></label>
              <input type="password" placeholder="Your password" value={form.password}
                onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setErrors(er => ({ ...er, password: '' })); }}
                className={errors.password ? inputError : inputNormal} />
              {errors.password && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.password}</p>}
            </div>
          </div>
          <button onClick={handleSubmit} disabled={submitting}
            className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-semibold text-white shadow-lg transition-all duration-200 disabled:opacity-70"
            style={submitting ? { background: '#9AA6B2' } : BTN_PRIMARY_STYLE}>
            {submitting ? (<><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>Signing in...</>) : 'Sign in'}
          </button>
          <p className="text-center text-slate-500 text-sm mt-4">
            Don't have an account? <button type="button" onClick={onGoSignup} className="font-semibold hover:underline" style={{ color: '#234C6A' }}>Sign up</button>
          </p>
          <button onClick={onClose} className="mt-4 w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50">Back to Home</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Interactive 3-D Globe ──────────────────────────────────────────────── */
function GlobeCanvas() {
  const canvasRef = useRef(null);
  const stateRef = useRef({});

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const s = stateRef.current;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      s.W = canvas.offsetWidth;
      s.H = canvas.offsetHeight;
      s.cx = s.W / 2;
      s.cy = s.H / 2;
      s.R = Math.min(s.W, s.H) * 0.40;
    };

    const cities = [
      { name: 'New York', lat: 40.7, lon: -74.0, role: 'mentor' },
      { name: 'London', lat: 51.5, lon: -0.1, role: 'student' },
      { name: 'Beijing', lat: 39.9, lon: 116.4, role: 'student' },
      { name: 'Tokyo', lat: 35.7, lon: 139.7, role: 'mentor' },
      { name: 'Sydney', lat: -33.9, lon: 151.2, role: 'mentor' },
      { name: 'São Paulo', lat: -23.5, lon: -46.6, role: 'student' },
      { name: 'Mumbai', lat: 19.1, lon: 72.9, role: 'student' },
      { name: 'Nairobi', lat: -1.3, lon: 36.8, role: 'student' },
      { name: 'Toronto', lat: 43.7, lon: -79.4, role: 'mentor' },
      { name: 'Paris', lat: 48.9, lon: 2.3, role: 'mentor' },
      { name: 'Singapore', lat: 1.3, lon: 103.8, role: 'mentor' },
      { name: 'Dubai', lat: 25.2, lon: 55.3, role: 'student' },
      { name: 'Seoul', lat: 37.6, lon: 127.0, role: 'student' },
      { name: 'Chicago', lat: 41.9, lon: -87.6, role: 'mentor' },
      { name: 'Berlin', lat: 52.5, lon: 13.4, role: 'mentor' },
      { name: 'Cairo', lat: 30.0, lon: 31.2, role: 'student' },
      { name: 'Mexico City', lat: 19.4, lon: -99.1, role: 'student' },
      { name: 'Buenos Aires', lat: -34.6, lon: -58.4, role: 'student' },
      { name: 'Moscow', lat: 55.8, lon: 37.6, role: 'mentor' },
      { name: 'Bangkok', lat: 13.8, lon: 100.5, role: 'student' },
    ];

    const arcs = [
      [0, 1], [1, 4], [0, 2], [2, 3], [3, 10], [5, 0], [6, 11], [7, 1],
      [8, 1], [9, 14], [10, 12], [11, 6], [3, 13], [0, 14], [2, 15],
      [1, 18], [5, 17], [16, 0], [4, 19], [7, 2],
    ];

    const toRad = d => d * Math.PI / 180;

    const project = (lat, lon, phi, ss) => {
      const latr = toRad(lat);
      const lonr = toRad(lon) + phi;
      const x3 = Math.cos(latr) * Math.sin(lonr);
      const y3 = Math.sin(latr);
      const z3 = Math.cos(latr) * Math.cos(lonr);
      return { x: ss.cx + ss.R * x3, y: ss.cy - ss.R * y3, z: z3, visible: z3 > -0.15 };
    };

    const arcPoints = (c1, c2, phi, ss, steps = 48) => {
      const pts = [];
      const la1 = toRad(c1.lat), lo1 = toRad(c1.lon);
      const la2 = toRad(c2.lat), lo2 = toRad(c2.lon);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const lat = la1 + (la2 - la1) * t;
        const lon = lo1 + (lo2 - lo1) * t;
        const lonr = lon + phi;
        const x3 = Math.cos(lat) * Math.sin(lonr);
        const y3 = Math.sin(lat);
        const z3 = Math.cos(lat) * Math.cos(lonr);
        pts.push({ x: ss.cx + ss.R * x3, y: ss.cy - ss.R * y3, z: z3, visible: z3 > 0 });
      }
      return pts;
    };

    s.phi = 0;
    s.dPhi = 0.003;
    s.drag = false;
    s.lastX = 0;
    s.arcProgress = arcs.map(() => Math.random());

    resize();
    window.addEventListener('resize', resize);

    const onDown = e => { s.drag = true; s.lastX = (e.touches?.[0] ?? e).clientX; };
    const onUp = () => { s.drag = false; };
    const onMove = e => {
      if (!s.drag) return;
      const x = (e.touches?.[0] ?? e).clientX;
      s.phi += (x - s.lastX) * 0.008;
      s.lastX = x;
    };
    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: true });

    s.landRings = [];
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(r => r.json())
      .then(topo => {
        const arcsData = topo.arcs;
        const tf = topo.transform;
        const scale = tf ? tf.scale : [1, 1];
        const translate = tf ? tf.translate : [0, 0];
        const decodeArc = (arcIdx) => {
          const raw = arcIdx < 0 ? arcsData[~arcIdx].slice().reverse() : arcsData[arcIdx].slice();
          const pts = [];
          let x = 0, y = 0;
          for (const [dx, dy] of raw) {
            x += dx; y += dy;
            pts.push([x * scale[0] + translate[0], y * scale[1] + translate[1]]);
          }
          if (arcIdx < 0) pts.reverse();
          return pts;
        };
        const buildRings = (geom) => {
          const rings = [];
          if (!geom) return rings;
          const processArcs = (arcsList) => { const ring = []; for (const ai of arcsList) ring.push(...decodeArc(ai)); return ring; };
          if (geom.type === 'Polygon') for (const a of geom.arcs) rings.push(processArcs(a));
          else if (geom.type === 'MultiPolygon') for (const poly of geom.arcs) for (const a of poly) rings.push(processArcs(a));
          return rings;
        };
        const stroke = 'rgba(35,60,82,0.5)';
        for (const geom of (topo.objects.countries?.geometries || [])) {
          for (const ring of buildRings(geom)) {
            if (ring.length > 2) s.landRings.push({ ring, stroke });
          }
        }
      })
      .catch(e => console.warn('Topo load failed:', e));

    const drawContinents = (phi) => {
      if (!s.landRings || s.landRings.length === 0) return;
      const MAX_JUMP = s.R * 0.35;
      ctx.lineWidth = 1.15;
      ctx.lineJoin = 'round';
      for (const { ring, stroke } of s.landRings) {
        const pts = ring.map(([lon, lat]) => {
          const latr = lat * Math.PI / 180;
          const lonr = lon * Math.PI / 180 + phi;
          const z = Math.cos(latr) * Math.cos(lonr);
          return { x: s.cx + s.R * Math.cos(latr) * Math.sin(lonr), y: s.cy - s.R * Math.sin(latr), v: z > 0.05 };
        });
        let run = [];
        const flush = () => {
          if (run.length < 2) { run = []; return; }
          ctx.beginPath();
          ctx.moveTo(run[0].x, run[0].y);
          for (let i = 1; i < run.length; i++) ctx.lineTo(run[i].x, run[i].y);
          ctx.strokeStyle = stroke;
          ctx.stroke();
          run = [];
        };
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          if (!p.v) { flush(); continue; }
          if (run.length > 0) {
            const prev = run[run.length - 1];
            const dx = p.x - prev.x, dy = p.y - prev.y;
            if (Math.sqrt(dx * dx + dy * dy) > MAX_JUMP) flush();
          }
          run.push(p);
        }
        flush();
      }
    };

    const drawGrid = (phi) => {
      const MAX_JUMP = s.R * 0.35;
      ctx.lineWidth = 0.5;
      for (let lat = -75; lat <= 75; lat += 15) {
        let run = [];
        const flush = () => {
          if (run.length < 2) { run = []; return; }
          ctx.beginPath(); ctx.moveTo(run[0].x, run[0].y);
          for (let i = 1; i < run.length; i++) ctx.lineTo(run[i].x, run[i].y);
          ctx.strokeStyle = 'rgba(71,85,105,0.12)'; ctx.stroke(); run = [];
        };
        for (let lon = -180; lon <= 180; lon += 3) {
          const latr = lat * Math.PI / 180, lonr = lon * Math.PI / 180 + phi;
          const z = Math.cos(latr) * Math.cos(lonr);
          if (z <= 0.05) { flush(); continue; }
          const x = s.cx + s.R * Math.cos(latr) * Math.sin(lonr), y = s.cy - s.R * Math.sin(latr);
          if (run.length > 0) { const prev = run[run.length - 1]; const dx = x - prev.x, dy = y - prev.y; if (Math.sqrt(dx * dx + dy * dy) > MAX_JUMP) flush(); }
          run.push({ x, y });
        }
        flush();
      }
      for (let lon = -180; lon < 180; lon += 20) {
        let run = [];
        const flush = () => {
          if (run.length < 2) { run = []; return; }
          ctx.beginPath(); ctx.moveTo(run[0].x, run[0].y);
          for (let i = 1; i < run.length; i++) ctx.lineTo(run[i].x, run[i].y);
          ctx.strokeStyle = 'rgba(71,85,105,0.12)'; ctx.stroke(); run = [];
        };
        for (let lat = -90; lat <= 90; lat += 3) {
          const latr = lat * Math.PI / 180, lonr = lon * Math.PI / 180 + phi;
          const z = Math.cos(latr) * Math.cos(lonr);
          if (z <= 0.05) { flush(); continue; }
          const x = s.cx + s.R * Math.cos(latr) * Math.sin(lonr), y = s.cy - s.R * Math.sin(latr);
          if (run.length > 0) { const prev = run[run.length - 1]; const dx = x - prev.x, dy = y - prev.y; if (Math.sqrt(dx * dx + dy * dy) > MAX_JUMP) flush(); }
          run.push({ x, y });
        }
        flush();
      }
    };

    const drawArcs = (phi) => {
      arcs.forEach(([i, j], idx) => {
        const c1 = cities[i], c2 = cities[j];
        const pts = arcPoints(c1, c2, phi, s);
        const speed = 0.0015 + (idx % 5) * 0.0004;
        s.arcProgress[idx] = (s.arcProgress[idx] + speed) % 1;
        const prog = s.arcProgress[idx];
        ctx.beginPath();
        let first = true;
        for (const p of pts) {
          if (!p.visible) { first = true; continue; }
          first ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
          first = false;
        }
        ctx.strokeStyle = 'rgba(71,85,105,0.10)';
        ctx.lineWidth = 1;
        ctx.stroke();
        const dotIdx = Math.floor(prog * (pts.length - 1));
        const dp = pts[dotIdx];
        if (dp && dp.visible) {
          const trailLen = 10;
          for (let k = 0; k < trailLen; k++) {
            const ti = dotIdx - k;
            if (ti < 0) break;
            const tp = pts[ti];
            if (!tp.visible) break;
            ctx.beginPath();
            ctx.arc(tp.x, tp.y, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(69,104,130,${(1 - k / trailLen) * 0.5})`;
            ctx.fill();
          }
          const grd = ctx.createRadialGradient(dp.x, dp.y, 0, dp.x, dp.y, 5);
          grd.addColorStop(0, 'rgba(100,136,170,0.85)');
          grd.addColorStop(1, 'rgba(35,60,82,0)');
          ctx.beginPath();
          ctx.arc(dp.x, dp.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = grd;
          ctx.fill();
        }
      });
    };

    /* ── Shared circle base for icons ── */
    const drawCircleBase = (cx, cy, radius, isMentor) => {
      const bgColor = isMentor ? '#2563eb' : '#eab308';
      const bgColorLight = isMentor ? '#3b82f6' : '#facc15';
      const borderColor = isMentor ? '#1d4ed8' : '#ca8a04';
      const shadowColor = isMentor ? 'rgba(37,99,235,0.45)' : 'rgba(234,179,8,0.45)';

      // Drop shadow glow
      const shadowGrd = ctx.createRadialGradient(cx, cy, radius * 0.5, cx, cy, radius * 2.2);
      shadowGrd.addColorStop(0, shadowColor);
      shadowGrd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = shadowGrd;
      ctx.fill();

      // Outer border ring
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 1.5, 0, Math.PI * 2);
      ctx.fillStyle = borderColor;
      ctx.fill();

      // Main circle background with subtle gradient
      const bgGrd = ctx.createRadialGradient(cx - radius * 0.25, cy - radius * 0.25, 0, cx, cy, radius);
      bgGrd.addColorStop(0, bgColorLight);
      bgGrd.addColorStop(1, bgColor);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = bgGrd;
      ctx.fill();

      // Specular highlight on circle
      const specGrd = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 0, cx - radius * 0.3, cy - radius * 0.3, radius * 0.7);
      specGrd.addColorStop(0, 'rgba(255,255,255,0.35)');
      specGrd.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = specGrd;
      ctx.fill();
    };

    /* ── MENTOR icon: Person silhouette (no cap) — blue ── */
    const drawMentorIcon = (cx, cy, radius, alpha) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      drawCircleBase(cx, cy, radius, true);

      const c = '#ffffff';
      const r = radius;

      // Head
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.22, r * 0.26, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();

      // Shoulders — clipped to stay inside the circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.62, r * 0.58, Math.PI, 0);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.restore();

      ctx.restore();
    };

    /* ── STUDENT icon: Person with graduation cap — yellow ── */
    const drawStudentIcon = (cx, cy, radius, alpha) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      drawCircleBase(cx, cy, radius, false);

      const c = '#422006';
      const r = radius;

      // --- Mortarboard cap ---
      const capBoardY = cy - r * 0.44;
      const capW = r * 0.46;
      const capH = r * 0.1;

      // Button / top piece
      ctx.beginPath();
      ctx.rect(cx - r * 0.08, capBoardY - capH, r * 0.16, capH);
      ctx.fillStyle = c;
      ctx.fill();

      // Flat board
      ctx.beginPath();
      ctx.rect(cx - capW, capBoardY, capW * 2, capH);
      ctx.fillStyle = c;
      ctx.fill();

      // Tassel line (right side)
      ctx.beginPath();
      ctx.moveTo(cx + capW * 0.6, capBoardY + capH);
      ctx.lineTo(cx + capW * 0.6, capBoardY + capH + r * 0.2);
      ctx.strokeStyle = c;
      ctx.lineWidth = Math.max(0.8, r * 0.08);
      ctx.lineCap = 'round';
      ctx.stroke();

      // Tassel ball
      ctx.beginPath();
      ctx.arc(cx + capW * 0.6, capBoardY + capH + r * 0.27, r * 0.07, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();

      // Head (just below cap)
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.14, r * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();

      // Shoulders — clipped to stay inside the circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.6, r * 0.52, Math.PI, 0);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.restore();

      ctx.restore();
    };

    const drawCities = (phi) => {
      const projected = cities.map(city => {
        const p = project(city.lat, city.lon, phi, s);
        return { ...city, ...p };
      }).filter(c => c.visible).sort((a, b) => a.z - b.z);

      projected.forEach(city => {
        const depth = (city.z + 1) / 2;
        const radius = 6 + depth * 7;
        const isMentor = city.role === 'mentor';
        const alpha = 0.5 + 0.5 * depth;

        if (isMentor) {
          drawMentorIcon(city.x, city.y, radius, alpha);
        } else {
          drawStudentIcon(city.x, city.y, radius, alpha);
        }
      });
    };

    const drawGlobe = () => {
      // Halo: concentric filled circles so the glow is perfectly circular (no gradient bounding box)
      const haloInner = s.R * 0.88;
      const haloOuter = s.R * 1.42;
      const steps = 32;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const r = haloInner + (haloOuter - haloInner) * t;
        const opacity = 0.035 * (1 - t) * (1 - t); // fade out toward outer edge
        ctx.beginPath();
        ctx.arc(s.cx, s.cy, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(148,163,184,${opacity})`;
        ctx.fill();
      }

      const atm = ctx.createRadialGradient(s.cx, s.cy, s.R * 0.85, s.cx, s.cy, s.R * 1.18);
      atm.addColorStop(0, 'rgba(71,85,105,0.05)');
      atm.addColorStop(0.6, 'rgba(71,85,105,0.02)');
      atm.addColorStop(1, 'rgba(71,85,105,0.00)');
      ctx.beginPath();
      ctx.arc(s.cx, s.cy, s.R * 1.18, 0, Math.PI * 2);
      ctx.fillStyle = atm;
      ctx.fill();

      const fill = ctx.createRadialGradient(s.cx - s.R * 0.3, s.cy - s.R * 0.3, s.R * 0.1, s.cx, s.cy, s.R);
      fill.addColorStop(0, 'rgba(226,232,240,0.97)');
      fill.addColorStop(0.5, 'rgba(203,213,225,0.92)');
      fill.addColorStop(1, 'rgba(148,163,184,0.85)');
      ctx.beginPath();
      ctx.arc(s.cx, s.cy, s.R, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();

      const rim = ctx.createRadialGradient(s.cx, s.cy, s.R * 0.7, s.cx, s.cy, s.R);
      rim.addColorStop(0, 'transparent');
      rim.addColorStop(1, 'rgba(35,60,82,0.14)');
      ctx.beginPath();
      ctx.arc(s.cx, s.cy, s.R, 0, Math.PI * 2);
      ctx.fillStyle = rim;
      ctx.fill();

      const spec = ctx.createRadialGradient(s.cx - s.R * 0.35, s.cy - s.R * 0.35, 0, s.cx - s.R * 0.35, s.cy - s.R * 0.35, s.R * 0.55);
      spec.addColorStop(0, 'rgba(255,255,255,0.50)');
      spec.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.arc(s.cx, s.cy, s.R, 0, Math.PI * 2);
      ctx.fillStyle = spec;
      ctx.fill();
    };

    const clipGlobe = () => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(s.cx, s.cy, s.R, 0, Math.PI * 2);
      ctx.clip();
    };

    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, s.W, s.H);
      if (!s.drag) s.phi += s.dPhi;
      drawGlobe();
      clipGlobe();
      drawContinents(s.phi);
      drawGrid(s.phi);
      drawArcs(s.phi);
      drawCities(s.phi);
      ctx.restore();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('touchstart', onDown);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="w-full h-full cursor-grab active:cursor-grabbing" style={{ touchAction: 'none' }} />
  );
}

/* ─── University pool & pill layout ─────────────────────────────────────── */
const UNIVERSITIES = [
  { label: 'Oxford · UK',           dot: '#10b981', border: '#d1fae5' },
  { label: 'MIT · USA',             dot: '#234C6A', border: '#E8EEF4' },
  { label: 'Tsinghua · China',      dot: '#f59e0b', border: '#fef3c7' },
  { label: 'Tokyo Univ · Japan',    dot: '#456882', border: '#E8EEF4' },
  { label: 'Cambridge · UK',        dot: '#06b6d4', border: '#cffafe' },
  { label: 'Stanford · USA',        dot: '#ec4899', border: '#fce7f3' },
  { label: 'ETH Zurich · CH',       dot: '#3b82f6', border: '#dbeafe' },
  { label: 'Harvard · USA',         dot: '#ef4444', border: '#fee2e2' },
  { label: 'NUS · Singapore',       dot: '#14b8a6', border: '#ccfbf1' },
  { label: 'Peking · China',        dot: '#f59e0b', border: '#fef3c7' },
  { label: 'Imperial · UK',         dot: '#64748b', border: '#e2e8f0' },
  { label: 'Caltech · USA',         dot: '#f97316', border: '#ffedd5' },
  { label: 'Toronto · Canada',      dot: '#0ea5e9', border: '#e0f2fe' },
  { label: 'TU Munich · Germany',   dot: '#22c55e', border: '#dcfce7' },
  { label: 'KAIST · Korea',         dot: '#456882', border: '#E8EEF4' },
  { label: 'IIT Bombay · India',    dot: '#f43f5e', border: '#ffe4e6' },
  { label: 'Melbourne · Australia', dot: '#10b981', border: '#d1fae5' },
  { label: 'EPFL · Switzerland',    dot: '#3b82f6', border: '#dbeafe' },
  { label: 'McGill · Canada',       dot: '#ef4444', border: '#fee2e2' },
  { label: 'Kyoto · Japan',         dot: '#456882', border: '#E8EEF4' },
  { label: 'SNU · Korea',           dot: '#06b6d4', border: '#cffafe' },
  { label: 'Fudan · China',         dot: '#f59e0b', border: '#fef3c7' },
  { label: 'UCL · UK',              dot: '#234C6A', border: '#E8EEF4' },
  { label: 'UT Austin · USA',       dot: '#f97316', border: '#ffedd5' },
  { label: 'UNSW · Australia',      dot: '#14b8a6', border: '#ccfbf1' },
  { label: 'Columbia · USA',        dot: '#234C6A', border: '#E8EEF4' },
  { label: 'HKU · Hong Kong',       dot: '#22c55e', border: '#dcfce7' },
];

const PILL_POSITIONS = [
  'top-[30%] -left-3',
  'top-[22%] right-4',
  'top-[62%] -left-3',
  'top-[52%] right-4',
];

// Each pill starts at a different offset so they always show distinct universities
const PILL_STARTS  = [0, 7, 14, 20];
// Each pill advances by a different step (all coprime with 27) for full coverage
const PILL_STEPS   = [4, 5, 3, 6];
// Slightly different cycle intervals so pills don't all swap at once
const PILL_CYCLES  = [7000, 8200, 7600, 9000];

export default function TOEConsulting() {
  const [view, setView] = useState('home'); // 'home' | 'signup' | 'login'
  const [isVisible, setIsVisible] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [pills, setPills] = useState(
    PILL_STARTS.map(startIdx => ({ uniIdx: startIdx, shown: false, fading: false }))
  );

  const aboutRef = useRef(null);
  const servicesRef = useRef(null);
  const guidelinesRef = useRef(null);
  const pricingRef = useRef(null);

  useEffect(() => {
    setIsVisible(true);
    const interval = setInterval(() => { setActiveTestimonial((prev) => (prev + 1) % testimonials.length); }, 5000);
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    // Staggered pill reveal + cycling
    const allTimers = [];
    PILL_STARTS.forEach((_, i) => {
      const revealAt = 800 + i * 1300;
      // Initial reveal
      allTimers.push(setTimeout(() => {
        setPills(prev => prev.map((p, idx) => idx === i ? { ...p, shown: true } : p));
        // Start cycling after reveal settles
        const cycleId = setInterval(() => {
          // Fade out
          setPills(prev => prev.map((p, idx) => idx === i ? { ...p, fading: true } : p));
          // Swap university after fade
          const swapId = setTimeout(() => {
            setPills(prev => prev.map((p, idx) => {
              if (idx !== i) return p;
              return { ...p, uniIdx: (p.uniIdx + PILL_STEPS[i]) % UNIVERSITIES.length, fading: false };
            }));
          }, 380);
          allTimers.push(swapId);
        }, PILL_CYCLES[i]);
        allTimers.push(cycleId);
      }, revealAt));
    });
    return () => { clearInterval(interval); window.removeEventListener('scroll', handleScroll); allTimers.forEach(id => { clearTimeout(id); clearInterval(id); }); };
  }, []);

  const scrollTo = (ref) => { setMobileMenuOpen(false); ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const openContact = () => { setMobileMenuOpen(false); setShowContactModal(true); };

  const services = [
    { icon: <GraduationCap className="w-8 h-8" />, title: "Graduate Studies Guidance", description: "Get personalized advice from top university professors on applications, program selection, and application materials assessment.", topics: ["University selection", "Application strategy", "Materials review"], color: "from-[#F8FAFC] to-white", accent: "text-[#234C6A]", border: "border-slate-200 hover:border-[#456882]", iconBg: "bg-[#E8EEF4] text-[#234C6A]" },
    { icon: <Briefcase className="w-8 h-8" />, title: "Research Assessment", description: "Have leading scientists evaluate your research, identify key focus areas, and provide strategic direction for improvements.", topics: ["Research direction", "Methodology advice", "Publication strategy"], color: "from-[#F8FAFC] to-white", accent: "text-[#234C6A]", border: "border-slate-200 hover:border-[#456882]", iconBg: "bg-[#E8EEF4] text-[#234C6A]" },
    { icon: <TrendingUp className="w-8 h-8" />, title: "Career Planning", description: "Learn from senior engineers and managers about job hunting strategies, career advancement, and future planning.", topics: ["Job search tactics", "Career roadmap", "Industry insights"], color: "from-[#F8FAFC] to-white", accent: "text-[#234C6A]", border: "border-slate-200 hover:border-[#456882]", iconBg: "bg-[#E8EEF4] text-[#234C6A]" },
    { icon: <GraduationCap className="w-8 h-8" />, title: "Seminars & Workshops", description: "Attend live sessions on various academic and professional topics.", topics: ["Graduate school application workshops", "Research skill seminars", "Career development webinars"], color: "from-[#F8FAFC] to-white", accent: "text-[#234C6A]", border: "border-slate-200 hover:border-[#456882]", iconBg: "bg-[#E8EEF4] text-[#234C6A]" },
  ];

  const testimonials = [
    { name: "Sarah Chen", role: "PhD Student, Stanford", content: "The guidance I received helped me get into my dream program. My advisor reviewed my research proposal and gave invaluable feedback.", rating: 5, image: "SC", color: "bg-[#E8EEF4] text-[#234C6A]" },
    { name: "Michael Rodriguez", role: "Senior Engineer, Google", content: "Talking with an expert in my field gave me the clarity I needed for my career transition. Worth every minute.", rating: 5, image: "MR", color: "bg-[#E8EEF4] text-[#234C6A]" },
    { name: "Dr. Yuki Tanaka", role: "Research Scientist", content: "As an expert on the platform, I've connected with brilliant minds globally and found exceptional graduate students for my lab.", rating: 5, image: "YT", color: "bg-[#E8EEF4] text-[#234C6A]" },
    { name: "Ahmed Hassan", role: "MBA Graduate", content: "The career planning session transformed my approach to job hunting. I landed three offers within two months.", rating: 5, image: "AH", color: "bg-[#E8EEF4] text-[#234C6A]" },
  ];

  const expertBenefits = [
    "Monetize your knowledge and expertise for societal impact",
    "Direct recruitment pipeline for top graduate students",
    "Expand your global network and perspectives",
    "Flexible scheduling that fits your lifestyle",
    "Conduct seminars and workshops to share your insights with a wider audience",
  ];

  const stats = [
    { number: "500+", label: "Expert Consultants", icon: <Users className="w-6 h-6" />, color: "bg-[#E8EEF4] text-[#234C6A]" },
    { number: "10K+", label: "Consultations Done", icon: <MessageCircle className="w-6 h-6" />, color: "bg-[#E8EEF4] text-[#234C6A]" },
    { number: "4.9/5", label: "Average Rating", icon: <Star className="w-6 h-6" />, color: "bg-[#E8EEF4] text-[#234C6A]" },
    { number: "100+", label: "Countries Served", icon: <Globe className="w-6 h-6" />, color: "bg-[#E8EEF4] text-[#234C6A]" },
  ];

  const footerLinks = {
    Resources: ["Help", "Status", "Privacy", "Legal Agreement", "Cookie Preferences"],
    Company: ["About TOE", "Careers", "Contact", "Press", "Blog"],
    Social: ["Twitter", "LinkedIn", "Facebook", "Instagram", "YouTube"],
  };

  return (
    <div className="min-h-screen text-slate-900" style={{ fontFamily: "'DM Sans', sans-serif", backgroundColor: '#F8FAFC' }}>
      {showContactModal && <ContactFormModal onClose={() => setShowContactModal(false)} />}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&family=Inter:wght@400;500;600;700;800&display=swap');
        .font-display { font-family: 'Playfair Display', serif; }
        .font-stat-inter { font-family: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(32px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes float { 0%, 100% { transform: translateY(0px) rotate(0deg); } 33% { transform: translateY(-12px) rotate(1deg); } 66% { transform: translateY(-6px) rotate(-1deg); } }
        @keyframes pillReveal { 0% { opacity: 0; transform: scale(0.72) translateY(14px); } 65% { opacity: 1; transform: scale(1.05) translateY(-3px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        .hero-headline-gradient {
          background: linear-gradient(135deg, #1B3C53 0%, #234C6A 40%, #456882 70%, #D9EAFD 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          display: block;
        }
        @keyframes pulse-soft { 0%, 100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }
        .animate-fade-up { animation: fadeUp 0.8s ease-out both; }
        .animate-fade-in { animation: fadeIn 0.6s ease-out both; }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-pulse-soft { animation: pulse-soft 3s ease-in-out infinite; }
        .hero-grid {
          background-image: linear-gradient(rgba(188,204,220,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(188,204,220,0.22) 1px, transparent 1px);
          background-size: 60px 60px;
        }
        .card-hover { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .card-hover:hover { transform: translateY(-6px); box-shadow: 0 20px 60px -10px rgba(0,0,0,0.15); }
        .page-dots {
          background-image: radial-gradient(circle, rgba(148,163,184,0.55) 1.7px, transparent 1.7px);
          background-size: 26px 26px;
        }
        .page-dots-layer {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image: radial-gradient(circle, rgba(148,163,184,0.55) 1.7px, transparent 1.7px);
          background-size: 26px 26px;
        }
        .page-dots-layer--animated {
          animation: dotsFade 4s ease-in-out infinite;
        }
        @keyframes dotsFade {
          0%, 100% { opacity: 0.10; }
          50% { opacity: 0.65; }
        }
        .nav-link { position: relative; }
        .nav-link::after { content: ''; position: absolute; bottom: -2px; left: 0; width: 0; height: 2px; background: #9AA6B2; transition: width 0.3s ease; }
        .nav-link:hover::after { width: 100%; }
        .gradient-text { background: linear-gradient(135deg, #1B3C53 0%, #234C6A 45%, #456882 75%, #D9EAFD 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .hero-blob { background: radial-gradient(ellipse at center, rgba(156,173,189,0.32) 0%, transparent 70%); filter: blur(40px); }
        .hero-blob-2 { background: radial-gradient(ellipse at center, rgba(26,53,72,0.35) 0%, transparent 70%); filter: blur(50px); }
        .section-label { letter-spacing: 0.15em; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
        .btn-primary { background: linear-gradient(135deg, #234C6A, #456882); transition: all 0.3s ease; }
        .btn-primary:hover { background: linear-gradient(135deg, #1B3C53, #234C6A); box-shadow: 0 12px 40px rgba(26,53,72,0.38); transform: translateY(-1px); }
        .about-highlight { background: linear-gradient(135deg, #F8FAFC, #F0F4F8); border-left: 4px solid #9AA6B2; }
        .footer-bg { background: #1B3C53; }
      `}</style>

      {/* NAV */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#F8FAFC]/95 backdrop-blur-md shadow-sm border-b border-[#BCCCDC]' : 'bg-[#F8FAFC]/80 backdrop-blur-sm'}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-18 py-4">
          <button type="button" onClick={() => setView('home')} className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#1B3C53] to-[#456882] flex items-center justify-center shadow-md shadow-[#D9EAFD] group-hover:shadow-[#9AA6B2] transition-shadow">
              <BookOpen className="h-5 w-5 text-white" strokeWidth={2.2} />
            </div>
            <div className="leading-none">
              <div className="font-display font-bold text-xl text-slate-900">TOE</div>
            </div>
          </button>
          <nav className="hidden lg:flex items-center gap-8">
            {[["About Us", () => scrollTo(aboutRef)], ["Services", () => scrollTo(servicesRef)], ["Guidelines", () => scrollTo(guidelinesRef)], ["Pricing", () => scrollTo(pricingRef)], ["Contact Us", openContact]].map(([label, action]) => (
              <button key={label} onClick={action} className="nav-link text-slate-900 hover:text-[#234C6A] transition-colors text-sm font-semibold tracking-wide">{label}</button>
            ))}
          </nav>
          <div className="hidden lg:flex items-center gap-3">
            <button onClick={() => setView('login')} className="px-5 py-2.5 rounded-full border border-[#BCCCDC] text-slate-900 hover:border-[#9AA6B2] hover:text-[#234C6A] transition-all text-sm font-semibold bg-white/85">Login</button>
            <button onClick={() => setView('signup')} className="btn-primary px-5 py-2.5 rounded-full text-white font-semibold text-sm shadow-md shadow-[#BCCCDC]">Sign Up</button>
          </div>
          <button className="lg:hidden p-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition" onClick={() => setMobileMenuOpen(v => !v)}>
            {mobileMenuOpen ? <X className="w-5 h-5 text-slate-600" /> : <Menu className="w-5 h-5 text-slate-600" />}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[#BCCCDC] bg-[#F8FAFC] px-6 py-4 space-y-3">
            {[["About Us", () => scrollTo(aboutRef)], ["Services", () => scrollTo(servicesRef)], ["Guidelines", () => scrollTo(guidelinesRef)], ["Pricing", () => scrollTo(pricingRef)], ["Contact Us", openContact]].map(([label, action]) => (
              <button key={label} onClick={action} className="block w-full text-left text-slate-700 hover:text-[#234C6A] font-semibold py-1 transition-colors">{label}</button>
            ))}
            <div className="flex gap-3 pt-2">
              <button onClick={() => { setMobileMenuOpen(false); setView('login'); }} className="flex-1 py-2.5 rounded-full border border-slate-300 text-slate-700 text-sm font-semibold">Login</button>
              <button onClick={() => { setMobileMenuOpen(false); setView('signup'); }} className="flex-1 py-2.5 btn-primary rounded-full text-white text-sm font-semibold">Sign Up</button>
            </div>
          </div>
        )}
      </header>

      {view === 'signup' && <SignupPage onClose={() => setView('home')} onGoLogin={() => setView('login')} />}
      {view === 'login' && <LoginPage onClose={() => setView('home')} onGoSignup={() => setView('signup')} />}
      {view === 'home' && (
      <>
      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center overflow-hidden" style={{ backgroundColor: '#F8FAFC' }}>

        <div className="page-dots-layer page-dots-layer--animated" aria-hidden="true" />

        <div className="absolute -top-40 right-0 w-[700px] h-[700px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, rgba(156,173,189,0.32) 0%, transparent 65%)', filter: 'blur(70px)' }}></div>
        <div className="absolute -bottom-20 -left-10 w-[450px] h-[450px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, rgba(26,53,72,0.28) 0%, transparent 65%)', filter: 'blur(55px)' }}></div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 w-full pt-28 pb-20 grid lg:grid-cols-[1fr_1fr] gap-0 items-center min-h-screen">

          {/* ── LEFT: Copy column ── */}
          <div className={`relative z-10 lg:pr-14 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>

            <div className="inline-flex items-center gap-2.5 mb-8 px-4 py-2 rounded-full bg-white/80 border border-[#BCCCDC] shadow-sm animate-fade-in" style={{ animationDelay: '0.05s', boxShadow: '0 1px 3px rgba(35,60,82,0.08)' }}>
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ backgroundColor: '#234C6A' }}></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: '#234C6A' }}></span>
              </span>
              <span className="text-[11px] font-bold tracking-[0.13em] uppercase" style={{ color: '#234C6A' }}>500+ Active Experts · 100+ Countries</span>
            </div>

            <h1 className="font-display font-bold leading-[1.04] mb-6 animate-fade-up" style={{ animationDelay: '0.15s', fontSize: 'clamp(3rem, 5.5vw, 5rem)' }}>
              <span style={{ color: '#234C6A' }}>Thoughts</span>
              <br />
              <span className="text-slate-800">of </span>
              <span className="text-slate-900 relative">Experts</span>
            </h1>

            <p className="text-slate-500 leading-relaxed mb-9 max-w-[480px] animate-fade-up" style={{ animationDelay: '0.28s', fontSize: '1.0625rem' }}>
              Connect directly with world-leading professors, scientists, and senior engineers. Get personalized guidance on graduate studies, research, and career advancement from PhDs who've mastered their craft.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 items-start mb-10 animate-fade-up" style={{ animationDelay: '0.4s' }}>
              <button onClick={() => setView('signup')} className="group btn-primary px-8 py-4 rounded-2xl font-semibold text-white flex items-center gap-2.5 shadow-xl text-[0.9375rem]" style={{ boxShadow: '0 10px 40px rgba(35,60,82,0.25)' }}>
                Book a Consultation
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
              </button>
              <button onClick={() => setView('signup')} className="px-8 py-4 rounded-2xl border-2 border-slate-200 bg-white/70 backdrop-blur-sm text-slate-700 font-semibold text-[0.9375rem] hover:border-[#456882] hover:text-[#234C6A] hover:bg-white transition-all duration-300">
                Become an Expert
              </button>
            </div>

            <div className="flex items-center gap-5 mb-10 animate-fade-up" style={{ animationDelay: '0.52s' }}>
              <div className="flex -space-x-3">
                {[
                  { i: 'SC', bg: '#E8EEF4', fg: '#234C6A' }, { i: 'MR', bg: '#E8EEF4', fg: '#234C6A' },
                  { i: 'YT', bg: '#E8EEF4', fg: '#234C6A' }, { i: 'AH', bg: '#E8EEF4', fg: '#234C6A' },
                  { i: 'KL', bg: '#E8EEF4', fg: '#234C6A' },
                ].map(({ i, bg, fg }, idx) => (
                  <div key={idx} className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold shadow-sm"
                    style={{ background: bg, color: fg }}>{i}</div>
                ))}
                <div className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-sm" style={{ backgroundColor: '#234C6A' }}>+9K</div>
              </div>
              <div>
                <div className="flex gap-0.5 mb-0.5">{[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />)}</div>
                <p className="text-xs text-slate-500">Trusted by <span className="font-bold text-slate-800">10,000+</span> clients worldwide</p>
              </div>
            </div>

            <div className="mt-14 hidden lg:flex animate-fade-up" style={{ animationDelay: '0.72s' }}>
              <button onClick={() => scrollTo(aboutRef)} className="flex items-center gap-2 text-slate-400 hover:text-[#234C6A] transition-colors group">
                <ChevronDown className="w-4 h-4 group-hover:translate-y-1 transition-transform animate-pulse-soft" />
                <span className="text-[10px] font-bold tracking-[0.18em] uppercase">Explore</span>
              </button>
            </div>
          </div>

          {/* ── RIGHT: Visual panel ── */}
          <div className={`relative flex items-center justify-center transition-all duration-1200 delay-150 ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`} style={{ minHeight: '820px' }}>

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[500px] h-[500px] rounded-full"
                style={{ background: 'radial-gradient(ellipse, rgba(35,60,82,0.18) 0%, rgba(69,104,130,0.08) 45%, transparent 70%)', filter: 'blur(32px)' }}></div>
            </div>

            <div className="relative w-[660px] h-[660px] max-w-full drop-shadow-2xl">
              <GlobeCanvas />
            </div>

           

            {/* Drag hint */}
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-white/85 backdrop-blur-sm border border-slate-200 rounded-full px-4 py-1.5 z-20 pointer-events-none select-none shadow-sm">
              <svg className="w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 9l7-7 7 7M5 15l7 7 7-7"/></svg>
              <span className="text-[11px] text-slate-400 font-semibold">Drag to rotate</span>
            </div>

            {/* Floating university pills — pool of 27, cycling independently */}
            {PILL_POSITIONS.map((cls, i) => {
              const { uniIdx, shown, fading } = pills[i];
              const uni = UNIVERSITIES[uniIdx];
              return (
                <div key={i} className={`absolute ${cls} z-10`}
                  style={{
                    opacity: shown ? 1 : 0,
                    transform: shown ? 'scale(1) translateY(0)' : 'scale(0.78) translateY(14px)',
                    transition: 'opacity 0.55s cubic-bezier(0.34,1.56,0.64,1), transform 0.55s cubic-bezier(0.34,1.56,0.64,1)',
                  }}>
                  <div className="bg-white/95 backdrop-blur-sm rounded-2xl px-3.5 py-2.5 shadow-lg"
                    style={{
                      border: `1px solid ${uni.border}`,
                      animation: shown ? 'float 10s ease-in-out infinite' : 'none',
                      opacity: fading ? 0 : 1,
                      transition: 'opacity 0.38s ease, border-color 0.38s ease',
                    }}>
                    <div className="flex items-center gap-2.5">
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50" style={{ backgroundColor: uni.dot }}></span>
                        <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: uni.dot }}></span>
                      </span>
                      <span className="text-[11px] font-bold text-slate-700 whitespace-nowrap">{uni.label}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="relative py-16 px-6 border-y border-slate-200" style={{ backgroundColor: '#F0F4F8' }}>
        <div className="page-dots-layer page-dots-layer--animated" aria-hidden="true" />
        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <div key={index} className="text-center card-hover p-6 rounded-2xl border border-slate-200" style={{ backgroundColor: '#F8FAFC' }}>
                <div className={`inline-flex items-center justify-center w-12 h-12 mb-3 rounded-xl ${stat.color}`}>{stat.icon}</div>
                <div className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 mb-1 font-stat-inter tabular-nums">{stat.number}</div>
                <div className="text-slate-500 text-sm font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section ref={aboutRef} className="relative py-28 px-6 scroll-mt-20" style={{ backgroundColor: '#F8FAFC' }}>
        <div className="page-dots-layer page-dots-layer--animated" aria-hidden="true" />
        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <div className="inline-block section-label text-[#234C6A] mb-4">About Us</div>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight">Connected to Knowledge <span className="gradient-text">Across the Globe</span></h2>
              <p className="text-slate-600 text-lg leading-relaxed mb-4">Starting from Study and Work Abroad — TOE is a global consulting service company backed by professors in top universities in the U.S. and other countries.</p>
              <p className="text-slate-600 leading-relaxed mb-6">The business draws on the talents of elite professionals — mostly top-notch professors, scientists, researchers and other successful professionals. These elite professionals all have their graduate degrees, mostly Ph.D., with decades of successful experiences.</p>
              <div className="about-highlight rounded-r-xl p-5 mb-6">
                <p className="text-slate-700 font-medium leading-relaxed">A 30-minute conversation with an authoritative expert through this platform could save clients years or months of effort — or countless dollars that could otherwise be wasted in darkness.</p>
              </div>
              <button onClick={openContact} className="px-6 py-3 rounded-full btn-primary text-white font-semibold text-sm shadow-md shadow-[#BCCCDC]">Contact Us</button>
            </div>
            <div className="space-y-5 lg:pt-12">
              {[
                { emoji: "🎓", title: "Who are our clients?", text: "People planning to go abroad for graduate studies, people looking for a job in the western world, and researchers seeking insightful advice with their research efforts.", color: "border-slate-200", bg: "#F8FAFC" },
                { emoji: "🏆", title: "How do our experts join?", text: "Talents sign on a volunteer basis, providing available time slots for consulting at an asking price of their choice. It's flexible, impactful, and community-driven.", color: "border-slate-200", bg: "#F8FAFC" },
                { emoji: "📅", title: "How does booking work?", text: "Clients prepay for a time slot at the asking price plus a client-determined tip (zero or more) before an appointment is made.", color: "border-slate-200", bg: "#F8FAFC" },
                { emoji: "🎥", title: "How do sessions run?", text: "At the time of an appointment, the expert and client converse via video or audio depending on agreed choices. Conversations may be recorded for quality control.", color: "border-slate-200", bg: "#F8FAFC" },
              ].map((item, i) => (
                <div key={i} className={`card-hover p-5 rounded-2xl border ${item.color} flex gap-4 items-start`} style={{ backgroundColor: item.bg }}>
                  <span className="text-2xl mt-0.5">{item.emoji}</span>
                  <div>
                    <div className="font-semibold text-slate-800 mb-1">{item.title}</div>
                    <p className="text-slate-500 text-sm leading-relaxed">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section ref={servicesRef} className="relative py-28 px-6 scroll-mt-20" style={{ backgroundColor: '#F0F4F8' }}>
        <div className="page-dots-layer page-dots-layer--animated" aria-hidden="true" />
        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block section-label text-[#234C6A] mb-4">Our Services</div>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-slate-900 mb-4">Expert Consulting Services</h2>
            <p className="text-slate-600 text-lg max-w-2xl mx-auto">Get personalized, one-on-one guidance from the elites of the elite</p>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            {services.map((service, index) => (
              <div key={index} className={`card-hover p-8 rounded-3xl border ${service.border} group cursor-pointer`} style={{ background: 'linear-gradient(135deg, rgba(69,104,130,0.05) 0%, rgba(69,104,130,0.10) 100%), #F0F4F8' }}>
                <div className="inline-flex items-center justify-center w-14 h-14 mb-6 rounded-2xl group-hover:scale-110 transition-transform duration-300 text-[#234C6A]" style={{ backgroundColor: 'rgba(69,104,130,0.12)' }}>{service.icon}</div>
                <h3 className="font-display text-xl font-bold text-slate-900 mb-3">{service.title}</h3>
                <p className="text-slate-500 mb-5 leading-relaxed text-sm">{service.description}</p>
                <div className="space-y-2">
                  {service.topics.map((topic, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                      <CheckCircle className={`w-4 h-4 flex-shrink-0 ${service.accent}`} />{topic}
                    </div>
                  ))}
                </div>
                <button onClick={openContact} className={`mt-6 flex items-center gap-1 text-sm font-semibold ${service.accent} group-hover:gap-2 transition-all`}>
                  Contact to book <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GUIDELINES */}
      <section ref={guidelinesRef} className="relative py-28 px-6 scroll-mt-20" style={{ backgroundColor: '#F8FAFC' }}>
        <div className="page-dots-layer page-dots-layer--animated" aria-hidden="true" />
        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="text-left mb-10">
            <div className="inline-block section-label text-[#234C6A] mb-4">Guidelines</div>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Guidelines for Experts and Clients
            </h2>
            <p className="text-slate-600 text-lg leading-relaxed">
              The following guidelines apply to all services provided through our platform.
            </p>
          </div>
          <div className="space-y-6">
            {[
              { emoji: "💳", title: "Appointments & Payments", text: "Our platform operates on an appointment-only basis and does not offer on-demand or real-time services. An appointment is confirmed once the client has submitted payment at the expert's listed rate, plus any applicable gratuity. If the client fails to attend the scheduled appointment, the payment is non-refundable. If the expert fails to attend, the client is entitled to a full refund.", color: "border-[#BCCCDC]" },
              { emoji: "📋", title: "Complaints & Resolution", text: "Clients may submit a complaint in the event of service-related issues, including but not limited to expert tardiness, platform technical difficulties, or unsatisfactory service quality. Our team will review each complaint and make every effort to respond within five (5) business days.", color: "border-[#BCCCDC]" },
            ].map((item, i) => (
              <div key={i} className={`card-hover p-5 md:p-6 rounded-2xl border ${item.color} flex gap-4 items-start`} style={{ background: 'linear-gradient(rgba(69,104,130,0.06), rgba(69,104,130,0.06)), #F8FAFC' }}>
                <span className="text-2xl mt-0.5">{item.emoji}</span>
                <div>
                  <div className="font-semibold text-slate-800 mb-2 text-lg">{item.title}</div>
                  <p className="text-slate-600 text-sm leading-relaxed">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="relative py-28 px-6" style={{ backgroundColor: '#F8FAFC' }}>
        <div className="page-dots-layer page-dots-layer--animated" aria-hidden="true" />
        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block section-label text-[#234C6A] mb-4">Success Stories</div>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-slate-900 mb-4">Hear From Our Community</h2>
            <p className="text-slate-600 text-lg">Clients and experts who've transformed their journeys</p>
          </div>
          <div className="relative rounded-3xl border border-slate-200 p-10 md:p-16 overflow-hidden min-h-[320px] flex items-center" style={{ background: 'linear-gradient(135deg, #F0F4F8 0%, #E8EEF4 100%)' }}>
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-60" style={{ background: 'radial-gradient(circle, rgba(35,60,82,0.12) 0%, transparent 70%)' }}></div>
            {testimonials.map((testimonial, index) => (
              <div key={index} className={`absolute inset-0 p-10 md:p-16 flex items-center transition-all duration-700 ${index === activeTestimonial ? 'opacity-100 translate-x-0' : index < activeTestimonial ? 'opacity-0 -translate-x-full' : 'opacity-0 translate-x-full'}`}>
                <div className="text-center w-full">
                  <div className={`inline-flex items-center justify-center w-16 h-16 mb-5 rounded-2xl ${testimonial.color} text-lg font-bold`}>{testimonial.image}</div>
                  <div className="flex justify-center gap-1 mb-5">{[...Array(testimonial.rating)].map((_, i) => <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />)}</div>
                  <p className="font-display text-xl md:text-2xl text-slate-700 mb-6 leading-relaxed italic max-w-2xl mx-auto">"{testimonial.content}"</p>
                  <div><div className="font-bold text-slate-900">{testimonial.name}</div><div className="text-slate-500 text-sm mt-1">{testimonial.role}</div></div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-2 mt-6">
            {testimonials.map((_, index) => (
              <button key={index} onClick={() => setActiveTestimonial(index)}
                className={`h-2 rounded-full transition-all duration-300 ${index === activeTestimonial ? 'bg-[#234C6A] w-8' : 'bg-slate-300 w-2 hover:bg-slate-400'}`} />
            ))}
          </div>
        </div>
      </section>

      {/* JOIN AS EXPERT */}
      <section className="relative py-28 px-6" style={{ backgroundColor: '#F0F4F8' }}>
        <div className="page-dots-layer page-dots-layer--animated" aria-hidden="true" />
        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-block section-label text-[#234C6A] mb-4">For Experts</div>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight">Share Your Expertise, <span className="gradient-text">Make an Impact</span></h2>
              <p className="text-slate-600 text-lg mb-8 leading-relaxed">Share your decades of experience with the next generation. Make a meaningful impact while building your global network and earning for your expertise.</p>
              <div className="space-y-3 mb-8">
                {expertBenefits.map((benefit, index) => (
                  <div key={index} className="card-hover flex items-start gap-4 p-4 rounded-xl border border-slate-200" style={{ background: 'linear-gradient(rgba(69,104,130,0.06), rgba(69,104,130,0.06)), #F0F4F8' }}>
                    <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#234C6A' }} />
                    <span className="text-slate-700 font-medium">{benefit}</span>
                  </div>
                ))}
              </div>
              <button onClick={openContact} className="group btn-primary px-8 py-4 rounded-full font-semibold text-white text-base flex items-center gap-2 shadow-lg shadow-[#BCCCDC]">
                Apply to Become an Expert <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: <GraduationCap className="w-8 h-8" style={{ color: '#234C6A' }} />, title: "PhD+", sub: "Required Credential", border: "border-slate-200" },
                { icon: <Globe className="w-8 h-8" style={{ color: '#234C6A' }} />, title: "Global", sub: "Network Reach", border: "border-slate-200" },
                { icon: <TrendingUp className="w-8 h-8" style={{ color: '#234C6A' }} />, title: "Flexible", sub: "Your Schedule", border: "border-slate-200" },
                { icon: <Sparkles className="w-8 h-8" style={{ color: '#234C6A' }} />, title: "Impact", sub: "Make a Difference", border: "border-slate-200" },
              ].map((item, i) => (
                <div key={i} className={`card-hover p-6 rounded-2xl border ${item.border}`} style={{ background: 'linear-gradient(rgba(69,104,130,0.06), rgba(69,104,130,0.06)), #F0F4F8' }}>
                  {item.icon}
                  <div className="text-2xl font-bold text-slate-900 mt-3 mb-1 font-display">{item.title}</div>
                  <div className="text-slate-500 text-sm">{item.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section ref={pricingRef} className="relative py-24 px-6 scroll-mt-20" style={{ backgroundColor: '#F8FAFC' }}>
        <div className="page-dots-layer page-dots-layer--animated" aria-hidden="true" />
        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl p-12 md:p-16 text-center" style={{ background: 'linear-gradient(135deg, #1B3C53 0%, #234C6A 40%, #456882 70%, #D9EAFD 100%)' }}>
            <div className="absolute inset-0 hero-grid opacity-10"></div>
            <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="relative">
              <div className="inline-block section-label text-[#D9EAFD] mb-4">Get Started</div>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">Ready to Connect?</h2>
              <p className="text-[#D9EAFD] text-lg mb-8 max-w-xl mx-auto">Whether you're seeking guidance or ready to share your expertise, start your journey with TOE today.</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button onClick={() => setView('signup')} className="group px-8 py-4 bg-white rounded-full font-bold text-[#234C6A] text-base hover:bg-[#D9EAFD] transition-all shadow-xl flex items-center gap-2 justify-center">
                  Get Started Now <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <button onClick={openContact} className="px-8 py-4 rounded-full border-2 border-white/30 text-white font-bold text-base hover:bg-white/10 transition-all">Contact Us</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer-bg text-white">
        <div className="max-w-7xl mx-auto px-6 pt-16 pb-8">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-12 mb-12">
            <div className="md:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#1B3C53]/40 to-[#456882]/40 border border-[#BCCCDC]/40 flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-[#F8FAFC]" strokeWidth={2.2} />
                </div>
                <div><div className="font-display font-bold text-lg text-white">TOE</div><div className="text-xs text-[#D9EAFD]">Talk with experts</div></div>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">Connecting expertise with ambition, globally.</p>
              <button onClick={openContact} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 text-white text-sm font-semibold transition">
                <MessageCircle className="w-4 h-4" /> Contact Us
              </button>
            </div>
            {Object.entries(footerLinks).map(([category, links]) => (
              <div key={category}>
                <div className="font-semibold text-white mb-4 text-sm tracking-wide">{category}</div>
                <ul className="space-y-2.5">
                  {links.map(link => (<li key={link}><a href="#" className="text-slate-400 hover:text-white text-sm transition-colors">{link}</a></li>))}
                </ul>
              </div>
            ))}
          </div>
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-slate-500 text-sm">© 2026 TOE LTD. All rights reserved.</div>
            <div className="flex gap-6">
              {["Privacy", "Terms", "Cookie Preferences"].map(item => (<a key={item} href="#" className="text-slate-500 hover:text-white text-sm transition-colors">{item}</a>))}
            </div>
          </div>
        </div>
      </footer>
      </>
      )}
    </div>
  );
}
