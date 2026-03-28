import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { CheckCircle, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { verifyRegistration } from '../api/api';
import { autoLogin } from '../actions/authActions';

const VerifyEmail = () => {
    const { email, confirmCode } = useParams<{ email: string; confirmCode: string }>();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [errorMsg, setErrorMsg] = useState('');
    const hasVerified = useRef(false);

    useEffect(() => {
        if (!email || !confirmCode || hasVerified.current) return;
        
        const verify = async () => {
            hasVerified.current = true;
            try {
                const response = await verifyRegistration({ email, confirmCode });
                if (response?.status === 'SUCCESS' && response.userDetails) {
                    setStatus('success');
                    dispatch(autoLogin() as any);
                    setTimeout(() => {
                        navigate(response.userDetails.role === 'customer' 
                            ? '/user/studentdashboard' 
                            : '/user/expertdashboard');
                    }, 2000);
                } else {
                    setStatus('error');
                    setErrorMsg(response?.error || 'Verification failed. The link might be expired or invalid.');
                }
            } catch (err: any) {
                setStatus('error');
                setErrorMsg('An unexpected error occurred during verification.');
            }
        };

        verify();
    }, [email, confirmCode, dispatch, navigate]);

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
            
            <div className="relative z-10 w-full max-w-md bg-white p-8 rounded-3xl shadow-xl border border-slate-200 text-center text-slate-800">
                {status === 'loading' && (
                    <div className="flex flex-col items-center">
                        <div className="w-16 h-16 bg-blue-50 text-[#234C6A] rounded-full flex items-center justify-center mb-6">
                            <Loader2 className="w-8 h-8 animate-spin" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Verifying your email</h2>
                        <p className="text-slate-600">Please wait while we log you in...</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="flex flex-col items-center">
                        <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-6">
                            <CheckCircle className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Verification Successful!</h2>
                        <p className="text-slate-600 mb-6">Your email has been verified. Redirecting you to your dashboard...</p>
                        <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full animate-[progress_2s_ease-in-out_forwards]" />
                        </div>
                        <style>{`@keyframes progress { 0% { width: 0% } 100% { width: 100% } }`}</style>
                    </div>
                )}

                {status === 'error' && (
                    <div className="flex flex-col items-center">
                        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6">
                            <AlertCircle className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Verification Failed</h2>
                        <p className="text-slate-600 mb-8">{errorMsg}</p>
                        <button 
                            onClick={() => navigate('/login')}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-100 text-slate-600 font-medium hover:bg-slate-200 transition-colors"
                        >
                            Return to Login <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VerifyEmail;