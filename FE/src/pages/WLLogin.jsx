import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Mail, Lock, AlertCircle, BookOpen } from 'lucide-react';
import { login } from '../api/api';
import { showAlert } from '../actions/alertActions';
import ConfirmCode from '../components/ConfirmCode';

const BTN_PRIMARY_STYLE = { background: 'linear-gradient(135deg, #234C6A 0%, #456882 100%)' };
const FOCUS_RING = 'focus:ring-2 focus:ring-[#234C6A]/60 focus:border-[#234C6A]';

export default function WLLogin() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [form, setForm] = useState({ email: '', password: '' });
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [codeSent, setCodeSent] = useState(false);

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

    const handleSubmit = async () => {
        const e = validate();
        if (Object.keys(e).length > 0) { setErrors(e); return; }
        setSubmitting(true);
        try {
            const response = await login({ email: form.email, password: form.password });
            if (response.status === 'SUCCESS') {
                setCodeSent(true);
            } else {
                dispatch(showAlert(response.error));
            }
        } catch (err) {
            dispatch(showAlert('Login failed. Please try again.'));
        }
        setSubmitting(false);
    };

    if (codeSent) {
        return <ConfirmCode email={form.email} password={form.password} />;
    }

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
                <div className="w-full max-w-md rounded-3xl border border-slate-200 shadow-xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }}>
                    <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #234C6A, #456882)' }} />
                    <div className="p-8">
                        {/* Logo */}
                        <div className="flex items-center gap-3 mb-6">
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#1B3C53] to-[#456882] flex items-center justify-center shadow-md">
                                <BookOpen className="h-5 w-5 text-white" strokeWidth={2.2} />
                            </div>
                            <div className="font-display font-bold text-xl text-slate-900">WisdomLinked</div>
                        </div>

                        <h2 className="font-display text-2xl font-bold text-slate-800 mb-1">Welcome back</h2>
                        <p className="text-slate-500 text-sm mb-6">Sign in to your WisdomLinked account</p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5"><span className="flex items-center gap-1.5"><Mail size={12} /> Email</span></label>
                                <input type="email" placeholder="you@example.com" value={form.email}
                                    onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setErrors(er => ({ ...er, email: '' })); }}
                                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                                    className={errors.email ? inputError : inputNormal} />
                                {errors.email && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.email}</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5"><span className="flex items-center gap-1.5"><Lock size={12} /> Password</span></label>
                                <input type="password" placeholder="Your password" value={form.password}
                                    onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setErrors(er => ({ ...er, password: '' })); }}
                                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                                    className={errors.password ? inputError : inputNormal} />
                                {errors.password && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.password}</p>}
                            </div>
                        </div>
                        <div className="flex justify-end mt-2">
                            <button type="button" onClick={() => navigate('/forgotpassword')} className="text-xs font-semibold hover:underline" style={{ color: '#234C6A' }}>Forgot password?</button>
                        </div>
                        <button onClick={handleSubmit} disabled={submitting}
                            className="mt-4 w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-semibold text-white shadow-lg transition-all duration-200 disabled:opacity-70"
                            style={submitting ? { background: '#9AA6B2' } : BTN_PRIMARY_STYLE}>
                            {submitting ? (<><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>Signing in...</>) : 'Sign in'}
                        </button>
                        <p className="text-center text-slate-500 text-sm mt-4">
                            Don't have an account? <button type="button" onClick={() => navigate('/customerregister')} className="font-semibold hover:underline" style={{ color: '#234C6A' }}>Sign up</button>
                        </p>
                        <button onClick={() => navigate('/')} className="mt-4 w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50">Back to Home</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
