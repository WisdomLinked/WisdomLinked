import { apiClient } from './apiClient';
import { ensureCsrfToken } from './csrf';

export type TermsAudience = 'shared' | 'expert' | 'customer';

export type TermsContract = {
    audience: TermsAudience;
    version: number;
    html: string;
    contentHash: string;
    originalFilename?: string;
};

export type TermsVersionMeta = {
    audience: TermsAudience;
    version: number;
    contentHash: string;
    docxSha256?: string;
    originalFilename: string;
    notes?: string;
    publishedAt: string;
    publisherId?: string;
    publisherName?: string;
    /** Signers of this version who are still in its audience. */
    accepted?: number;
};

export type TermsOverview = {
    audience: TermsAudience;
    /** Accounts that must sign this contract (blocked accounts excluded). */
    audienceSize: number;
    versions: TermsVersionMeta[];
};

export type TermsAgreementPayload = {
    agreed: true;
    audience?: TermsAudience;
    version: number;
    contentHash: string;
    typedName?: string;
    signaturePng?: string;
};

export type TermsUserSignature = {
    audience: TermsAudience;
    /** Highest version of this contract the user has signed. */
    version: number;
    signedAt: string;
};

export type TermsUserHit = {
    id: string;
    email: string;
    username: string;
    name: string;
    role: string;
    status?: string;
    signatures?: TermsUserSignature[];
};

export type TermsAcceptanceRow = {
    userId: string;
    email?: string;
    username?: string;
    name?: string;
    role?: string;
    /** Account status now; empty when the account no longer exists. */
    status?: string;
    audience: TermsAudience;
    version: number;
    signedAt: string;
    ip: string;
    userAgent: string;
    contentHash: string;
    versionContentHash?: string;
    hashMatches?: boolean;
    typedName: string;
    signaturePng: string;
    originalFilename?: string;
};

async function csrfHeaders() {
    const token = await ensureCsrfToken();
    return token ? { 'X-CSRF-Token': token } : {};
}

export async function getCurrentSharedTerms(): Promise<{ published: false } | ({ published: true } & TermsContract)> {
    const res = await apiClient.get('terms/shared/current');
    return res.data;
}

export async function getRequiredContracts(): Promise<TermsContract[]> {
    const res = await apiClient.get('terms/required');
    return Array.isArray(res.data?.contracts) ? res.data.contracts : [];
}

export async function getCurrentTerms(audience: TermsAudience) {
    const res = await apiClient.get(`terms/current/${audience}`);
    return res.data as
        | { published: false; audience: TermsAudience }
        | ({
            published: true;
            alreadySigned: boolean;
            signedAt?: string;
            typedName?: string;
            signaturePng?: string;
        } & TermsContract);
}

export async function acceptTerms(payload: TermsAgreementPayload & { audience: TermsAudience }) {
    const res = await apiClient.post('terms/accept', payload, { headers: await csrfHeaders() });
    return res.data as { status: string; alreadyAccepted?: boolean };
}

export async function listTermsVersions(audience: TermsAudience): Promise<TermsVersionMeta[]> {
    const res = await apiClient.get(`admin/terms/${audience}/versions`);
    return Array.isArray(res.data?.versions) ? res.data.versions : [];
}

export async function getTermsOverview(audience: TermsAudience): Promise<TermsOverview> {
    const res = await apiClient.get(`admin/terms/${audience}/versions`);
    const audienceSize = Number(res.data?.audienceSize);
    return {
        audience,
        audienceSize: Number.isFinite(audienceSize) && audienceSize > 0 ? audienceSize : 0,
        versions: Array.isArray(res.data?.versions) ? res.data.versions : [],
    };
}

export async function previewTerms(audience: TermsAudience, file: File) {
    const form = new FormData();
    form.append('media', file);
    const res = await apiClient.post(`admin/terms/${audience}/preview`, form, { headers: await csrfHeaders() });
    return res.data as { html: string; contentHash: string };
}

export async function publishTerms(audience: TermsAudience, file: File, notes?: string) {
    const form = new FormData();
    if (notes) form.append('notes', notes);
    form.append('media', file);
    const res = await apiClient.post(`admin/terms/${audience}/publish`, form, { headers: await csrfHeaders() });
    return res.data as TermsVersionMeta & { html: string };
}

export async function getAdminTermsVersion(audience: TermsAudience, version: number) {
    const res = await apiClient.get(`admin/terms/${audience}/versions/${version}`);
    return res.data as TermsContract & { publishedAt?: string };
}

export async function downloadTermsDocx(audience: TermsAudience, version: number, filename?: string) {
    const res = await apiClient.get(`admin/terms/${audience}/versions/${version}/docx`, { responseType: 'blob' });
    const blob = res.data as Blob;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `terms-${audience}-v${version}.docx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

export async function listVersionSigners(audience: TermsAudience, version: number) {
    const res = await apiClient.get(`admin/terms/${audience}/versions/${version}/acceptances`);
    return (Array.isArray(res.data?.acceptances) ? res.data.acceptances : []) as TermsAcceptanceRow[];
}

export async function searchTermsUsers(query: string): Promise<TermsUserHit[]> {
    const res = await apiClient.get('admin/terms/search', { params: { q: query } });
    return Array.isArray(res.data?.users) ? res.data.users : [];
}

export async function getUserTermsAcceptances(userId: string): Promise<{ user: TermsUserHit; acceptances: TermsAcceptanceRow[] }> {
    const res = await apiClient.get(`admin/terms/users/${userId}/acceptances`);
    return {
        user: res.data?.user,
        acceptances: Array.isArray(res.data?.acceptances) ? res.data.acceptances : [],
    };
}
