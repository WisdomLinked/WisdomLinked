import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const SENTINEL_STATE = { wlDashboardBack: true };

export const useBackToDashboard = (
    activeItem: string,
    goToDashboard: () => void,
    dashboardItem = 'dashboard',
    onDashboardBack?: () => void,
): void => {
    const navigate = useNavigate();
    const activeRef = useRef(activeItem);
    activeRef.current = activeItem;
    const goToDashboardRef = useRef(goToDashboard);
    goToDashboardRef.current = goToDashboard;
    const onDashboardBackRef = useRef(onDashboardBack);
    onDashboardBackRef.current = onDashboardBack;
    const pushedRef = useRef(false);
    useEffect(() => {
        if (pushedRef.current) return;
        pushedRef.current = true;
        window.history.pushState(SENTINEL_STATE, '', window.location.href);
    }, []);

    useEffect(() => {
        const onPopState = () => {
            if (activeRef.current !== dashboardItem) {
                window.history.pushState(SENTINEL_STATE, '', window.location.href);
                goToDashboardRef.current();
                return;
            }
            if (onDashboardBackRef.current) {
                window.history.pushState(SENTINEL_STATE, '', window.location.href);
                onDashboardBackRef.current();
                return;
            }
            navigate('/login', { replace: true });
        };
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, [navigate, dashboardItem]);
};
