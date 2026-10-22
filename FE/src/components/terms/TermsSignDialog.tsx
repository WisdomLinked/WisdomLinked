import { useEffect, useState } from 'react';
import {
    getCurrentTerms,
    getRequiredContracts,
    type TermsAudience,
    type TermsContract,
} from '../../api/termsApi';
import TermsSigner from './TermsSigner';

type Props = {
    open: boolean;
    role: Extract<TermsAudience, 'expert' | 'customer'>;
    onClose: () => void;
    onSigned?: () => void;
};

/** Same signer the dashboard gate uses, opened from a profile or setup row. */
export default function TermsSignDialog({ open, role, onClose, onSigned }: Props) {
    const [contract, setContract] = useState<TermsContract | null>(null);
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoading(true);
        setNote('');
        setContract(null);
        (async () => {
            try {
                const required = await getRequiredContracts();
                if (cancelled) return;
                const pending = required[0];
                if (pending) {
                    setContract(pending);
                    return;
                }
                const current = await getCurrentTerms(role);
                if (cancelled) return;
                if (current.published) {
                    setContract(current);
                    if (current.alreadySigned) setNote('You have signed this version.');
                } else {
                    setNote(role === 'expert'
                        ? 'No expert agreement has been published yet.'
                        : 'No student agreement has been published yet.');
                }
            } catch {
                if (!cancelled) setNote('Could not load this agreement.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, role]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label="Terms and agreement">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto">
                {loading ? <p className="rounded-2xl bg-white p-6 text-sm text-slate-600">Loading agreement…</p> : null}
                {!loading && contract ? (
                    <TermsSigner
                        contract={contract}
                        onAccepted={async () => {
                            onSigned?.();
                            onClose();
                        }}
                    />
                ) : null}
                {!loading && !contract ? <p className="rounded-2xl bg-white p-6 text-sm text-slate-700">{note}</p> : null}
                {note && contract ? <p className="mt-3 text-center text-sm text-white">{note}</p> : null}
                <div className="mt-3 text-center">
                    <button type="button" onClick={onClose} className="text-sm font-medium text-white underline">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
