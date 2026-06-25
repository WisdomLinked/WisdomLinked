import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { getMe } from '../api/api';
import { actionTypes } from '../actions/types';

export default function OAuthCallback() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const token = searchParams.get('token');
        const role = searchParams.get('role') || 'customer';
        const redirect = String(searchParams.get('redirect') || '').trim();
        
        if (!token) {
            navigate('/login?error=auth_failed', { replace: true });
            return;
        }

        const needsProfile = searchParams.get('needsProfile') === 'true';
        const needsRole = searchParams.get('needsRole') === 'true';

        localStorage.setItem('isLoginRemembered', 'true');

        const doLogin = async () => {
            const response: any = await getMe(token, { logoutOnAuth: false });
            dispatch({ type: 'SetLoadingStatus', payload: false });

            if (!response?.me?.email) {
                navigate('/login?error=auth_failed', { replace: true });
                return;
            }

            localStorage.setItem('currentUser', JSON.stringify(response.me));
            dispatch({
                type: actionTypes.authenticate,
                payload: response.me,
            });

            if (needsRole) {
                navigate('/auth-choose-role', { replace: true });
            } else if (needsProfile) {
                navigate('/auth-complete-profile', { replace: true });
            } else if (redirect.startsWith('/')) {
                navigate(redirect, { replace: true });
            } else {
                const dashboardPath = role === 'customer' ? '/user/studentdashboard' : `/user/${role}dashboard`;
                navigate(dashboardPath, { replace: true });
            }
        };
        doLogin();
    }, []);

    return (
        <div className="w-full h-screen flex items-center justify-center bg-slate-900">
            <div className="flex flex-col items-center gap-4">
                <svg className="animate-spin h-8 w-8 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                <p className="text-white text-lg">Signing you in...</p>
            </div>
        </div>
    );
}
