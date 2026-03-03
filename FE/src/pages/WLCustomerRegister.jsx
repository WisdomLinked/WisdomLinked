import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
    User, Mail, Lock, Phone, AlertCircle, CheckCircle, ChevronDown,
    ArrowRight, GraduationCap, BookOpen
} from 'lucide-react';
import { callApi } from '../api/api';
import { showAlert } from '../actions/alertActions';
import ConfirmEmail from '../components/ConfirmEmail';

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

const STUDENT_SERVICES = ['Study abroad', 'Work abroad', 'Research guidance'];

const COUNTRIES = [
    'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France',
    'India', 'China', 'Japan', 'South Korea', 'Singapore', 'UAE', 'Brazil', 'Mexico',
    'Netherlands', 'Switzerland', 'Sweden', 'Italy', 'Spain', 'Pakistan', 'Nigeria',
    'Egypt', 'Kenya', 'South Africa', 'Argentina', 'Thailand', 'Malaysia', 'Other',
];

export default function WLCustomerRegister() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [form, setForm] = useState({
        fullName: '', majors: [], services: '', country: '', countryCode: '+1', phone: '', email: '', password: '', confirmPassword: '', terms: false
    });
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [confirmEmailSent, setConfirmEmailSent] = useState(false);
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

    const handleSubmit = async () => {
        const e = validate();
        if (Object.keys(e).length > 0) { setErrors(e); return; }
        setSubmitting(true);
        try {
            const data = {
                role: 'customer',
                username: form.fullName,
                keywords: form.majors,
                services: [form.services],
                state: '',
                country: form.country,
                city: '',
                phoneNumber: form.countryCode + form.phone,
                email: form.email,
                password: form.password
            };
            const response = await callApi('POST', 'auth/register', data);
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
            <div className="relative z-10 max-w-xl mx-auto">
                <button onClick={() => navigate('/')} className="flex items-center gap-2 text-slate-500 hover:text-[#234C6A] text-sm font-semibold mb-6">
                    <ArrowRight className="w-4 h-4 rotate-180" /> Back to Home
                </button>
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
                            {submitting ? (<><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>Creating account...</>) : 'Sign Up'}
                        </button>
                        <p className="text-center text-slate-500 text-sm mt-4">
                            Already have an account? <button type="button" onClick={() => navigate('/login')} className="font-semibold hover:underline" style={{ color: '#234C6A' }}>Log in</button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}