import { useEffect, useState } from 'react';
import {
    downloadTermsDocx,
    getAdminTermsVersion,
    getUserTermsAcceptances,
    listTermsVersions,
    listVersionSigners,
    previewTerms,
    publishTerms,
    searchTermsUsers,
    type TermsAcceptanceRow,
    type TermsAudience,
    type TermsUserHit,
    type TermsVersionMeta,
} from '../../../api/termsApi';
import TermsHtml from '../../../components/terms/TermsHtml';

const AUDIENCES: { id: TermsAudience; label: string; hint: string }[] = [
    { id: 'shared', label: 'Shared', hint: 'Signup contract for every student and expert' },
    { id: 'expert', label: 'Expert', hint: 'Expert-only contract' },
    { id: 'customer', label: 'Student', hint: 'Student-only contract' },
];

const AUDIENCE_LABEL: Record<TermsAudience, string> = {
    shared: 'Shared',
    expert: 'Expert',
    customer: 'Student',
};

function publishWarning(audience: TermsAudience) {
    if (audience === 'shared') {
        return 'Every student and expert will have to sign this new version before they can keep using WisdomLinked.';
    }
    if (audience === 'expert') {
        return 'Every expert will have to sign this new version before they can keep using WisdomLinked.';
    }
    return 'Every student will have to sign this new version before they can keep using WisdomLinked.';
}

function when(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value || '';
    return date.toLocaleString();
}

function apiError(err: unknown, fallback: string) {
    const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
    return message || fallback;
}

export default function TermsAgreementPage() {
    const [versions, setVersions] = useState<Record<TermsAudience, TermsVersionMeta[]>>({
        shared: [],
        expert: [],
        customer: [],
    });
    const [files, setFiles] = useState<Partial<Record<TermsAudience, File>>>({});
    const [previews, setPreviews] = useState<Partial<Record<TermsAudience, string>>>({});
    const [status, setStatus] = useState<Partial<Record<TermsAudience, string>>>({});
    const [publishing, setPublishing] = useState<TermsAudience | null>(null);
    const [confirmPublish, setConfirmPublish] = useState<TermsAudience | null>(null);
    const [htmlView, setHtmlView] = useState<{ title: string; html: string } | null>(null);
    const [signers, setSigners] = useState<{ title: string; rows: TermsAcceptanceRow[] } | null>(null);
    const [query, setQuery] = useState('');
    const [hits, setHits] = useState<TermsUserHit[]>([]);
    const [selected, setSelected] = useState<TermsUserHit | null>(null);
    const [acceptances, setAcceptances] = useState<TermsAcceptanceRow[]>([]);
    const [searchError, setSearchError] = useState('');
    const [opened, setOpened] = useState<TermsAcceptanceRow | null>(null);

    const loadAudience = async (audience: TermsAudience) => {
        const rows = await listTermsVersions(audience);
        setVersions((current) => ({ ...current, [audience]: rows }));
    };

    useEffect(() => {
        AUDIENCES.forEach((item) => {
            loadAudience(item.id).catch(() => {
                setStatus((current) => ({ ...current, [item.id]: 'Could not load versions.' }));
            });
        });
    }, []);

    const onFile = async (audience: TermsAudience, file: File | null) => {
        if (!file) return;
        setFiles((current) => ({ ...current, [audience]: file }));
        setStatus((current) => ({ ...current, [audience]: '' }));
        try {
            const preview = await previewTerms(audience, file);
            setPreviews((current) => ({ ...current, [audience]: preview.html }));
        } catch (err) {
            setPreviews((current) => ({ ...current, [audience]: '' }));
            setStatus((current) => ({ ...current, [audience]: apiError(err, 'Could not preview that document.') }));
        }
    };

    const onPublish = async (audience: TermsAudience) => {
        const file = files[audience];
        if (!file) {
            setStatus((current) => ({ ...current, [audience]: 'Choose a .docx file first.' }));
            return;
        }
        setPublishing(audience);
        try {
            const published = await publishTerms(audience, file);
            setPreviews((current) => ({ ...current, [audience]: published.html }));
            await loadAudience(audience);
            setStatus((current) => ({ ...current, [audience]: `Published version ${published.version}.` }));
        } catch (err) {
            setStatus((current) => ({ ...current, [audience]: apiError(err, 'Could not publish that document.') }));
        } finally {
            setPublishing(null);
        }
    };

    const openVersionHtml = async (audience: TermsAudience, version: number) => {
        const doc = await getAdminTermsVersion(audience, version);
        setHtmlView({ title: `${AUDIENCE_LABEL[audience]} version ${version}`, html: doc.html });
    };

    const openSigners = async (audience: TermsAudience, version: number) => {
        const rows = await listVersionSigners(audience, version);
        setSigners({ title: `Who signed ${AUDIENCE_LABEL[audience]} version ${version}`, rows });
    };

    const runSearch = async () => {
        setSearchError('');
        setSelected(null);
        setAcceptances([]);
        try {
            setHits(await searchTermsUsers(query));
        } catch (err) {
            setHits([]);
            setSearchError(apiError(err, 'Search failed.'));
        }
    };

    const chooseUser = async (user: TermsUserHit) => {
        setSelected(user);
        setOpened(null);
        const result = await getUserTermsAcceptances(user.id);
        setAcceptances(result.acceptances);
    };

    const openAcceptance = async (row: TermsAcceptanceRow) => {
        setOpened(row);
        try {
            const doc = await getAdminTermsVersion(row.audience, row.version);
            setHtmlView({ title: `${AUDIENCE_LABEL[row.audience]} version ${row.version}`, html: doc.html });
        } catch {
            setHtmlView({ title: 'Agreement', html: '<p>Could not load the signed agreement.</p>' });
        }
    };

    return (
        <div className="space-y-8 p-6">
            <div>
                <h2 className="text-xl font-semibold text-[#1A3A4A]">Terms & Agreement</h2>
                <p className="mt-1 max-w-3xl text-sm text-slate-600">
                    Upload a .docx to publish the next version. Older versions and signatures stay on record. Only the latest version is what new signatures must match.
                </p>
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
                {AUDIENCES.map((item) => (
                    <section key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label={`${item.label} contract`}>
                        <h3 className="text-lg font-semibold text-[#1A3A4A]">{item.label}</h3>
                        <p className="mt-1 text-sm text-slate-500">{item.hint}</p>
                        <label className="mt-4 block text-sm font-medium text-slate-700">
                            Upload {item.label} agreement (.docx)
                            <input
                                type="file"
                                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                aria-label={`Upload ${item.label} agreement`}
                                className="mt-1 block w-full text-sm"
                                onChange={(event) => {
                                    const file = event.target.files?.[0] || null;
                                    void onFile(item.id, file);
                                }}
                            />
                        </label>
                        {previews[item.id] ? (
                            <div className="mt-3 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <TermsHtml html={previews[item.id] || ''} />
                            </div>
                        ) : null}
                        <button
                            type="button"
                            onClick={() => setConfirmPublish(item.id)}
                            disabled={publishing === item.id || !files[item.id]}
                            className="mt-3 rounded-xl bg-[#234C6A] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        >
                            {publishing === item.id ? 'Publishing…' : `Publish ${item.label}`}
                        </button>
                        {status[item.id] ? <p className="mt-2 text-sm text-slate-600">{status[item.id]}</p> : null}
                        <h4 className="mt-4 text-sm font-semibold text-slate-800">Version history</h4>
                        <ul className="mt-2 space-y-2">
                            {versions[item.id].length === 0 ? <li className="text-sm text-slate-500">No version published yet.</li> : null}
                            {versions[item.id].map((row) => (
                                <li key={`${item.id}-${row.version}`} className="rounded-xl border border-slate-100 px-3 py-2 text-sm">
                                    <p className="font-medium text-slate-800">Version {row.version}</p>
                                    <p className="text-slate-500">{when(row.publishedAt)} · {row.publisherName || 'Admin'}</p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        <button type="button" className="text-[#234C6A] underline" onClick={() => void openVersionHtml(item.id, row.version)}>Open HTML</button>
                                        <button type="button" className="text-[#234C6A] underline" onClick={() => void downloadTermsDocx(item.id, row.version, row.originalFilename)}>Download docx</button>
                                        <button type="button" className="text-[#234C6A] underline" onClick={() => void openSigners(item.id, row.version)}>Who signed</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-lg font-semibold text-[#1A3A4A]">Find a signature</h3>
                <p className="mt-1 text-sm text-slate-500">Search by username, email, or name.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        aria-label="Search accounts"
                        placeholder="Username, email, or name"
                        className="w-full max-w-md rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                    <button type="button" onClick={() => void runSearch()} className="rounded-xl bg-[#234C6A] px-4 py-2 text-sm font-semibold text-white">
                        Search
                    </button>
                </div>
                {searchError ? <p className="mt-2 text-sm text-red-600">{searchError}</p> : null}
                <ul className="mt-3 space-y-2">
                    {hits.map((user) => (
                        <li key={user.id}>
                            <button type="button" onClick={() => void chooseUser(user)} className="text-left text-sm text-[#234C6A] underline">
                                {user.name || user.username || user.email} · {user.email} · {user.username}
                            </button>
                        </li>
                    ))}
                </ul>
                {selected ? (
                    <div className="mt-4 overflow-x-auto">
                        <h4 className="text-sm font-semibold text-slate-800">Signatures for {selected.name || selected.username || selected.email}</h4>
                        {acceptances.length === 0 ? <p className="mt-2 text-sm text-slate-500">No signatures stored.</p> : null}
                        <table className="mt-2 w-full min-w-[720px] text-left text-sm">
                            <thead>
                                <tr className="text-slate-500">
                                    <th className="py-1 pr-3">Audience</th>
                                    <th className="py-1 pr-3">Version</th>
                                    <th className="py-1 pr-3">Time</th>
                                    <th className="py-1 pr-3">IP</th>
                                    <th className="py-1 pr-3">User agent</th>
                                    <th className="py-1 pr-3">Account</th>
                                    <th className="py-1 pr-3">Content hash</th>
                                    <th className="py-1 pr-3">Typed name</th>
                                </tr>
                            </thead>
                            <tbody>
                                {acceptances.map((row) => (
                                    <tr key={`${row.audience}-${row.version}-${row.signedAt}`} className="border-t border-slate-100">
                                        <td className="py-2 pr-3">{AUDIENCE_LABEL[row.audience] || row.audience}</td>
                                        <td className="py-2 pr-3">{row.version}</td>
                                        <td className="py-2 pr-3">{when(row.signedAt)}</td>
                                        <td className="py-2 pr-3">{row.ip}</td>
                                        <td className="py-2 pr-3">{row.userAgent}</td>
                                        <td className="py-2 pr-3">{row.userId}</td>
                                        <td className="py-2 pr-3 font-mono text-xs">{row.contentHash}</td>
                                        <td className="py-2 pr-3">
                                            <button type="button" className="text-[#234C6A] underline" onClick={() => void openAcceptance(row)}>
                                                {row.typedName || 'Open signature'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : null}
            </section>

            {htmlView ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-label={htmlView.title}>
                    <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5">
                        <div className="flex items-start justify-between gap-3">
                            <h3 className="text-lg font-semibold text-[#1A3A4A]">{htmlView.title}</h3>
                            <button type="button" onClick={() => { setHtmlView(null); setOpened(null); }} className="text-sm text-[#234C6A] underline">Close</button>
                        </div>
                        <div className="mt-3">
                            <TermsHtml html={htmlView.html} />
                        </div>
                        {opened?.signaturePng ? (
                            <img src={opened.signaturePng} alt="Drawn signature" className="mt-4 max-h-40 rounded border border-slate-200 bg-white" />
                        ) : null}
                        {opened ? (
                            <button
                                type="button"
                                className="mt-4 text-sm text-[#234C6A] underline"
                                onClick={() => void downloadTermsDocx(opened.audience, opened.version, opened.originalFilename)}
                            >
                                Download docx
                            </button>
                        ) : null}
                    </div>
                </div>
            ) : null}

            {confirmPublish ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-label="Confirm publish">
                    <div className="w-full max-w-md rounded-2xl bg-white p-5">
                        <h3 className="text-lg font-semibold text-[#1A3A4A]">Publish {AUDIENCE_LABEL[confirmPublish]} agreement?</h3>
                        <p className="mt-2 text-sm text-slate-600">{publishWarning(confirmPublish)} This cannot be undone. The previous version stays on file.</p>
                        <div className="mt-4 flex justify-end gap-2">
                            <button type="button" onClick={() => setConfirmPublish(null)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const audience = confirmPublish;
                                    setConfirmPublish(null);
                                    void onPublish(audience);
                                }}
                                className="rounded-xl bg-[#234C6A] px-3 py-2 text-sm font-semibold text-white"
                            >
                                Publish and require signatures
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {signers ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-label={signers.title}>
                    <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5">
                        <div className="flex items-start justify-between gap-3">
                            <h3 className="text-lg font-semibold text-[#1A3A4A]">{signers.title}</h3>
                            <button type="button" onClick={() => setSigners(null)} className="text-sm text-[#234C6A] underline">Close</button>
                        </div>
                        {signers.rows.length === 0 ? <p className="mt-3 text-sm text-slate-500">Nobody has signed this version.</p> : null}
                        <ul className="mt-3 space-y-2 text-sm">
                            {signers.rows.map((row) => (
                                <li key={`${row.userId}-${row.signedAt}`} className="rounded-xl border border-slate-100 px-3 py-2">
                                    <p>{row.typedName || row.username || row.email || row.userId}</p>
                                    <p className="text-slate-500">{when(row.signedAt)} · {row.ip} · {row.userId}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
