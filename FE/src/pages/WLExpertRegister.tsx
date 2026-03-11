import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
    User, Mail, Lock, Phone, AlertCircle, CheckCircle, ChevronDown,
    ArrowRight, Upload, BookOpen, Eye, EyeOff
} from 'lucide-react';
import { callApi } from '../api/api';
import { showAlert } from '../actions/alertActions';
import ConfirmEmail from '../components/ConfirmEmail';
import SocialAuthBlock from '../components/SocialAuthBlock';

const BTN_PRIMARY_STYLE = { background: 'linear-gradient(135deg, #234C6A 0%, #456882 100%)' };
const FOCUS_RING = 'focus:ring-2 focus:ring-[#234C6A]/60 focus:border-[#234C6A]';
const ACCENT_BG = 'hover:bg-[#D9EAFD]/60';
const ACCENT_SELECTED = 'bg-[#D9EAFD]/70 text-[#234C6A]';

const COUNTRY_CODES = [
    { code: '+1', country: 'US/CA', flag: '🇺🇸' }, { code: '+44', country: 'UK', flag: '🇬🇧' },
    { code: '+86', country: 'China', flag: '🇨🇳' }, { code: '+81', country: 'Japan', flag: '🇯🇵' },
    { code: '+91', country: 'India', flag: '🇮🇳' }, { code: '+49', country: 'Germany', flag: '🇩🇪' },
    { code: '+33', country: 'France', flag: '🇫🇷' }, { code: '+61', country: 'Australia', flag: '🇦🇺' },
    { code: '+55', country: 'Brazil', flag: '🇧🇷' }, { code: '+82', country: 'Korea', flag: '🇰🇷' },
    { code: '+65', country: 'Singapore', flag: '🇸🇬' }, { code: '+971', country: 'UAE', flag: '🇦🇪' },
    { code: '+92', country: 'Pakistan', flag: '🇵🇰' }, { code: '+234', country: 'Nigeria', flag: '🇳🇬' },
];

const ENGINEERING_MAJORS = [
    'Aerospace Engineering', 'Biomedical Engineering', 'Chemical Engineering',
    'Civil Engineering', 'Computer Engineering', 'Electrical Engineering',
    'Environmental Engineering', 'Industrial Engineering', 'Mechanical Engineering',
    'Materials Science & Engineering', 'Nuclear Engineering', 'Petroleum Engineering',
    'Software Engineering', 'Systems Engineering', 'Other',
];

const EXPERT_SERVICES = ['Study abroad', 'Work abroad', 'Research guidance'];

const COUNTRIES = [
    'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France',
    'India', 'China', 'Japan', 'South Korea', 'Singapore', 'UAE', 'Brazil', 'Mexico',
    'Netherlands', 'Switzerland', 'Sweden', 'Italy', 'Spain', 'Pakistan', 'Nigeria',
    'Egypt', 'Kenya', 'South Africa', 'Argentina', 'Thailand', 'Malaysia', 'Other',
];

export default function WLExpertRegister() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [form, setForm] = useState({
        fullName: '', title: '', bio: '', majors: [] as string[], servicesOffered: [] as string[], country: '', countryCode: '+1', phone: '', email: '', password: '', confirmPassword: '', specialNote: '', resumeFile: null as File | null, terms: false
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [confirmEmailSent, setConfirmEmailSent] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [showMajorDrop, setShowMajorDrop] = useState(false);
    const [showServicesDrop, setShowServicesDrop] = useState(false);
    const [showCountryDrop, setShowCountryDrop] = useState(false);
    const [showCodeDrop, setShowCodeDrop] = useState(false);
    const majorRef = useRef<HTMLDivElement>(null);
    const servicesRef = useRef<HTMLDivElement>(null);
    const countryRef = useRef<HTMLDivElement>(null);
    const codeRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (majorRef.current && !majorRef.current.contains(e.target as Node)) setShowMajorDrop(false);
            if (servicesRef.current && !servicesRef.current.contains(e.target as Node)) setShowServicesDrop(false);
            if (countryRef.current && !countryRef.current.contains(e.target as Node)) setShowCountryDrop(false);
            if (codeRef.current && !codeRef.current.contains(e.target as Node)) setShowCodeDrop(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const toggleMajor = (m: string) => {
        setForm(f => ({ ...f, majors: f.majors.includes(m) ? f.majors.filter(x => x !== m) : [...f.majors, m] }));
        setErrors(e => ({ ...e, majors: '' }));
    };
    const toggleService = (s: string) => {
        setForm(f => ({ ...f, servicesOffered: f.servicesOffered.includes(s) ? f.servicesOffered.filter(x => x !== s) : [...f.servicesOffered, s] }));
        setErrors(e => ({ ...e, servicesOffered: '' }));
    };

    const validate = () => {
        const e: Record<string, string> = {};
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
        if (form.specialNote.trim().length > 50) e.specialNote = 'Special note must be 50 characters or less';
        if (!form.terms) e.terms = 'You must accept the terms and conditions';
        return e;
    };

    const handleSubmit = async () => {
        const e = validate();
        if (Object.keys(e).length > 0) { setErrors(e); return; }
        setSubmitting(true);
        try {
            const data = {
                role: 'expert',
                username: form.fullName,
                title: form.title,
                about: form.bio,
                keywords: form.majors,
                services: form.servicesOffered,
                state: '',
                country: form.country,
                city: '',
                phoneNumber: form.countryCode + form.phone,
                email: form.email,
                password: form.password,
                timeSlots: [],
                ...(form.specialNote.trim() && { specialNote: form.specialNote.trim() })
            };
            const response = await callApi('POST', 'auth/register', data, form.resumeFile || undefined) as any;
            if (response.status === 'SUCCESS') {
                setConfirmEmailSent(true);
            } else {
                dispatch(showAlert(response.error));
            }
        } catch (err) {
            dispatch(showAlert('Registration failed. Please try again.'));
        }
        setSubmitting(false);
    };

    const selectedCode = COUNTRY_CODES.find(c => c.code === form.countryCode) || COUNTRY_CODES[0];
    const inputBase = `w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-200 ${FOCUS_RING}`;
    const inputNormal = `${inputBase} border-slate-200`;
    const inputError = `${inputBase} border-red-300 focus:ring-red-300 focus:border-red-400 bg-red-50/30`;

    if (confirmEmailSent) {
        return <ConfirmEmail email={form.email} />;
    }

    return (
        <div className="relative min-h-screen py-12 px-4" style={{ backgroundColor: '#F8FAFC' }}>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        .font-display { font-family: 'Playfair Display', serif; }
        .auth-dots-layer {
          position: absolute; inset: 0; pointer-events: none; background-color: #F8FAFC;
          background-image: radial-gradient(circle, rgba(188,204,220,0.45) 1.8px, transparent 1.8px);
          background-size: 28px 28px;
        }
        .auth-dots-layer--animate { animation: authDotsDrift 35s linear infinite; }
        @keyframes authDotsDrift { 0% { background-position: 0 0; } 100% { background-position: 28px 28px; } }
      `}</style>

            <div className="auth-dots-layer auth-dots-layer--animate" aria-hidden="true" />
            <button onClick={() => navigate('/')} className="fixed top-4 left-4 z-20 flex items-center gap-2 text-slate-500 hover:text-[#234C6A] text-sm font-semibold px-4 py-2 rounded-xl bg-white/90 backdrop-blur-sm border border-slate-200 shadow-sm hover:border-[#456882] transition-colors">
                <ArrowRight className="w-4 h-4 rotate-180" /> Back to Home
            </button>
            <div className="relative z-10 max-w-xl mx-auto pt-2">
                <div className="rounded-3xl border border-slate-200 shadow-xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }}>
                    <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #234C6A, #456882)' }} />
                    <div className="p-6 sm:p-8">
                        {/* Logo */}
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#1B3C53] to-[#456882] flex items-center justify-center shadow-md">
                                <BookOpen className="h-5 w-5 text-white" strokeWidth={2.2} />
                            </div>
                            <div className="font-display font-bold text-xl text-slate-900">WisdomLinked</div>
                        </div>

                        <h2 className="font-display text-2xl font-bold text-slate-800 mb-1">Expert sign up</h2>
                        <p className="text-slate-500 text-sm mb-6">Tell us about your expertise to join as a consultant</p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5"><span className="flex items-center gap-1.5"><User size={12} /> Full name</span></label>
                                <input type="text" placeholder="e.g. Dr. Jane Smith" value={form.fullName}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setForm(f => ({ ...f, fullName: e.target.value })); setErrors(er => ({ ...er, fullName: '' })); }}
                                    className={errors.fullName ? inputError : inputNormal} />
                                {errors.fullName && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.fullName}</p>}
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Title</label>
                                <input type="text" placeholder="e.g. Professor, Senior Engineer, Research Scientist" value={form.title}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setForm(f => ({ ...f, title: e.target.value })); setErrors(er => ({ ...er, title: '' })); }}
                                    className={errors.title ? inputError : inputNormal} />
                                {errors.title && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.title}</p>}
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Short description / bio</label>
                                <textarea rows={4} placeholder="Brief background, expertise areas, and what you can offer..." value={form.bio}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => { setForm(f => ({ ...f, bio: e.target.value })); setErrors(er => ({ ...er, bio: '' })); }}
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
                                        {EXPERT_SERVICES.map(s => (
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
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setForm(f => ({ ...f, phone: e.target.value })); setErrors(er => ({ ...er, phone: '' })); }}
                                        className={`flex-1 ${errors.phone ? inputError : inputNormal}`} />
                                </div>
                                {errors.phone && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.phone}</p>}
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5"><span className="flex items-center gap-1.5"><Mail size={12} /> Email</span></label>
                                <input type="email" placeholder="you@example.com" value={form.email}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setForm(f => ({ ...f, email: e.target.value })); setErrors(er => ({ ...er, email: '' })); }}
                                    className={errors.email ? inputError : inputNormal} />
                                {errors.email && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.email}</p>}
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5"><span className="flex items-center gap-1.5"><Lock size={12} /> Password</span></label>
                                <div className="relative">
                                    <input type={showPassword ? 'text' : 'password'} placeholder="Min. 8 characters" value={form.password}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setForm(f => ({ ...f, password: e.target.value })); setErrors(er => ({ ...er, password: '', confirmPassword: '' })); }}
                                        className={`${errors.password ? inputError : inputNormal} pr-10`} />
                                    <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                {errors.password && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.password}</p>}
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Confirm password</label>
                                <div className="relative">
                                    <input type={showConfirmPassword ? 'text' : 'password'} placeholder="Re-enter password" value={form.confirmPassword}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setForm(f => ({ ...f, confirmPassword: e.target.value })); setErrors(er => ({ ...er, confirmPassword: '' })); }}
                                        className={`${errors.confirmPassword ? inputError : inputNormal} pr-10`} />
                                    <button type="button" onClick={() => setShowConfirmPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}>
                                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                {errors.confirmPassword && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.confirmPassword}</p>}
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Special note</label>
                                <input type="text" placeholder="Optional, max 50 characters" value={form.specialNote} maxLength={50}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setForm(f => ({ ...f, specialNote: e.target.value })); setErrors(er => ({ ...er, specialNote: '' })); }}
                                    className={errors.specialNote ? inputError : inputNormal} />
                                <div className="flex items-center justify-between mt-1">
                                    {errors.specialNote && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.specialNote}</p>}
                                    <span className={`text-xs ml-auto ${form.specialNote.length >= 50 ? 'text-amber-600' : 'text-slate-400'}`}>{form.specialNote.length} / 50</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5"><span className="flex items-center gap-1.5"><Upload size={12} /> Upload resume (optional)</span></label>
                                <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden"
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, resumeFile: e.target.files?.[0] ?? null }))} />
                                <button type="button" onClick={() => fileInputRef.current?.click()}
                                    className="w-full rounded-xl border border-slate-200 border-dashed px-4 py-3 text-sm text-slate-500 hover:border-[#456882] hover:bg-[#D9EAFD]/30 transition-colors flex items-center justify-center gap-2">
                                    <Upload size={18} />
                                    {form.resumeFile ? form.resumeFile.name : 'Choose file (PDF or DOC)'}
                                </button>
                            </div>

                            <div>
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input type="checkbox" checked={form.terms} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setForm(f => ({ ...f, terms: e.target.checked })); setErrors(er => ({ ...er, terms: '' })); }}
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
                        <SocialAuthBlock />
                        <p className="text-center text-slate-500 text-sm mt-4">
                            Already have an account? <button type="button" onClick={() => navigate('/login')} className="font-semibold hover:underline" style={{ color: '#234C6A' }}>Log in</button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
