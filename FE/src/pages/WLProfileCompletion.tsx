import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ChevronDown, Check, Loader2 } from 'lucide-react';
import { callApi } from '../api/api';
import { showErrorAlert, showSuccessAlert, showWarningAlert } from '../actions/alertActions';
import { useAppSelector } from '../store';
import { autoLogin } from '../actions/authActions';
import { SERVICE_LABELS } from '../constants/serviceOptions';

// Same majors / services as WLCustomerRegister & WLExpertRegister (regular sign-up)
const ENGINEERING_MAJORS = [
    'Aerospace Engineering', 'Biomedical Engineering', 'Chemical Engineering',
    'Civil Engineering', 'Computer Engineering', 'Electrical Engineering',
    'Environmental Engineering', 'Industrial Engineering', 'Mechanical Engineering',
    'Materials Science & Engineering', 'Nuclear Engineering', 'Petroleum Engineering',
    'Software Engineering', 'Systems Engineering', 'Other',
];

const FOCUS_RING = "focus:ring-2 focus:ring-[#234C6A]/20 focus:border-[#234C6A]";

export default function WLProfileCompletion() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { auth: { userDetails } } = useAppSelector((state) => state);
    
    // We expect the user to have been created by OAuth, so role should be present.
    const role = userDetails?.role || 'customer';
    const isExpert = role === 'expert';

    // WeChat-only accounts get a synthetic wechat_<id>@wechat.local placeholder email
    // (WeChat returns no email). Ask them to bind a real one here.
    const needsEmail = String(userDetails?.email || '').toLowerCase().endsWith('@wechat.local');

    const [form, setForm] = useState({
        email: '',                       // WeChat bind-email only
        majors: [] as string[],
        servicesOffered: [] as string[], // expert
        services: [] as string[],         // customer — same options as email/password sign-up
        title: '',                       // expert only
        bio: '',                         // expert only
        resumeFile: null as File | null, // expert only
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [submitting, setSubmitting] = useState(false);
    
    // Dropdown states
    const [showMajorDrop, setShowMajorDrop] = useState(false);
    const [showServiceDrop, setShowServiceDrop] = useState(false);
    const majorRef = useRef<HTMLDivElement>(null);
    const serviceRef = useRef<HTMLDivElement>(null);

    const [majorSearch, setMajorSearch] = useState('');
    const [customMajors, setCustomMajors] = useState<string[]>([]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (majorRef.current && !majorRef.current.contains(e.target as Node)) {
                if (showMajorDrop) handleBlur('majors');
                setShowMajorDrop(false);
            }
            if (serviceRef.current && !serviceRef.current.contains(e.target as Node)) {
                if (showServiceDrop) handleBlur(isExpert ? 'servicesOffered' : 'services');
                setShowServiceDrop(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showMajorDrop, showServiceDrop]);

    const toTitleCase = (str: string) => str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

    const validateField = (field: string, value: any) => {
        if (field === 'email') {
            if (!value.trim()) return 'Email is required';
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Enter a valid email address';
            return '';
        }
        if (field === 'majors') return value.length === 0 ? 'Select at least one major' : '';
        if (isExpert) {
            if (field === 'title') return !value.trim() ? 'Title is required' : '';
            if (field === 'bio') {
                if (!value.trim()) return 'Bio is required';
                if (value.trim().length < 50) return 'Bio must be at least 50 characters';
                return '';
            }
            if (field === 'servicesOffered') return value.length === 0 ? 'Select at least one service' : '';
        } else {
            if (field === 'services') return value.length === 0 ? 'Select at least one service' : '';
        }
        return '';
    };

    const handleBlur = (field: string) => {
        setTouched(prev => ({ ...prev, [field]: true }));
        setErrors(prev => ({ ...prev, [field]: validateField(field, form[field as keyof typeof form]) }));
    };

    const handleChange = (field: string, value: any) => {
        const newForm = { ...form, [field]: value };
        setForm(newForm);
        if (touched[field]) {
            setErrors(prev => ({ ...prev, [field]: validateField(field, value) }));
        }
    };

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

    const toggleExpertService = (s: string) => {
        const newServices = form.servicesOffered.includes(s) 
            ? form.servicesOffered.filter(x => x !== s) 
            : [...form.servicesOffered, s];
        handleChange('servicesOffered', newServices);
    };

    const toggleCustomerService = (s: string) => {
        const newServices = form.services.includes(s)
            ? form.services.filter(x => x !== s)
            : [...form.services, s];
        handleChange('services', newServices);
    };

    const validate = () => {
        const e: Record<string, string> = {};
        const fieldsToValidate = ['majors'];
        if (needsEmail) {
            fieldsToValidate.push('email');
        }
        if (isExpert) {
            fieldsToValidate.push('title', 'bio', 'servicesOffered');
        } else {
            fieldsToValidate.push('services');
        }

        fieldsToValidate.forEach(key => {
            const err = validateField(key, form[key as keyof typeof form]);
            if (err) e[key] = err;
        });
        
        const allTouched = fieldsToValidate.reduce((acc, key) => ({ ...acc, [key]: true }), {});
        setTouched(allTouched);
        return e;
    };

    const handleSubmit = async () => {
        const e = validate();
        if (Object.keys(e).length > 0) { 
            setErrors(e); 
            return; 
        }

        setSubmitting(true);
        try {
            const data = {
                keywords: form.majors,
                services: isExpert ? form.servicesOffered : form.services,
                ...(needsEmail && { email: form.email.trim().toLowerCase() }),
                ...(isExpert && {
                    title: form.title,
                    description: form.bio
                })
            };

            const response = await callApi('PUT', 'auth/profile', data, form.resumeFile || undefined) as any;

            if (response === false) return;
            if (response.result || response.status === 'SUCCESS' || response.success) {
                if (needsEmail && response.emailVerificationSent) {
                    dispatch(showSuccessAlert(
                        `We've sent a confirmation link to ${form.email.trim().toLowerCase()}. Click it to finish setting your email.`
                    ));
                }
                // Refresh user details
                await dispatch(autoLogin() as any);
                const dashboardPath = role === 'customer' ? '/user/studentdashboard' : `/user/${role}dashboard`;
                navigate(dashboardPath, { replace: true });
            } else {
                dispatch(showErrorAlert(response.error || 'Failed to update profile.'));
            }
        } catch (err: any) {
            dispatch(showErrorAlert(err?.message || 'Update failed. Please try again.'));
        }
        setSubmitting(false);
    };

    const inputBase = `w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-200 ${FOCUS_RING}`;
    const inputNormal = `${inputBase} border-slate-200`;
    const inputError = `${inputBase} border-red-300 focus:ring-red-300 focus:border-red-400 bg-red-50/30`;

    return (
        <div className="relative min-h-screen py-12 px-4 bg-slate-50">
            <style>{`
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rotate-180"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                Back to Home
            </button>

            <div className="relative z-10 max-w-2xl mx-auto pt-10">
                <div className="text-center mb-8">
                    <h1 className="text-3xl lg:text-4xl font-bold text-slate-800 tracking-tight mb-3">
                        Complete your profile
                    </h1>
                    <p className="text-slate-500 text-sm">
                        Just a few more details to set up your WisdomLinked {role} account.
                    </p>
                </div>

                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-6 sm:p-10 border border-slate-100">
                    <div className="space-y-6">

                        {needsEmail && (
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Email Address <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    placeholder="you@example.com"
                                    value={form.email}
                                    onChange={e => handleChange('email', e.target.value)}
                                    onBlur={() => handleBlur('email')}
                                    className={errors.email ? inputError : inputNormal}
                                />
                                {errors.email ? (
                                    <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.email}</p>
                                ) : (
                                    <p className="mt-1.5 text-xs text-slate-500">WeChat didn't share an email — add one so we can reach you. We'll send a link to confirm it's yours.</p>
                                )}
                            </div>
                        )}

                        {isExpert && (
                            <>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Professional Title <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Senior Software Engineer at Google"
                                        value={form.title}
                                        onChange={e => handleChange('title', e.target.value)}
                                        onBlur={() => handleBlur('title')}
                                        className={errors.title ? inputError : inputNormal}
                                    />
                                    {errors.title && <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.title}</p>}
                                </div>
                            </>
                        )}

                        {/* Majors (Both Roles) */}
                        <div ref={majorRef} className="relative z-20">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                {isExpert ? "Majors / Disciplines" : "Your Major"} <span className="text-red-500">*</span>
                            </label>
                            <div
                                onClick={() => setShowMajorDrop(!showMajorDrop)}
                                className={`cursor-pointer min-h-[48px] flex flex-wrap items-center gap-2 ${errors.majors ? inputError : inputNormal}`}
                            >
                                {form.majors.length === 0 ? (
                                    <span className="text-slate-400">Select major(s)</span>
                                ) : (
                                    form.majors.map(m => (
                                        <span key={m} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100">
                                            {m}
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); toggleMajor(m); }}
                                                className="hover:text-blue-900 focus:outline-none"
                                            >
                                                &times;
                                            </button>
                                        </span>
                                    ))
                                )}
                                <ChevronDown size={18} className="text-slate-400 ml-auto flex-shrink-0" />
                            </div>
                            {errors.majors && <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.majors}</p>}

                            {showMajorDrop && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50">
                                    <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                                        <input
                                            type="text"
                                            placeholder="Search or add custom major"
                                            value={majorSearch}
                                            onChange={e => setMajorSearch(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomMajor(); } }}
                                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300"
                                            onClick={e => e.stopPropagation()}
                                        />
                                        {majorSearch.trim() && !ENGINEERING_MAJORS.includes(toTitleCase(majorSearch)) && !customMajors.includes(toTitleCase(majorSearch)) && (
                                            <button
                                                type="button"
                                                onClick={handleAddCustomMajor}
                                                className="mt-2 w-full py-1.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded-lg hover:bg-blue-100 transition-colors"
                                            >
                                                + Add "{toTitleCase(majorSearch)}"
                                            </button>
                                        )}
                                    </div>
                                    <div className="max-h-60 overflow-y-auto p-1.5">
                                        {[...ENGINEERING_MAJORS, ...customMajors]
                                            .filter(m => m.toLowerCase().includes(majorSearch.toLowerCase()))
                                            .map(m => (
                                                <button
                                                    key={m}
                                                    type="button"
                                                    onClick={() => toggleMajor(m)}
                                                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-50 text-sm text-left transition-colors"
                                                >
                                                    <span className={form.majors.includes(m) ? "font-semibold text-slate-800" : "text-slate-600"}>{m}</span>
                                                    {form.majors.includes(m) && <Check size={16} className="text-blue-500" />}
                                                </button>
                                            ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Services */}
                        <div ref={serviceRef} className="relative z-10">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                {isExpert ? "Services Offered" : "What are you looking for?"} <span className="text-red-500">*</span>
                            </label>
                            
                            {isExpert ? (
                                // Expert Services Multi-select
                                <>
                                    <div
                                        onClick={() => setShowServiceDrop(!showServiceDrop)}
                                        className={`cursor-pointer min-h-[48px] flex flex-wrap items-center gap-2 ${errors.servicesOffered ? inputError : inputNormal}`}
                                    >
                                        {form.servicesOffered.length === 0 ? (
                                            <span className="text-slate-400">Select services you can provide</span>
                                        ) : (
                                            form.servicesOffered.map(s => (
                                                <span key={s} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 text-xs font-semibold border border-teal-100">
                                                    {s}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); toggleExpertService(s); }}
                                                        className="hover:text-teal-900 focus:outline-none"
                                                    >
                                                        &times;
                                                    </button>
                                                </span>
                                            ))
                                        )}
                                        <ChevronDown size={18} className="text-slate-400 ml-auto flex-shrink-0" />
                                    </div>
                                    {errors.servicesOffered && <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.servicesOffered}</p>}
                                    {showServiceDrop && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 p-1.5">
                                            {SERVICE_LABELS.map(s => (
                                                <button
                                                    key={s}
                                                    type="button"
                                                    onClick={() => toggleExpertService(s)}
                                                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-50 text-sm text-left transition-colors"
                                                >
                                                    <span className={form.servicesOffered.includes(s) ? "font-semibold text-slate-800" : "text-slate-600"}>{s}</span>
                                                    {form.servicesOffered.includes(s) && <Check size={16} className="text-teal-500" />}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                // Customer services — same options & multi-select behavior as WLCustomerRegister
                                <>
                                    <div
                                        onClick={() => setShowServiceDrop(!showServiceDrop)}
                                        className={`cursor-pointer min-h-[48px] flex flex-wrap items-center gap-2 ${errors.services ? inputError : inputNormal}`}
                                    >
                                        {form.services.length === 0 ? (
                                            <span className="text-slate-400">Select services</span>
                                        ) : (
                                            form.services.map(s => (
                                                <span key={s} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100">
                                                    {s}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); toggleCustomerService(s); }}
                                                        className="hover:text-blue-900 focus:outline-none"
                                                    >
                                                        &times;
                                                    </button>
                                                </span>
                                            ))
                                        )}
                                        <ChevronDown size={18} className="text-slate-400 ml-auto flex-shrink-0" />
                                    </div>
                                    {errors.services && <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.services}</p>}
                                    {showServiceDrop && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 p-1.5">
                                            {SERVICE_LABELS.map(s => (
                                                <button
                                                    key={s}
                                                    type="button"
                                                    onClick={() => toggleCustomerService(s)}
                                                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-50 text-sm text-left transition-colors"
                                                >
                                                    <span className={form.services.includes(s) ? "font-semibold text-slate-800" : "text-slate-600"}>{s}</span>
                                                    {form.services.includes(s) && <Check size={16} className="text-blue-500" />}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {isExpert && (
                            <>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Short Bio <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        placeholder="Tell students about your background, experience, and what you can help them with..."
                                        value={form.bio}
                                        onChange={e => handleChange('bio', e.target.value)}
                                        onBlur={() => handleBlur('bio')}
                                        rows={4}
                                        className={`${errors.bio ? inputError : inputNormal} resize-none`}
                                    />
                                    <div className="flex justify-between items-center mt-1.5">
                                        {errors.bio ? (
                                            <p className="text-xs text-red-500 font-medium">{errors.bio}</p>
                                        ) : (
                                            <p className="text-xs text-slate-500">Minimum 50 characters</p>
                                        )}
                                        <span className={`text-xs font-medium ${form.bio.length < 50 ? 'text-slate-400' : 'text-green-600'}`}>
                                            {form.bio.length} / 500
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Resume / CV</label>
                                    <div className="relative">
                                        <input
                                            type="file"
                                            accept=".pdf,.doc,.docx"
                                            onChange={e => {
                                                const file = e.target.files?.[0];
                                                if (file) handleChange('resumeFile', file);
                                            }}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                            aria-label="Upload resume"
                                        />
                                        <div className={`w-full rounded-xl border-2 border-dashed ${form.resumeFile ? 'border-blue-400 bg-blue-50/50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'} p-6 text-center transition-colors`}>
                                            <div className="flex flex-col items-center gap-2">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${form.resumeFile ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                                                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                                    </svg>
                                                </div>
                                                <div className="text-sm">
                                                    {form.resumeFile ? (
                                                        <span className="font-semibold text-blue-700">{form.resumeFile.name}</span>
                                                    ) : (
                                                        <>
                                                            <span className="font-semibold text-blue-600">Click to upload</span>
                                                            <span className="text-slate-500"> or drag and drop</span>
                                                        </>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-400">PDF, DOC, DOCX up to 10MB</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                        
                        <div className="pt-4 mt-8 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="w-full h-12 flex items-center justify-center gap-2 rounded-xl text-white font-semibold shadow-lg shadow-[#234C6A]/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100"
                                style={{ background: 'linear-gradient(135deg, #234C6A 0%, #456882 100%)' }}
                            >
                                {submitting ? <Loader2 size={18} className="animate-spin" /> : 'Complete Profile & Continue'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
