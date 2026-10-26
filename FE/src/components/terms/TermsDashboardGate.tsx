import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { getRequiredContracts, type TermsContract } from '../../api/termsApi';
import TermsSigner from './TermsSigner';

/**
 * Replaces the student or expert dashboard until the current shared contract
 * and the role contract are signed. There is no dismiss.
 */
export default function TermsDashboardGate({ children }: { children: ReactNode }) {
    const [phase, setPhase] = useState<'loading' | 'open' | 'blocked' | 'error'>('loading');
    const [contracts, setContracts] = useState<TermsContract[]>([]);

    const load = useCallback(async () => {
        try {
            const next = await getRequiredContracts();
            setContracts(next);
            setPhase(next.length ? 'blocked' : 'open');
        } catch {
            setPhase('error');
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    if (phase === 'loading') {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#f8f7f4] text-sm text-slate-600">
                Checking your agreements…
            </div>
        );
    }

    if (phase === 'error') {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f8f7f4] px-6 text-center">
                <p className="text-sm text-slate-700">Could not check your agreements.</p>
                <button
                    type="button"
                    onClick={() => {
                        setPhase('loading');
                        void load();
                    }}
                    className="rounded-xl bg-[#234C6A] px-4 py-2 text-sm font-semibold text-white"
                >
                    Try again
                </button>
            </div>
        );
    }

    if (phase === 'blocked' && contracts[0]) {
        return (
            <div className="min-h-screen bg-[#f8f7f4] px-4 py-10">
                <TermsSigner contract={contracts[0]} onAccepted={load} />
            </div>
        );
    }

    return <>{children}</>;
}
