import { useEffect, useState } from 'react';
import {
    getCurrentTerms,
    getRequiredContracts,
    type TermsAudience,
    type TermsContract,
} from '../../api/termsApi';
import TermsHtml from './TermsHtml';
import TermsSigner from './TermsSigner';

type Props = {
    open: boolean;
    role: Extract<TermsAudience, 'expert' | 'customer'>;
    onClose: () => void;
    onSigned?: () => void;
};

type SignedReceipt = TermsContract & {
    signedAt?: string;
    typedName?: string;
    signaturePng?: string;
};

const AUDIENCE_TITLE: Record<TermsContract['audience'], string> = {
    shared: 'Shared agreement',
    expert: 'Expert agreement',
    customer: 'Student agreement',
};

function formatSignedAt(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

/** Read-only copy of a version this person already signed. */
function TermsSignedReceipt({ contract }: { contract: SignedReceipt }) {
    const signedAt = contract.signedAt ? formatSignedAt(contract.signedAt) : '';
    return (
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Terms & Agreement</p>
            <h1 className="mt-1 font-serif text-2xl text-[#1A3A4A]">{AUDIENCE_TITLE[contract.audience]}</h1>
            <p className="mt-1 text-sm text-slate-700">
                You signed version {contract.version}{signedAt ? ` on ${signedAt}` : ''}.
            </p>
            <div className="mt-4 max-h-[40vh] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
                <TermsHtml html={contract.html} />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-700">Full legal name</p>
            <p className="mt-1 text-sm text-slate-900">{contract.typedName || ''}</p>
            {contract.signaturePng ? (
                <div className="mt-4">
                    <p className="mb-1 text-sm font-medium text-slate-700">Signature</p>
                    <img
                        src={contract.signaturePng}
                        alt="Drawn signature"
                        className="max-h-28 max-w-full rounded-xl border border-slate-200 bg-white"
                    />
                </div>
            ) : null}
        </div>
    );
}

/** Same signer the dashboard gate uses, opened from a profile or setup row. */
export default function TermsSignDialog({ open, role, onClose, onSigned }: Props) {
    const [contract, setContract] = useState<TermsContract | null>(null);
    const [receipt, setReceipt] = useState<SignedReceipt | null>(null);
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoading(true);
        setNote('');
        setContract(null);
        setReceipt(null);
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
                if (current.published && current.alreadySigned) {
                    setReceipt(current);
                    return;
                }
                if (current.published) {
                    setContract(current);
                    return;
                }
                setNote(role === 'expert'
                    ? 'No expert agreement has been published yet.'
                    : 'No student agreement has been published yet.');
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
                {!loading && receipt ? <TermsSignedReceipt contract={receipt} /> : null}
                {!loading && !receipt && contract ? (
                    <TermsSigner
                        contract={contract}
                        onAccepted={async () => {
                            onSigned?.();
                            onClose();
                        }}
                    />
                ) : null}
                {!loading && !contract && !receipt ? <p className="rounded-2xl bg-white p-6 text-sm text-slate-700">{note}</p> : null}
                <div className="mt-3 text-center">
                    <button type="button" onClick={onClose} className="text-sm font-medium text-white underline">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
