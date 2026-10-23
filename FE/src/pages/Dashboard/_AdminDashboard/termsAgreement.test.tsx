import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TermsAgreementPage from './termsAgreement';

const state = vi.hoisted(() => ({
    versions: {
        shared: [
            {
                audience: 'shared' as const,
                version: 1,
                publishedAt: '2026-01-01T00:00:00.000Z',
                publisherName: 'Admin',
                originalFilename: 'shared-v1.docx',
                contentHash: 'h1',
            },
        ],
        expert: [] as any[],
        customer: [] as any[],
    },
}));

vi.mock('../../../api/termsApi', () => ({
    listTermsVersions: async (audience: 'shared' | 'expert' | 'customer') => state.versions[audience],
    previewTerms: async () => ({ html: '<p>Preview text</p>', contentHash: 'preview' }),
    publishTerms: async (audience: 'shared' | 'expert' | 'customer') => {
        const next = state.versions[audience].length + 1;
        const row = {
            audience,
            version: next,
            publishedAt: '2026-03-01T00:00:00.000Z',
            publisherName: 'Admin',
            originalFilename: `v${next}.docx`,
            contentHash: `h${next}`,
            html: `<p>Version ${next}</p>`,
        };
        state.versions[audience] = [...state.versions[audience], row];
        return row;
    },
    searchTermsUsers: async () => ([
        { id: 'u1', email: 'ada@example.com', username: 'ada', name: 'Ada Lovelace', role: 'customer' },
    ]),
    getUserTermsAcceptances: async () => ({
        user: { id: 'u1', email: 'ada@example.com', username: 'ada', name: 'Ada Lovelace', role: 'customer' },
        acceptances: [
            {
                userId: 'u1',
                email: 'ada@example.com',
                username: 'ada',
                name: 'Ada Lovelace',
                audience: 'shared',
                version: 1,
                signedAt: '2026-02-01T00:00:00.000Z',
                ip: '203.0.113.8',
                userAgent: 'TestBrowser',
                contentHash: 'h1',
                typedName: 'Ada Lovelace',
                signaturePng: '',
            },
        ],
    }),
    getAdminTermsVersion: async () => ({ html: '<p>Signed html</p>', contentHash: 'h1', version: 1, audience: 'shared' }),
    downloadTermsDocx: async () => {},
    listVersionSigners: async () => [],
}));

describe('Terms & Agreement admin page', () => {
    beforeEach(() => {
        state.versions.shared = [
            {
                audience: 'shared',
                version: 1,
                publishedAt: '2026-01-01T00:00:00.000Z',
                publisherName: 'Admin',
                originalFilename: 'shared-v1.docx',
                contentHash: 'h1',
            },
        ];
        state.versions.expert = [];
        state.versions.customer = [];
    });

    it('lists the three contract audiences', async () => {
        render(<TermsAgreementPage />);
        expect(await screen.findByRole('region', { name: 'Shared contract' })).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Expert contract' })).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Student contract' })).toBeInTheDocument();
    });

    it('keeps the older version listed after a second publish', async () => {
        const user = userEvent.setup();
        render(<TermsAgreementPage />);
        expect(await screen.findByText('Version 1')).toBeInTheDocument();

        const input = screen.getByLabelText('Upload Shared agreement');
        const file = new File(['docx'], 'shared-v2.docx', {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        await user.upload(input, file);
        expect(await screen.findByText('Preview text')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Publish Shared' }));
        expect(screen.getByRole('dialog', { name: 'Confirm publish' })).toHaveTextContent('sign this new version');
        await user.click(screen.getByRole('button', { name: 'Publish and require signatures' }));
        expect(await screen.findAllByText('Version 2')).not.toHaveLength(0);
        expect(screen.getAllByText('Version 1').length).toBeGreaterThan(0);
    });

    it('shows a signature row for a search result', async () => {
        const user = userEvent.setup();
        render(<TermsAgreementPage />);
        await user.type(screen.getByLabelText('Search accounts'), 'ada');
        await user.click(screen.getByRole('button', { name: 'Search' }));
        await user.click(await screen.findByRole('button', { name: /Ada Lovelace · ada@example.com · ada/ }));
        expect(await screen.findByText('203.0.113.8')).toBeInTheDocument();
        expect(screen.getByText('TestBrowser')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Ada Lovelace' })).toBeInTheDocument();
    });
});
