import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Users, GraduationCap, Loader2 } from 'lucide-react';
import { callApi, getMe } from '../api/api';
import { showErrorAlert } from '../actions/alertActions';
import { useAppSelector } from '../store';
import { actionTypes } from '../actions/types';
import FormAlert from '../components/FormAlert';
import { useFormAlert } from '../hooks/useFormAlert';
import { refreshCsrfToken } from '../api/csrf';

export default function WLOAuthRolePicker() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { auth: { userDetails } } = useAppSelector((state) => state);
    const [bootstrapping, setBootstrapping] = useState(!userDetails?.email);
    const [submitting, setSubmitting] = useState(false);
    const {
        message: formBannerMessage,
        variant: formBannerVariant,
        setFormError,
        clearFormAlert,
    } = useFormAlert();

    const handleSessionAuthFailure = async (response?: { error?: string }) => {
        setFormError(
            response?.error || 'Session expired — please refresh the page and try again.',
        );
        await refreshCsrfToken();
    };

    useEffect(() => {
        if (userDetails?.email) {
            setBootstrapping(false);
            return;
        }
        let cancelled = false;
        (async () => {
            const response: any = await getMe(undefined, { logoutOnAuth: false });
            if (response?.me?.email) {
                localStorage.setItem('currentUser', JSON.stringify(response.me));
                dispatch({
                    type: actionTypes.authenticate,
                    payload: response.me,
                });
            }
            if (!cancelled) setBootstrapping(false);
        })();
        return () => { cancelled = true; };
    }, [dispatch, userDetails?.email]);

    useEffect(() => {
        if (!bootstrapping && !userDetails?.email) {
            navigate('/login?error=auth_failed', { replace: true });
        }
    }, [bootstrapping, userDetails?.email, navigate]);

    const chooseRole = async (role: 'customer' | 'expert') => {
        setSubmitting(true);
        clearFormAlert();
        try {
            const response = await callApi(
                'PUT',
                'auth/oauth-role',
                { role },
                undefined,
                { notify: false, logoutOnAuth: false },
            ) as any;
            if (response === false) {
                await handleSessionAuthFailure();
                return;
            }
            if (response?.status === 'FAIL') {
                setFormError(response.error || 'Could not save your role. Please try again.');
                return;
            }
            if (response.result || response.status === 'SUCCESS') {
                const updatedUser = response.result;
                if (updatedUser?.email) {
                    localStorage.setItem('currentUser', JSON.stringify(updatedUser));
                    dispatch({
                        type: actionTypes.authenticate,
                        payload: updatedUser,
                    });
                }
                navigate('/auth-complete-profile', { replace: true });
            } else {
                dispatch(showErrorAlert(response.error || 'Could not save your role. Please try again.'));
            }
        } catch (err: any) {
            dispatch(showErrorAlert(err?.message || 'Could not save your role. Please try again.'));
        }
        setSubmitting(false);
    };

    if (bootstrapping) {
        return (
            <div className="w-full min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-[#234C6A]" />
            </div>
        );
    }

    return (
        <div className="relative min-h-screen py-12 px-4 bg-slate-50">
            <div className="auth-dots-layer auth-dots-layer--animate absolute inset-0 pointer-events-none bg-[#F8FAFC]"
                style={{
                    backgroundImage: 'radial-gradient(circle, rgba(188,204,220,0.45) 1.8px, transparent 1.8px)',
                    backgroundSize: '28px 28px',
                }}
            />

            <div className="relative z-10 max-w-lg mx-auto pt-16">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-800 tracking-tight mb-3">
                        How do you want to join?
                    </h1>
                    <p className="text-slate-500 text-sm">
                        WeChat connected — choose whether you are joining as a student or an expert.
                    </p>
                </div>

                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-6 sm:p-8 border border-slate-100">
                    <FormAlert
                        variant={formBannerVariant}
                        message={formBannerMessage}
                        onDismiss={clearFormAlert}
                        className="mb-4"
                    />
                    <div className="grid sm:grid-cols-2 gap-4">
                        <button
                            type="button"
                            disabled={submitting}
                            onClick={() => chooseRole('expert')}
                            className="group p-6 rounded-2xl border-2 border-slate-200 bg-white hover:border-[#456882] hover:shadow-lg transition-all duration-300 text-left disabled:opacity-60"
                        >
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: '#D9EAFD' }}>
                                <Users size={24} className="text-[#234C6A]" />
                            </div>
                            <h3 className="font-bold text-slate-800 mb-1">Join as an expert</h3>
                            <p className="text-slate-500 text-xs">Share your expertise and mentor students globally</p>
                        </button>
                        <button
                            type="button"
                            disabled={submitting}
                            onClick={() => chooseRole('customer')}
                            className="group p-6 rounded-2xl border-2 border-slate-200 bg-white hover:border-[#456882] hover:shadow-lg transition-all duration-300 text-left disabled:opacity-60"
                        >
                            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mb-4 group-hover:bg-amber-200 transition-colors">
                                <GraduationCap size={24} className="text-amber-600" />
                            </div>
                            <h3 className="font-bold text-slate-800 mb-1">Join as a student</h3>
                            <p className="text-slate-500 text-xs">Get guidance on studies, work abroad, and research</p>
                        </button>
                    </div>
                    {submitting && (
                        <div className="flex items-center justify-center gap-2 mt-6 text-sm text-slate-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Saving your choice...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
