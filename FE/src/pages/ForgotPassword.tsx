import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Mail, Lock, RefreshCw, AlertCircle, Eye, EyeOff, ArrowLeft, ArrowRight, ShieldCheck, CheckCircle } from 'lucide-react';
import { passwordResetRequest, verifyPasswordResetOTP, confirmPasswordResetByCode } from '../api/api';
import { showAlert } from '../actions/alertActions';

const BTN_PRIMARY_STYLE = { background: 'linear-gradient(135deg, #234C6A 0%, #456882 100%)' };
const FOCUS_RING = 'focus:ring-2 focus:ring-[#234C6A]/60 focus:border-[#234C6A]';

export default function ForgotPassword() {
    const navigate = useNavigate();
    const dispatch = useDispatch();

    // Step: 'email' | 'otp' | 'newPassword' | 'success'
    const [step, setStep] = useState<'email' | 'otp' | 'newPassword' | 'success'>('email');

    // Email step
    const [email, setEmail] = useState('');
    const [emailError, setEmailError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // OTP step
    const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
    const [timeRemaining, setTimeRemaining] = useState(60);
    const [verifying, setVerifying] = useState(false);
    const [resending, setResending] = useState(false);
    const [otpError, setOtpError] = useState('');
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const PasswordRequirement = ({ met, text }: { met: boolean, text: string }) => (
        <p className={`text-xs flex items-center gap-1 ${met ? 'text-green-600' : 'text-slate-400'}`}>
            <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${met ? 'bg-green-100' : 'bg-slate-100 text-slate-300'}`}>
                {met ? <CheckCircle size={10} /> : <div className="w-1 h-1 rounded-full bg-current" />}
            </span>
            {text}
        </p>
    );
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // New Password step
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [showConfirmPwd, setShowConfirmPwd] = useState(false);
    const [pwdError, setPwdError] = useState('');
    const [changingPwd, setChangingPwd] = useState(false);

    const inputBase = `w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-200 ${FOCUS_RING}`;
    const inputNormal = `${inputBase} border-slate-200`;
    const inputError = `${inputBase} border-red-300 focus:ring-red-300 focus:border-red-400 bg-red-50/30`;

    // ─── Timer ───
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

    // ─── Step 1: Send OTP to email ───
    const handleSendOTP = async () => {
        setEmailError('');
        if (!email.trim()) { setEmailError('Email is required'); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailError('Enter a valid email'); return; }

        setSubmitting(true);
        try {
            // Backend still expects a password at this stage. We send a temporary placeholder
            // and the actual password will be set after OTP verification.
            const response = await passwordResetRequest({ email, password: 'temp_placeholder_pwd' }) as any;
            if (response.status === 'SUCCESS') {
                setStep('otp');
                startTimer();
                setTimeout(() => inputRefs.current[0]?.focus(), 400);
            } else {
                setEmailError(response.error || 'Failed to send OTP. Please try again.');
            }
        } catch (err) {
            setEmailError('An error occurred. Please try again.');
        }
        setSubmitting(false);
    };

    // ─── Step 2: OTP handling ───
    const handleOtpChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;
        const newDigits = [...otpDigits];
        newDigits[index] = value.slice(-1);
        setOtpDigits(newDigits);
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
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasted.length === 6) {
            e.preventDefault();
            const newDigits = pasted.split('');
            setOtpDigits(newDigits);
            inputRefs.current[5]?.focus();
        }
    };

    // Auto-verify when all 6 digits entered
    useEffect(() => {
        const code = otpDigits.join('');
        if (code.length === 6 && step === 'otp') {
            verifyOTP(code);
        }
    }, [otpDigits]);

    const verifyOTP = async (code: string) => {
        setVerifying(true);
        setOtpError('');
        try {
            const response = await verifyPasswordResetOTP({ email, code }) as any;
            if (response.status === 'SUCCESS') {
                // OTP verified — move to new password step
                setStep('newPassword');
            } else {
                setOtpError(response.error || 'Invalid code. Please try again.');
                setOtpDigits(['', '', '', '', '', '']);
                setTimeout(() => inputRefs.current[0]?.focus(), 100);
            }
        } catch (err) {
            setOtpError('Verification failed. Please try again.');
        }
        setVerifying(false);
    };

    const handleResend = async () => {
        if (resending) return;
        setResending(true);
        setOtpError('');
        try {
            const response = await passwordResetRequest({ email, password: 'temp_placeholder_pwd' }) as any;
            if (response.status === 'SUCCESS') {
                dispatch(showAlert('A new OTP has been sent to your email.'));
                startTimer();
                setOtpDigits(['', '', '', '', '', '']);
                setTimeout(() => inputRefs.current[0]?.focus(), 100);
            } else {
                dispatch(showAlert(response.error || 'Failed to resend code.'));
            }
        } catch (err) {
            dispatch(showAlert('Failed to resend. Please try again.'));
        }
        setResending(false);
    };

    // ─── Step 3: Set new password ───
    const handleSetPassword = async () => {
        setPwdError('');
        if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
            setPwdError('Password does not meet strong requirements');
            return;
        }
        if (newPassword !== confirmPassword) { setPwdError('Passwords do not match'); return; }

        setChangingPwd(true);
        try {
            // Re-send the password reset request with the actual new password
            const reqResponse = await passwordResetRequest({ email, password: newPassword }) as any;
            if (reqResponse.status === 'SUCCESS') {
                // Auto-confirm with the same code since it was just verified
                const code = otpDigits.join('');
                const confirmResponse = await confirmPasswordResetByCode({ email, password: newPassword, code }) as any;
                if (confirmResponse.status === 'SUCCESS') {
                    setStep('success');
                } else {
                    setPwdError(confirmResponse.error || 'Failed to reset password. Please try again.');
                }
            } else {
                setPwdError(reqResponse.error || 'Failed to reset password.');
            }
        } catch (err) {
            setPwdError('An error occurred. Please try again.');
        }
        setChangingPwd(false);
    };

    return (
        <div className="min-h-screen py-12 px-4 flex items-center justify-center bg-slate-50 relative">
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

            <div className="relative z-10 w-full max-w-md bg-white p-8 rounded-3xl shadow-xl border border-slate-200 text-slate-800">
                {/* Logo */}
                <div className="flex items-center justify-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden">
                        <img src="/logo.png" className="w-8 h-8 object-contain" alt="WisdomLinked" />
                    </div>
                    <span className="font-black text-2xl tracking-[0.12em] uppercase text-slate-900">
                        WisdomLinked
                    </span>
                </div>

                {/* ═══ STEP 1: EMAIL ═══ */}
                {step === 'email' && (
                    <div>
                        <h2 className="font-display text-2xl font-bold text-slate-800 mb-1">Reset Password</h2>
                        <p className="text-slate-500 text-sm mb-6">Enter your email and we'll send you a verification code.</p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                                    <span className="flex items-center gap-1.5"><Mail size={12} /> Email</span>
                                </label>
                                <input
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setEmail(e.target.value); setEmailError(''); }}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendOTP()}
                                    className={emailError ? inputError : inputNormal}
                                />
                                {emailError && (
                                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                                        <AlertCircle size={12} /> {emailError}
                                    </p>
                                )}
                            </div>

                            <button
                                onClick={handleSendOTP}
                                disabled={submitting}
                                className="w-full py-3 rounded-xl text-white font-semibold text-sm shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-60"
                                style={BTN_PRIMARY_STYLE}
                            >
                                {submitting ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <RefreshCw size={16} className="animate-spin" /> Sending...
                                    </span>
                                ) : (
                                    <span className="flex items-center justify-center gap-2">
                                        Send Verification Code <ArrowRight size={16} />
                                    </span>
                                )}
                            </button>
                        </div>

                        <div className="mt-6 text-center text-sm text-slate-500">
                            Remember your password?{' '}
                            <button type="button" onClick={() => navigate('/login')} className="font-semibold hover:underline" style={{ color: '#234C6A' }}>
                                Log in
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══ STEP 2: OTP ═══ */}
                {step === 'otp' && (
                    <div className="text-center">
                        <div className="w-16 h-16 bg-blue-50 text-[#234C6A] rounded-full flex items-center justify-center mx-auto mb-4">
                            <ShieldCheck size={32} />
                        </div>
                        <h2 className="font-display text-2xl font-bold text-slate-800 mb-1">Verify Your Identity</h2>
                        <p className="text-slate-500 text-sm mb-6">
                            We've sent a 6-digit code to <strong className="text-slate-800">{email}</strong>
                        </p>

                        {/* OTP Inputs */}
                        <div className="flex justify-center gap-2.5 mb-4">
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
                                    onPaste={i === 0 ? handleOtpPaste : undefined}
                                    className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all duration-200 text-slate-900
                                        ${digit ? 'border-[#234C6A] bg-blue-50/50' : 'border-slate-200 bg-white'}
                                        focus:border-[#234C6A] focus:ring-2 focus:ring-[#234C6A]/30`}
                                    disabled={verifying}
                                />
                            ))}
                        </div>

                        {otpError && (
                            <p className="mb-3 text-xs text-red-500 flex items-center justify-center gap-1">
                                <AlertCircle size={12} /> {otpError}
                            </p>
                        )}

                        <div className="bg-amber-50 text-amber-700 p-3 rounded-lg text-xs leading-5 text-left mb-4 border border-amber-100 flex gap-2 items-start shadow-sm">
                            <ShieldCheck size={16} className="shrink-0 mt-0.5 text-amber-600" />
                            <p>
                                <strong>Security Notice:</strong> If the verification code does not match, the password will not be changed. You are allowed up to 50 failed attempts in 24 hours.
                            </p>
                        </div>

                        {verifying && (
                            <p className="text-sm text-[#234C6A] font-medium flex items-center justify-center gap-2 mb-4">
                                <RefreshCw size={14} className="animate-spin" /> Verifying...
                            </p>
                        )}

                        {/* Timer & Resend */}
                        <div className="mb-6">
                            {timeRemaining > 0 ? (
                                <p className="text-xs text-slate-400">
                                    Code expires in <span className="font-semibold text-slate-600">{timeRemaining}s</span>
                                </p>
                            ) : (
                                <p className="text-xs text-amber-600 font-medium">Code expired</p>
                            )}
                        </div>

                        <button
                            onClick={handleResend}
                            disabled={resending || (timeRemaining > 0 && timeRemaining < 55)}
                            className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                        >
                            {resending ? <RefreshCw size={14} className="animate-spin" /> : <Mail size={14} />}
                            {resending ? 'Sending...' : 'Resend Code'}
                        </button>

                        <button
                            onClick={() => { setStep('email'); setOtpDigits(['', '', '', '', '', '']); setOtpError(''); if (timerRef.current) clearInterval(timerRef.current); }}
                            className="mt-3 w-full py-2.5 text-sm text-slate-500 hover:text-slate-800 font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <ArrowLeft size={14} /> Change email
                        </button>
                    </div>
                )}

                {/* ═══ STEP 3: NEW PASSWORD ═══ */}
                {step === 'newPassword' && (
                    <div>
                        <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Lock size={32} />
                        </div>
                        <h2 className="font-display text-2xl font-bold text-slate-800 mb-1 text-center">Set New Password</h2>
                        <p className="text-slate-500 text-sm mb-6 text-center">Your identity has been verified. Enter your new password below.</p>

                        <div className="space-y-4">
                            <div className="relative">
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                                    <span className="flex items-center gap-1.5"><Lock size={12} /> New Password</span>
                                </label>
                                <input
                                    type={showPwd ? 'text' : 'password'}
                                    placeholder="Min. 8 characters"
                                    value={newPassword}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setNewPassword(e.target.value); setPwdError(''); }}
                                    className={inputNormal}
                                />
                                <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); setShowPwd(!showPwd); }}
                                    className="absolute right-3 top-[34px] text-slate-400 hover:text-slate-600 z-10"
                                >
                                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>

                            {newPassword && (
                                <div className="mt-2 space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                    <PasswordRequirement met={newPassword.length >= 8} text="8+ characters" />
                                    <PasswordRequirement met={/[A-Z]/.test(newPassword)} text="Uppercase letter" />
                                    <PasswordRequirement met={/[0-9]/.test(newPassword)} text="Number" />
                                    <PasswordRequirement met={/[^A-Za-z0-9]/.test(newPassword)} text="Special character" />
                                </div>
                            )}

                            <div className="relative">
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                                    <span className="flex items-center gap-1.5"><Lock size={12} /> Confirm Password</span>
                                </label>
                                <input
                                    type={showConfirmPwd ? 'text' : 'password'}
                                    placeholder="Repeat your new password"
                                    value={confirmPassword}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setConfirmPassword(e.target.value); setPwdError(''); }}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSetPassword()}
                                    className={inputNormal}
                                />
                                <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); setShowConfirmPwd(!showConfirmPwd); }}
                                    className="absolute right-3 top-[34px] text-slate-400 hover:text-slate-600 z-10"
                                >
                                    {showConfirmPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>

                            {pwdError && (
                                <p className="text-xs text-red-500 flex items-center gap-1">
                                    <AlertCircle size={12} /> {pwdError}
                                </p>
                            )}

                            <button
                                onClick={handleSetPassword}
                                disabled={changingPwd}
                                className="w-full py-3 rounded-xl text-white font-semibold text-sm shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-60"
                                style={BTN_PRIMARY_STYLE}
                            >
                                {changingPwd ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <RefreshCw size={16} className="animate-spin" /> Updating...
                                    </span>
                                ) : (
                                    'Reset Password'
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══ STEP 4: SUCCESS ═══ */}
                {step === 'success' && (
                    <div className="text-center">
                        <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle size={32} />
                        </div>
                        <h2 className="font-display text-2xl font-bold text-slate-800 mb-2">Password Reset!</h2>
                        <p className="text-slate-500 text-sm mb-8">
                            Your password has been successfully updated. You can now log in with your new password.
                        </p>
                        <button
                            onClick={() => navigate('/login')}
                            className="w-full py-3 rounded-xl text-white font-semibold text-sm shadow-lg hover:shadow-xl transition-all duration-200"
                            style={BTN_PRIMARY_STYLE}
                        >
                            <span className="flex items-center justify-center gap-2">
                                Go to Login <ArrowRight size={16} />
                            </span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}