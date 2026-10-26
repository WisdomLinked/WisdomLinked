import { useState } from 'react';
import SignaturePad from './SignaturePad';
import TermsHtml from './TermsHtml';
import { acceptTerms, type TermsContract } from '../../api/termsApi';

const AUDIENCE_TITLE: Record<TermsContract['audience'], string> = {
    shared: 'Shared agreement',
    expert: 'Expert agreement',
    customer: 'Student agreement',
};

type Props = {
    contract: TermsContract;
    onAccepted: () => Promise<void> | void;
    /** When set, the parent stores the signature instead of posting it (signup). */
    onCollect?: (payload: {
        agreed: true;
        version: number;
        contentHash: string;
        typedName: string;
        signaturePng?: string;
    }) => Promise<void> | void;
};

export default function TermsSigner({ contract, onAccepted, onCollect }: Props) {
    const [agreed, setAgreed] = useState(false);
    const [typedName, setTypedName] = useState('');
    const [signaturePng, setSignaturePng] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        if (!agreed) {
            setError('Check I agree to continue.');
            return;
        }
        if (!typedName.trim() && !signaturePng) {
            setError('Enter your full legal name or draw your signature.');
            return;
        }
        setSaving(true);
        setError('');
        const payload = {
            agreed: true as const,
            audience: contract.audience,
            version: contract.version,
            contentHash: contract.contentHash,
            typedName: typedName.trim(),
            ...(signaturePng ? { signaturePng } : {}),
        };
        try {
            if (onCollect) await onCollect(payload);
            else await acceptTerms(payload);
            await onAccepted();
        } catch {
            setError('Could not save your signature. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Terms & Agreement</p>
            <h1 className="mt-1 font-serif text-2xl text-[#1A3A4A]">{AUDIENCE_TITLE[contract.audience]}</h1>
            <p className="mt-1 text-sm text-slate-500">Version {contract.version}. Sign this agreement to continue.</p>
            <div className="mt-4 max-h-[40vh] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
                <TermsHtml html={contract.html} />
            </div>
            <label className="mt-4 block text-sm font-medium text-slate-700">
                Full legal name
                <input
                    value={typedName}
                    onChange={(event) => setTypedName(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    autoComplete="name"
                />
            </label>
            <div className="mt-4">
                <p className="mb-1 text-sm font-medium text-slate-700">Draw your signature</p>
                <SignaturePad onChange={setSignaturePng} />
            </div>
            <label className="mt-4 flex items-start gap-3 text-sm text-slate-700">
                <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(event) => setAgreed(event.target.checked)}
                    className="mt-1"
                />
                <span>I agree to this agreement.</span>
            </label>
            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
            <button
                type="button"
                onClick={submit}
                disabled={saving}
                className="mt-4 rounded-xl bg-[#234C6A] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
                {saving ? 'Saving…' : 'Sign agreement'}
            </button>
        </div>
    );
}
