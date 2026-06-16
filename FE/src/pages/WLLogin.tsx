import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Mail, Lock, AlertCircle, Eye, EyeOff, ArrowLeft, RefreshCw, ShieldCheck } from 'lucide-react';
import { login, confirmLoginByCode } from '../api/api';
import { showSuccessAlert } from '../actions/alertActions';
import FormAlert from '../components/FormAlert';
import { useFormAlert } from '../hooks/useFormAlert';
import { actionTypes } from '../actions/types';
import SocialAuthBlock from '../components/SocialAuthBlock';
import SignupModal from '../components/SignupModal';

const BTN_PRIMARY_STYLE = { background: 'linear-gradient(135deg, #234C6A 0%, #456882 100%)' };
const FOCUS_RING = 'focus:ring-2 focus:ring-[#234C6A]/60 focus:border-[#234C6A]';

export default function WLLogin() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const redirectPath = String(searchParams.get("redirect") || "").trim();
    const dispatch = useDispatch();
    const [oauthError, setOauthError] = useState<string | null>(null);
    const {
        message: authBannerMessage,
        variant: authBannerVariant,
        setFormError,
        setFormSuccess,
        clearFormAlert,
    } = useFormAlert();
    const [form, setForm] = useState({ email: '', password: '' });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // OTP state
    const [codeSent, setCodeSent] = useState(false);
    const [showSignupModal, setShowSignupModal] = useState(false);
    const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
    const [timeRemaining, setTimeRemaining] = useState(60);
    const [verifying, setVerifying] = useState(false);
    const [resending, setResending] = useState(false);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const inputBase = `w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-200 ${FOCUS_RING}`;
    const inputNormal = `${inputBase} border-slate-200`;
    const inputError = `${inputBase} border-red-300 focus:ring-red-300 focus:border-red-400 bg-red-50/30`;

    const validate = () => {
        const e: Record<string, string> = {};
        if (!form.email.trim()) e.email = 'Email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email';
        if (!form.password) e.password = 'Password is required';
        return e;
    };

    const handleSubmit = async () => {
        const e = validate();
        if (Object.keys(e).length > 0) { setErrors(e); return; }
        setSubmitting(true);
        clearFormAlert();
        try {
            const response = await login({ email: form.email, password: form.password }) as any;
            if (response === false) return;
            if (response?.status === 'SUCCESS') {
                setCodeSent(true);
                startTimer();
                // Focus first OTP input after transition
                setTimeout(() => inputRefs.current[0]?.focus(), 400);
            } else {
                setFormError(response.error || 'Invalid credentials. Please try again.');
            }
        } catch (err) {
            setFormError('Login failed. Please try again.');
        }
        setSubmitting(false);
    };

    // Timer
    const startTimer = () => {
        setTimeRemaining(60);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setTimeRemaining(prev => {
                if (prev <= 1) {
                    if (timerRef.current) clearInterval(timerRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    useEffect(() => {
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, []);

    // Parse OAuth errors from URL
    useEffect(() => {
        const err = searchParams.get('error');
        if (err) {
            setOauthError(err);
        }
    }, [searchParams]);

    // OTP input handling
    const handleOtpChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return; // digits only
        const newDigits = [...otpDigits];
        newDigits[index] = value.slice(-1); // only last digit
        setOtpDigits(newDigits);
        // Auto-advance to next input
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleOtpPaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (!paste) return;
        const newDigits = [...otpDigits];
        for (let i = 0; i < paste.length; i++) newDigits[i] = paste[i];
        setOtpDigits(newDigits);
        const focusIdx = Math.min(paste.length, 5);
        inputRefs.current[focusIdx]?.focus();
    };

    // Auto-verify when all 6 digits entered
    useEffect(() => {
        const code = otpDigits.join('');
        if (code.length === 6) {
            confirmCode(code);
        }
    }, [otpDigits]);

    const confirmCode = async (code: string) => {
        setVerifying(true);
        clearFormAlert();
        try {
            const response: any = await confirmLoginByCode({
                email: form.email,
                password: form.password,
                code
            });
            if (response === false) return;
            if (response?.status === 'SUCCESS') {
                localStorage.setItem('currentUser', JSON.stringify(response.userDetails));
                dispatch({ type: actionTypes.authenticate, payload: response.userDetails });
                dispatch(showSuccessAlert(`Hi, ${response.userDetails.username} 👋. Welcome back.`));
                if (redirectPath.startsWith("/")) {
                    navigate(redirectPath, {replace: true});
                    return;
                }
                // Navigate to the correct dashboard based on role
                const role = response.userDetails.role;
                if (role === 'customer') {
                    navigate('/user/studentdashboard',{replace: true});
                } else {
                    navigate('/user/' + role + 'dashboard',{replace: true});
                }
            } else {
                setFormError(response.error || 'Verification failed. Please try again.');
                setOtpDigits(['', '', '', '', '', '']);
                setTimeout(() => inputRefs.current[0]?.focus(), 100);
            }
        } catch {
            setFormError('Verification failed. Please try again.');
            setOtpDigits(['', '', '', '', '', '']);
        }
        setVerifying(false);
    };

    const handleResend = async () => {
        setResending(true);
        clearFormAlert();
        try {
            const response: any = await login({ email: form.email, password: form.password });
            if (response === false) return;
            if (response?.status === 'SUCCESS') {
                setFormSuccess('Verification code sent again.');
                setOtpDigits(['', '', '', '', '', '']);
                startTimer();
                setTimeout(() => inputRefs.current[0]?.focus(), 100);
            } else {
                setFormError(response.error || 'Failed to resend code.');
            }
        } catch {
            setFormError('Failed to resend code.');
        }
        setResending(false);
    };

    const handleBackToLogin = () => {
        setCodeSent(false);
        setOtpDigits(['', '', '', '', '', '']);
        clearFormAlert();
        if (timerRef.current) clearInterval(timerRef.current);
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
        .otp-box {
          width: 48px; height: 56px;
          text-align: center; font-size: 1.5rem; font-weight: 700;
          border-radius: 12px; border: 2px solid #e2e8f0;
          background: #fff; color: #1e293b;
          outline: none; transition: all 0.2s;
          caret-color: #234C6A;
        }
        .otp-box:focus { border-color: #234C6A; box-shadow: 0 0 0 3px rgba(35,76,106,0.15); }
        .otp-box.filled { border-color: #234C6A; background: #f0f7ff; }
        .card-flip { transition: opacity 0.3s ease, transform 0.3s ease; }
        .card-flip-enter { opacity: 0; transform: translateY(12px) scale(0.98); }
        .card-flip-active { opacity: 1; transform: translateY(0) scale(1); }
      `}</style>

            <div className="auth-dots-layer auth-dots-layer--animate" aria-hidden="true" />
            <div className="relative z-10 flex items-center justify-center p-6 min-h-screen">
                <div className="w-full max-w-md rounded-3xl border border-slate-200 shadow-xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }}>
                    <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #234C6A, #456882)' }} />
                    <div className="p-8">
                        {/* Logo */}
                        <div className="flex items-center justify-center gap-1.5 mb-6">
                            <img
                                src="/logos/main_gold_blue.svg"
                                alt="WisdomLinked"
                                className="h-10 w-auto max-w-[200px] object-contain shrink-0"
                            />
                            <span className="font-display font-bold text-[1.35rem] text-slate-900 tracking-normal">
                                WisdomLinked
                            </span>
                        </div>

                        <FormAlert
                            variant={authBannerVariant}
                            message={authBannerMessage}
                            onDismiss={clearFormAlert}
                        />

                        {!codeSent ? (
                            /* ── LOGIN FORM ── */
                            <div className="card-flip card-flip-active">
                                <h2 className="font-display text-2xl font-bold text-slate-800 mb-1">Welcome back</h2>
                                <p className="text-slate-500 text-sm mb-6">Sign in to your WisdomLinked account</p>
                                {oauthError === 'no_account' && (
                                    <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-start gap-2">
                                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                                        <span>No account found. Please <button type="button" onClick={() => navigate('/customerregister')} className="font-semibold underline">register</button> first.</span>
                                    </div>
                                )}
                                {oauthError === 'role_mismatch' && (
                                    <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2">
                                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                                        <span>
                                            {searchParams.get('existingRole') 
                                                ? `This email is already registered as a ${searchParams.get('existingRole')} account. Please log in to your existing account, or use a different email to register a new role.`
                                                : "An account already exists with a different role. Please log in with your existing role."}
                                        </span>
                                    </div>
                                )}
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1.5"><span className="flex items-center gap-1.5"><Mail size={12} /> Email</span></label>
                                        <input type="email" placeholder="you@example.com" value={form.email}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setForm(f => ({ ...f, email: e.target.value })); setErrors(er => ({ ...er, email: '' })); }}
                                            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleSubmit()}
                                            className={errors.email ? inputError : inputNormal} />
                                        {errors.email && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.email}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1.5"><span className="flex items-center gap-1.5"><Lock size={12} /> Password</span></label>
                                        <div className="relative">
                                            <input type={showPassword ? 'text' : 'password'} placeholder="Your password" value={form.password}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setForm(f => ({ ...f, password: e.target.value })); setErrors(er => ({ ...er, password: '' })); }}
                                                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleSubmit()}
                                                className={`${errors.password ? inputError : inputNormal} pr-10`} />
                                            <button type="button" onClick={(e) => { e.preventDefault(); setShowPassword(!showPassword); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 z-10" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
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
                                <SocialAuthBlock redirect={redirectPath.startsWith("/") ? redirectPath : undefined} />
                                <p className="text-center text-slate-500 text-sm mt-4">
                                    Don't have an account? <button type="button" onClick={() => setShowSignupModal(true)} className="font-semibold hover:underline" style={{ color: '#234C6A' }}>Sign up</button>
                                </p>
                                <button onClick={() => navigate('/')} className="mt-4 w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50">Back to Home</button>
                            </div>
                        ) : (
                            /* ── OTP VERIFICATION ── */
                            <div className="card-flip card-flip-active">
                                <button onClick={handleBackToLogin} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors">
                                    <ArrowLeft size={16} /> Back to login
                                </button>

                                <div className="flex items-center gap-3 mb-2">
                                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
                                        <ShieldCheck className="h-5 w-5 text-white" strokeWidth={2.2} />
                                    </div>
                                    <div>
                                        <h2 className="font-display text-xl font-bold text-slate-800">Verify your identity</h2>
                                    </div>
                                </div>
                                <p className="text-slate-500 text-sm mb-6">
                                    We sent a 6-digit code to <span className="font-semibold text-slate-700">{form.email}</span>
                                </p>

                                {/* OTP Inputs */}
                                <div className="flex justify-center gap-2.5 mb-4" onPaste={handleOtpPaste}>
                                    {otpDigits.map((digit, i) => (
                                        <input
                                            key={i}
                                            ref={el => { inputRefs.current[i] = el; }}
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={1}
                                            value={digit}
                                            onChange={e => handleOtpChange(i, e.target.value)}
                                            onKeyDown={e => handleOtpKeyDown(i, e)}
                                            className={`otp-box ${digit ? 'filled' : ''}`}
                                            disabled={verifying}
                                            autoComplete="one-time-code"
                                        />
                                    ))}
                                </div>

                                {/* Timer & Status */}
                                {verifying ? (
                                    <div className="flex items-center justify-center gap-2 py-3">
                                        <svg className="animate-spin h-4 w-4 text-[#234C6A]" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                        </svg>
                                        <span className="text-sm text-slate-600 font-medium">Verifying...</span>
                                    </div>
                                ) : timeRemaining > 0 ? (
                                    <p className="text-center text-sm text-slate-500 py-3">
                                        Code expires in <span className="font-semibold text-slate-700 tabular-nums">{timeRemaining}s</span>
                                    </p>
                                ) : (
                                    <div className="text-center py-3">
                                        <p className="text-sm text-amber-600 font-medium mb-1">Code expired</p>
                                    </div>
                                )}

                                {/* Resend */}
                                <button
                                    onClick={handleResend}
                                    disabled={resending || (timeRemaining > 0 && timeRemaining > 45)}
                                    className="mt-2 w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <RefreshCw size={14} className={resending ? 'animate-spin' : ''} />
                                    {resending ? 'Resending...' : 'Resend code'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {showSignupModal && (
                <SignupModal 
                    onClose={() => setShowSignupModal(false)} 
                    onGoLogin={() => setShowSignupModal(false)} 
                />
            )}
        </div>
    );
}
