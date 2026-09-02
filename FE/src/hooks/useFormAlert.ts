import { useCallback, useState } from 'react';
import type { AlertVariant } from '../types/alert';

export function useFormAlert(initialVariant: AlertVariant = 'error') {
    const [message, setMessage] = useState('');
    const [variant, setVariant] = useState<AlertVariant>(initialVariant);

    const setFormError = useCallback((msg: string) => {
        setVariant('error');
        setMessage(msg);
    }, []);

    const setFormSuccess = useCallback((msg: string) => {
        setVariant('success');
        setMessage(msg);
    }, []);

    const setFormWarning = useCallback((msg: string) => {
        setVariant('warning');
        setMessage(msg);
    }, []);

    const setFormAlert = useCallback((msg: string, v: AlertVariant = 'error') => {
        setVariant(v);
        setMessage(msg);
    }, []);

    const clearFormAlert = useCallback(() => {
        setMessage('');
    }, []);

    return {
        message,
        variant,
        setFormError,
        setFormSuccess,
        setFormWarning,
        setFormAlert,
        clearFormAlert,
    };
}
