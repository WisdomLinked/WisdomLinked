import { useEffect, useState } from 'react';
import { getCurrentSharedTerms, type TermsContract } from '../../api/termsApi';
import SignaturePad from './SignaturePad';
import TermsHtml from './TermsHtml';

export function useSharedSignupContract() {
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);
    const [contract, setContract] = useState<TermsContract | null>(null);
    const [typedName, setTypedName] = useState('');
    const [signaturePng, setSignaturePng] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        getCurrentSharedTerms()
            .then((data) => {
                if (cancelled) return;
                setContract(data.published ? data : null);
                setLoaded(true);
            })
            .catch(() => {
                if (cancelled) return;
                setError(true);
                setLoaded(true);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const published = !!contract;

    const signatureError = () => {
        if (!published) return '';
        if (!typedName.trim() && !signaturePng) return 'Enter your full legal name or draw your signature.';
        return '';
    };

    const payload = () => {
        if (!contract) return null;
        return {
            agreed: true as const,
            version: contract.version,
            contentHash: contract.contentHash,
            typedName: typedName.trim(),
            ...(signaturePng ? { signaturePng } : {}),
        };
    };

    return {
        loaded,
        error,
        contract,
        published,
        typedName,
        setTypedName,
        signaturePng,
        setSignaturePng,
        signatureError,
        payload,
    };
}

export function SignupSignatureFields({
    typedName,
    onTypedName,
    signaturePng,
    onSignature,
}: {
    typedName: string;
    onTypedName: (value: string) => void;
    signaturePng?: string | null;
    onSignature: (value: string | null) => void;
}) {
    return (
        <div className="mt-3 space-y-3">
            <label className="block text-xs font-semibold text-slate-600">
                Full legal name
                <input
                    value={typedName}
                    onChange={(event) => onTypedName(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                    autoComplete="name"
                />
            </label>
            <div>
                <p className="mb-1 text-xs font-semibold text-slate-600">Draw your signature</p>
                <SignaturePad value={signaturePng} onChange={onSignature} />
            </div>
            <p className="text-xs text-slate-500">Enter your full legal name, draw your signature, or both.</p>
        </div>
    );
}

function LegacyTermsCopy() {
    return (
        <>
            <p className="font-semibold text-slate-700">Last Updated: March 15, 2026</p>
            <p>Welcome to WisdomLinked. By creating an account and using our services, you agree to the following terms and conditions. Please read them carefully.</p>
            <h4 className="font-semibold text-slate-800">1. Acceptance of Terms</h4>
            <p>By accessing or using WisdomLinked, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, you must not use our services.</p>
            <h4 className="font-semibold text-slate-800">2. User Accounts</h4>
            <p>You are responsible for maintaining the confidentiality of your account credentials. You agree to provide accurate, current, and complete information during registration and to update it as necessary.</p>
            <h4 className="font-semibold text-slate-800">3. Use of Services</h4>
            <p>You agree to use WisdomLinked only for lawful purposes and in compliance with all applicable laws and regulations. You shall not misuse, abuse, or attempt to gain unauthorized access to any part of the platform.</p>
            <h4 className="font-semibold text-slate-800">4. Intellectual Property</h4>
            <p>All content, trademarks, and intellectual property on WisdomLinked are owned by or licensed to us. You may not reproduce, modify, or distribute any content without prior written consent.</p>
            <h4 className="font-semibold text-slate-800">5. Privacy</h4>
            <p>Your privacy is important to us. Our collection and use of personal information is governed by our Privacy Policy, which is incorporated into these terms by reference.</p>
            <h4 className="font-semibold text-slate-800">6. Limitation of Liability</h4>
            <p>WisdomLinked shall not be held liable for any indirect, incidental, or consequential damages arising out of or related to your use of our platform.</p>
            <h4 className="font-semibold text-slate-800">7. Changes to Terms</h4>
            <p>We reserve the right to modify these terms at any time. Continued use of the platform after changes constitutes your acceptance of the updated terms.</p>
        </>
    );
}

export function SignupTermsModal({
    open,
    onClose,
    loaded,
    loadError,
    contract,
    typedName,
    onTypedName,
    signaturePng,
    onSignature,
    onAgree,
    signatureError,
}: {
    open: boolean;
    onClose: () => void;
    loaded: boolean;
    loadError: boolean;
    contract: TermsContract | null;
    typedName: string;
    onTypedName: (value: string) => void;
    signaturePng?: string | null;
    onSignature: (value: string | null) => void;
    onAgree: () => void;
    signatureError?: string;
}) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
            <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 shadow-2xl" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }} onClick={(event) => event.stopPropagation()}>
                <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #234C6A, #456882)' }} />
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                    <h3 className="font-display text-lg font-bold text-slate-800">Terms and Conditions</h3>
                    <button type="button" onClick={onClose} className="text-xl leading-none text-slate-400 hover:text-slate-600">&times;</button>
                </div>
                <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4 text-sm leading-relaxed text-slate-600">
                    {!loaded ? <p>Loading terms…</p> : null}
                    {loaded && loadError ? <p>Could not load the terms. Refresh and try again.</p> : null}
                    {loaded && !loadError && contract ? <TermsHtml html={contract.html} /> : null}
                    {loaded && !loadError && !contract ? <LegacyTermsCopy /> : null}
                    {contract ? (
                        <SignupSignatureFields typedName={typedName} onTypedName={onTypedName} signaturePng={signaturePng} onSignature={onSignature} />
                    ) : null}
                    {signatureError ? <p className="text-xs text-red-500">{signatureError}</p> : null}
                </div>
                <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
                    <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Close</button>
                    <button type="button" onClick={onAgree} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #234C6A 0%, #456882 100%)' }}>I Agree</button>
                </div>
            </div>
        </div>
    );
}
