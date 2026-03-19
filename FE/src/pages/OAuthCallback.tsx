import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { autoLogin } from '../actions/authActions';

export default function OAuthCallback() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const token = searchParams.get('token');
        const role = searchParams.get('role') || 'customer';
        
        if (!token) {
            navigate('/login?error=auth_failed', { replace: true });
            return;
        }

        const needsProfile = searchParams.get('needsProfile') === 'true';

        // Set the accessToken cookie on the frontend domain
        // (the backend cookie may not persist across redirect in some setups)
        document.cookie = `accessToken=${token}; path=/; max-age=86400`;

        localStorage.setItem('isLoginRemembered', 'true');
        localStorage.setItem('currentUser', JSON.stringify({ email: 'oauth-user' }));

        // Dispatch autoLogin which calls /auth/me using the cookie
        const doLogin = async () => {
            await dispatch(autoLogin() as any);
            dispatch({ type: 'SetLoadingStatus', payload: false });

            if (needsProfile) {
                navigate('/auth-complete-profile', { replace: true });
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
