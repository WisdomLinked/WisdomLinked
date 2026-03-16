import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
    User, Mail, Lock, Phone, AlertCircle, CheckCircle, ChevronDown,
    ArrowRight, Upload, BookOpen, Eye, EyeOff, Check, Search, Plus
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
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [majorSearch, setMajorSearch] = useState('');
    const [customMajors, setCustomMajors] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [confirmEmailSent, setConfirmEmailSent] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [showTermsModal, setShowTermsModal] = useState(false);

    const [showMajorDrop, setShowMajorDrop] = useState(false);
    const [showServicesDrop, setShowServicesDrop] = useState(false);
    const [showCountryDrop, setShowCountryDrop] = useState(false);
    const [showCodeDrop, setShowCodeDrop] = useState(false);

    const majorRef = useRef<HTMLDivElement>(null);
    const servicesRef = useRef<HTMLDivElement>(null);
    const countryRef = useRef<HTMLDivElement>(null);
    const codeRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Real-time field validation (same rules as customer form) ──
    const validateField = (field: string, value: any, currentForm = form) => {
        let error = '';
        switch (field) {
            case 'fullName': if (!value.trim()) error = 'Full name is required'; break;
            case 'title': if (!value.trim()) error = 'Title is required'; break;
            case 'bio':
                if (!value.trim()) error = 'Short description is required';
                else if (value.trim().length < 30) error = 'Please provide at least 30 characters';
                break;
            case 'email':
                if (!value.trim()) error = 'Email is required';
                else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) error = 'Enter a valid email address';
                break;
            case 'phone':
                if (!value.trim()) error = 'Phone number is required';
                else if (!/^\d{6,15}$/.test(value.replace(/\s/g, ''))) error = 'Enter a valid phone number (6-15 digits)';
                break;
            case 'password':
                if (!value) error = 'Password is required';
                else if (value.length < 8 || !/[A-Z]/.test(value) || !/[0-9]/.test(value) || !/[^A-Za-z0-9]/.test(value)) {
                    error = 'Password does not meet requirements';
                }
                break;
            case 'confirmPassword':
                if (value !== currentForm.password) error = 'Passwords do not match';
                break;
            case 'majors': if (value.length === 0) error = 'Select at least one major'; break;
            case 'servicesOffered': if (value.length === 0) error = 'Select at least one service'; break;
            case 'country': if (!value) error = 'Country is required'; break;
            case 'terms': if (!value) error = 'You must accept the terms and conditions'; break;
            case 'specialNote': if (value.trim().length > 50) error = 'Special note must be 50 characters or less'; break;
        }
        return error;
    };

    const handleBlur = (field: string) => {
        setTouched(prev => ({ ...prev, [field]: true }));
        setErrors(prev => ({ ...prev, [field]: validateField(field, form[field as keyof typeof form]) }));
    };

    const handleChange = (field: string, value: any) => {
        const newForm = { ...form, [field]: value };
        setForm(newForm);
        if (touched[field]) {
            setErrors(prev => ({ ...prev, [field]: validateField(field, value, newForm) }));
        }
        if (field === 'password' && touched.confirmPassword) {
            setErrors(prev => ({ ...prev, confirmPassword: validateField('confirmPassword', form.confirmPassword, newForm) }));
        }
    };

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (majorRef.current && !majorRef.current.contains(e.target as Node)) {
                if (showMajorDrop) handleBlur('majors');
                setShowMajorDrop(false);
            }
            if (servicesRef.current && !servicesRef.current.contains(e.target as Node)) {
                if (showServicesDrop) handleBlur('servicesOffered');
                setShowServicesDrop(false);
            }
            if (countryRef.current && !countryRef.current.contains(e.target as Node)) {
                if (showCountryDrop) handleBlur('country');
                setShowCountryDrop(false);
            }
            if (codeRef.current && !codeRef.current.contains(e.target as Node)) setShowCodeDrop(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showMajorDrop, showServicesDrop, showCountryDrop, form]);

    const toTitleCase = (str: string) => str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

    const toggleMajor = (m: string) => {
        const newMajors = form.majors.includes(m) ? form.majors.filter(x => x !== m) : [...form.majors, m];
        handleChange('majors', newMajors);
    };

    const handleAddCustomMajor = () => {
        if (!majorSearch.trim()) return;
        const formatted = toTitleCase(majorSearch.trim());
        if (!customMajors.includes(formatted) && !ENGINEERING_MAJORS.includes(formatted)) {
            setCustomMajors(prev => [...prev, formatted]);
        }
        toggleMajor(formatted);
        setMajorSearch('');
    };
    const toggleService = (s: string) => {
        const newServices = form.servicesOffered.includes(s) ? form.servicesOffered.filter(x => x !== s) : [...form.servicesOffered, s];
        handleChange('servicesOffered', newServices);
    };

    const validate = () => {
        const e: Record<string, string> = {};
        Object.keys(form).forEach(key => {
            if (key === 'resumeFile' || key === 'countryCode') return; // skip non-validated fields
            const err = validateField(key, form[key as keyof typeof form]);
            if (err) e[key] = err;
        });
        const allTouched = Object.keys(form).reduce((acc, key) => ({ ...acc, [key]: true }), {});
        setTouched(allTouched);
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
                description: form.bio,
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

    const PasswordRequirement = ({ met, text }: { met: boolean, text: string }) => (
        <div className={`flex items-center gap-1.5 text-xs ${met ? 'text-green-600' : 'text-slate-500'}`}>
            {met ? <Check size={12} strokeWidth={3} /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-300 ml-0.5" />}
            {text}
        </div>
    );

    const getPasswordStrength = () => {
        const { password } = form;
        let score = 0;
        if (password.length >= 8) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;
        return score;
    };
    const strengthScore = getPasswordStrength();

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
                            {/* Full Name */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5"><span className="flex items-center gap-1.5"><User size={12} /> Full name</span></label>
                                <input type="text" placeholder="e.g. Dr. Jane Smith" value={form.fullName}
                                    onChange={(e) => handleChange('fullName', e.target.value)}
                                    onBlur={() => handleBlur('fullName')}
                                    className={(touched.fullName && errors.fullName) ? inputError : inputNormal} />
                                {(touched.fullName && errors.fullName) && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.fullName}</p>}
                            </div>

                            {/* Title */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Title</label>
                                <input type="text" placeholder="e.g. Professor, Senior Engineer, Research Scientist" value={form.title}
                                    onChange={(e) => handleChange('title', e.target.value)}
                                    onBlur={() => handleBlur('title')}
                                    className={(touched.title && errors.title) ? inputError : inputNormal} />
                                {(touched.title && errors.title) && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.title}</p>}
                            </div>

                            {/* Bio */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Short description / bio</label>
                                <textarea rows={4} placeholder="Brief background, expertise areas, and what you can offer..." value={form.bio}
                                    onChange={(e) => handleChange('bio', e.target.value)}
                                    onBlur={() => handleBlur('bio')}
                                    className={`${(touched.bio && errors.bio) ? inputError : inputNormal} resize-none`} style={{ lineHeight: 1.5 }} />
                                <div className="flex justify-between mt-1"><span className="text-xs text-slate-400">Min. 30 characters</span>{(touched.bio && errors.bio) && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.bio}</p>}</div>
                            </div>

                            {/* Majors */}
                            <div ref={majorRef} className="relative">
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Major(s)</label>
                                <button type="button" onClick={() => setShowMajorDrop(v => !v)}
                                    className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm text-left ${(touched.majors && errors.majors) ? 'border-red-300 bg-red-50/30' : 'border-slate-200 bg-white'} ${FOCUS_RING} outline-none`}>
                                    <span className={form.majors.length ? 'text-slate-800' : 'text-slate-400'}>{form.majors.length ? form.majors.join(', ') : 'Select majors'}</span>
                                    <ChevronDown size={16} className={`text-slate-400 transition-transform ${showMajorDrop ? 'rotate-180' : ''}`} />
                                </button>
                                {showMajorDrop && (
                                    <div className="absolute z-50 mt-1 w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden flex flex-col">
                                        <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                                            <div className="relative">
                                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input type="text" placeholder="Search or add custom major" value={majorSearch}
                                                    onChange={(e) => setMajorSearch(e.target.value)}
                                                    onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); handleAddCustomMajor(); } }}
                                                    className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:border-[#234C6A] focus:ring-1 focus:ring-[#234C6A]" />
                                            </div>
                                        </div>
                                        <div className="max-h-56 overflow-y-auto">
                                            {[...ENGINEERING_MAJORS, ...customMajors].filter(m => m.toLowerCase().includes(majorSearch.toLowerCase())).map(m => (
                                                <button key={m} type="button" onClick={() => toggleMajor(m)}
                                                    className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors ${form.majors.includes(m) ? `${ACCENT_SELECTED} font-semibold` : `text-slate-700 ${ACCENT_BG}`}`}>
                                                    {form.majors.includes(m) && <CheckCircle size={14} style={{ color: '#234C6A' }} />}{m}
                                                </button>
                                            ))}
                                            {majorSearch.trim() && ![...ENGINEERING_MAJORS, ...customMajors].some(m => m.toLowerCase() === majorSearch.trim().toLowerCase()) && (
                                                <button type="button" onClick={handleAddCustomMajor}
                                                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left text-[#234C6A] font-medium hover:bg-[#D9EAFD]/40 transition-colors border-t border-slate-100">
                                                    <Plus size={14} /> Add "{toTitleCase(majorSearch.trim())}"
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {(touched.majors && errors.majors) && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.majors}</p>}
                            </div>

                            {/* Services */}
                            <div ref={servicesRef} className="relative">
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Services offered (select one or more)</label>
                                <button type="button" onClick={() => setShowServicesDrop(v => !v)}
                                    className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm text-left ${(touched.servicesOffered && errors.servicesOffered) ? 'border-red-300 bg-red-50/30' : 'border-slate-200 bg-white'} ${FOCUS_RING} outline-none`}>
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
                                {(touched.servicesOffered && errors.servicesOffered) && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.servicesOffered}</p>}
                            </div>

                            {/* Country */}
                            <div ref={countryRef} className="relative">
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Country</label>
                                <button type="button" onClick={() => setShowCountryDrop(v => !v)}
                                    className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm text-left ${(touched.country && errors.country) ? 'border-red-300 bg-red-50/30' : 'border-slate-200 bg-white'} ${FOCUS_RING} outline-none`}>
                                    <span className={form.country ? 'text-slate-800' : 'text-slate-400'}>{form.country || 'Select country'}</span>
                                    <ChevronDown size={16} className={`text-slate-400 transition-transform ${showCountryDrop ? 'rotate-180' : ''}`} />
                                </button>
                                {showCountryDrop && (
                                    <div className="absolute z-50 mt-1 w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-56 overflow-y-auto">
                                        {COUNTRIES.map(c => (
                                            <button key={c} type="button" onClick={() => { handleChange('country', c); setShowCountryDrop(false); }}
                                                className={`w-full px-4 py-2.5 text-sm text-left ${ACCENT_BG} transition-colors text-slate-700`}>{c}</button>
                                        ))}
                                    </div>
                                )}
                                {(touched.country && errors.country) && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.country}</p>}
                            </div>

                            {/* Phone */}
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
                                                    <button key={c.code + c.country} type="button" onClick={() => { handleChange('countryCode', c.code); setShowCodeDrop(false); }}
                                                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left ${form.countryCode === c.code ? `${ACCENT_SELECTED} font-semibold` : `text-slate-700 ${ACCENT_BG}`}`}>
                                                        <span>{c.flag}</span><span className="font-medium w-10">{c.code}</span><span className="text-slate-500 text-xs">{c.country}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <input type="tel" placeholder="Phone number" value={form.phone}
                                        onChange={(e) => handleChange('phone', e.target.value)}
                                        onBlur={() => handleBlur('phone')}
                                        className={`flex-1 ${(touched.phone && errors.phone) ? inputError : inputNormal}`} />
                                </div>
                                {(touched.phone && errors.phone) && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.phone}</p>}
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5"><span className="flex items-center gap-1.5"><Mail size={12} /> Email</span></label>
                                <input type="email" placeholder="you@example.com" value={form.email}
                                    onChange={(e) => handleChange('email', e.target.value)}
                                    onBlur={() => handleBlur('email')}
                                    className={(touched.email && errors.email) ? inputError : inputNormal} />
                                {(touched.email && errors.email) && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.email}</p>}
                            </div>

                            {/* Password with strength meter */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5"><span className="flex items-center gap-1.5"><Lock size={12} /> Password</span></label>
                                <div className="relative mb-3">
                                    <input type={showPassword ? 'text' : 'password'} placeholder="Min. 8 characters" value={form.password}
                                        onChange={(e) => handleChange('password', e.target.value)}
                                        onBlur={() => handleBlur('password')}
                                        className={`${(touched.password && errors.password) ? inputError : inputNormal} pr-10`} />
                                    <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {form.password && (
                                        <div className="flex gap-1 h-1.5 w-full">
                                            {[...Array(4)].map((_, i) => (
                                                <div 
                                                    key={i} 
                                                    className="flex-1 rounded-full transition-colors duration-300"
                                                    style={{ backgroundColor: i < strengthScore ? '#22c55e' : '#e2e8f0' }}
                                                />
                                            ))}
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-y-1.5">
                                        <PasswordRequirement met={form.password.length >= 8} text="8+ characters" />
                                        <PasswordRequirement met={/[A-Z]/.test(form.password)} text="Uppercase letter" />
                                        <PasswordRequirement met={/[0-9]/.test(form.password)} text="Number" />
                                        <PasswordRequirement met={/[^A-Za-z0-9]/.test(form.password)} text="Special character" />
                                    </div>
                                </div>
                            </div>

                            {/* Confirm Password */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Confirm password</label>
                                <div className="relative">
                                    <input type={showConfirmPassword ? 'text' : 'password'} placeholder="Re-enter password" value={form.confirmPassword}
                                        onChange={(e) => handleChange('confirmPassword', e.target.value)}
                                        onBlur={() => handleBlur('confirmPassword')}
                                        className={`${(touched.confirmPassword && errors.confirmPassword) ? inputError : inputNormal} pr-10`} />
                                    <button type="button" onClick={() => setShowConfirmPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}>
                                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                {(touched.confirmPassword && errors.confirmPassword) && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.confirmPassword}</p>}
                            </div>

                            {/* Special Note */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Special note</label>
                                <input type="text" placeholder="Optional, max 50 characters" value={form.specialNote} maxLength={50}
                                    onChange={(e) => handleChange('specialNote', e.target.value)}
                                    onBlur={() => handleBlur('specialNote')}
                                    className={(touched.specialNote && errors.specialNote) ? inputError : inputNormal} />
                                <div className="flex items-center justify-between mt-1">
                                    {(touched.specialNote && errors.specialNote) && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.specialNote}</p>}
                                    <span className={`text-xs ml-auto ${form.specialNote.length >= 50 ? 'text-amber-600' : 'text-slate-400'}`}>{form.specialNote.length} / 50</span>
                                </div>
                            </div>

                            {/* Resume Upload */}
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

                            {/* Terms */}
                            <div>
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input type="checkbox" checked={form.terms}
                                        onChange={(e) => { handleChange('terms', e.target.checked); handleBlur('terms'); }}
                                        className={`mt-1 w-4 h-4 rounded border-slate-300 text-[#234C6A] focus:ring-[#234C6A] ${(touched.terms && errors.terms) ? 'ring-2 ring-red-400 outline-none' : ''}`} />
                                    <span className="text-sm text-slate-600">I agree to the <button type="button" onClick={(e) => { e.preventDefault(); setShowTermsModal(true); }} className="text-[#234C6A] font-semibold hover:underline">Terms and Conditions</button></span>
                                </label>
                                {(touched.terms && errors.terms) && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.terms}</p>}
                            </div>
                        </div>

                        <button onClick={handleSubmit} disabled={submitting}
                            className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-semibold text-white shadow-lg transition-all duration-200 disabled:opacity-70"
                            style={submitting ? { background: '#9AA6B2' } : BTN_PRIMARY_STYLE}>
                            {submitting ? (<><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>Registering...</>) : 'Register'}
                        </button>
                        <SocialAuthBlock role="expert" />
                        <p className="text-center text-slate-500 text-sm mt-4">
                            Already have an account? <button type="button" onClick={() => navigate('/login')} className="font-semibold hover:underline" style={{ color: '#234C6A' }}>Log in</button>
                        </p>
                    </div>
                </div>
            </div>

            {/* Terms & Conditions Modal */}
            {showTermsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => setShowTermsModal(false)}>
                    <div className="w-full max-w-lg max-h-[80vh] rounded-2xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }} onClick={e => e.stopPropagation()}>
                        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #234C6A, #456882)' }} />
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-display text-lg font-bold text-slate-800">Terms and Conditions</h3>
                            <button type="button" onClick={() => setShowTermsModal(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
                        </div>
                        <div className="px-6 py-4 overflow-y-auto flex-1 text-sm text-slate-600 leading-relaxed space-y-4">
                            <p className="font-semibold text-slate-700">Last Updated: March 15, 2026</p>
                            <p>Welcome to WisdomLinked. By creating an account and using our services, you agree to the following terms and conditions. Please read them carefully.</p>
                            <h4 className="font-semibold text-slate-800">1. Acceptance of Terms</h4>
                            <p>By accessing or using WisdomLinked, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, you must not use our services.</p>
                            <h4 className="font-semibold text-slate-800">2. User Accounts</h4>
                            <p>You are responsible for maintaining the confidentiality of your account credentials. You agree to provide accurate, current, and complete information during registration and to update it as necessary.</p>
                            <h4 className="font-semibold text-slate-800">3. Use of Services</h4>
                            <p>You agree to use WisdomLinked only for lawful purposes and in compliance with all applicable laws and regulations. You shall not misuse, abuse, or attempt to gain unauthorized access to any part of the platform.</p>
                            <h4 className="font-semibold text-slate-800">4. Intellectual Property</h4>
                            <p>All content, trademarks, and intellectual property on WisdomLinked are owned by or licensed to us. You may not reproduce, modify, or distribute any content without prior written consent.</p>
                            <h4 className="font-semibold text-slate-800">5. Privacy</h4>
                            <p>Your privacy is important to us. Our collection and use of personal information is governed by our Privacy Policy, which is incorporated into these terms by reference.</p>
                            <h4 className="font-semibold text-slate-800">6. Limitation of Liability</h4>
                            <p>WisdomLinked shall not be held liable for any indirect, incidental, or consequential damages arising out of or related to your use of our platform.</p>
                            <h4 className="font-semibold text-slate-800">7. Changes to Terms</h4>
                            <p>We reserve the right to modify these terms at any time. Continued use of the platform after changes constitutes your acceptance of the updated terms.</p>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
                            <button type="button" onClick={() => setShowTermsModal(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Close</button>
                            <button type="button" onClick={() => { handleChange('terms', true); handleBlur('terms'); setShowTermsModal(false); }} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors" style={{ background: 'linear-gradient(135deg, #234C6A 0%, #456882 100%)' }}>I Agree</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
