import React, { useEffect, useState } from 'react';
import { Mail, ArrowRight, RefreshCw } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { callApi, checkVerificationStatus } from '../api/api';
import { showAlert } from '../actions/alertActions';
import { autoLogin } from '../actions/authActions';

interface ConfirmEmailProps {
    email: string;
}

const ConfirmEmail: React.FC<ConfirmEmailProps> = ({ email }) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [isResending, setIsResending] = useState(false);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        const checkStatus = async () => {
            const data = await checkVerificationStatus(email);
            if (data?.status === 'VERIFIED') {
                if (data.userDetails) {
                    dispatch(autoLogin() as any);
                    dispatch(showAlert('Verification successful! Logging you in...'));
                    setTimeout(() => {
                        navigate(data.userDetails.role === 'customer' 
                            ? '/user/customerdashboard' 
                            : '/user/expertdashboard');
                    }, 1000);
                }
            } else {
                timer = setTimeout(checkStatus, 3000);
            }
        };
        
        checkStatus();
        return () => clearTimeout(timer);
    }, [email, dispatch, navigate]);

    const handleResend = async () => {
        if (isResending) return;
        setIsResending(true);
        try {
            const response = await callApi('POST', 'auth/resendConfirmEmail', { email }) as any;
            if (response.status === 'SUCCESS') {
                dispatch(showAlert('A new verification link has been sent to your email.'));
            } else {
                dispatch(showAlert(response.error || 'Failed to resend the verification link.'));
            }
        } catch (error) {
            dispatch(showAlert('An error occurred while resending the email.'));
        }
        setIsResending(false);
    };

    return (
        <div className="min-h-screen py-12 px-4 flex items-center justify-center bg-slate-50 relative">
            <style>{`
            .auth-dots-layer {
                position: absolute; inset: 0; pointer-events: none; background-color: #F8FAFC;
                background-image: radial-gradient(circle, rgba(188,204,220,0.45) 1.8px, transparent 1.8px);
                background-size: 28px 28px;
            }
            `}</style>
            
            <div className="auth-dots-layer" aria-hidden="true" />
            
            <div className="relative z-10 w-full max-w-md bg-white p-8 rounded-3xl shadow-xl border border-slate-200 text-center text-slate-800">
                <div className="w-20 h-20 bg-blue-50 text-[#234C6A] rounded-full flex items-center justify-center mx-auto mb-6">
                    <Mail size={40} className="stroke-[#234C6A]" strokeWidth={2} />
                </div>
                
                <h2 className="text-2xl font-bold mb-3">Check your email</h2>
                <p className="text-slate-600 mb-8 leading-relaxed">
                    We've sent a magic link to <strong className="text-slate-900 font-semibold">{email}</strong>. 
                    <br/><br/>
                    Please click the link in that email to proceed. This page will automatically redirect once you are verified.
                </p>

                <div className="flex flex-col gap-4">
                    <button 
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-100 text-slate-600 font-medium hover:bg-slate-200 transition-colors"
                        onClick={handleResend}
                        disabled={isResending}
                    >
                        {isResending ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
                        {isResending ? 'Resending...' : 'Resend Magic Link'}
                    </button>
                    
                    <button 
                        className="w-full flex items-center justify-center gap-2 py-3 text-sm text-slate-500 hover:text-slate-800 font-medium transition-colors"
                        onClick={() => navigate('/login')}
                    >
                        Return to Login <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmEmail;