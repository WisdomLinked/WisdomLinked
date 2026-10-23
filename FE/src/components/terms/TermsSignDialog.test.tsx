import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import TermsSignDialog from './TermsSignDialog';

const api = vi.hoisted(() => ({
    getRequiredContracts: vi.fn(),
    getCurrentTerms: vi.fn(),
    acceptTerms: vi.fn(),
}));

vi.mock('../../api/termsApi', () => ({
    getRequiredContracts: (...args: unknown[]) => api.getRequiredContracts(...args),
    getCurrentTerms: (...args: unknown[]) => api.getCurrentTerms(...args),
    acceptTerms: (...args: unknown[]) => api.acceptTerms(...args),
}));

const SIGNED_AT = '2026-03-15T18:45:00.000Z';
const SIGNATURE = 'data:image/png;base64,abc';

describe('TermsSignDialog', () => {
    beforeEach(() => {
        api.getRequiredContracts.mockReset();
        api.getCurrentTerms.mockReset();
        api.acceptTerms.mockReset();
    });

    it('shows a read-only receipt for a version that is already signed', async () => {
        api.getRequiredContracts.mockResolvedValue([]);
        api.getCurrentTerms.mockResolvedValue({
            published: true,
            alreadySigned: true,
            audience: 'customer',
            version: 4,
            html: '<p>Student contract body</p>',
            contentHash: 'hash-customer',
            signedAt: SIGNED_AT,
            typedName: 'Ada Lovelace',
            signaturePng: SIGNATURE,
        });

        render(<TermsSignDialog open role="customer" onClose={() => undefined} />);

        expect(await screen.findByRole('heading', { name: 'Student agreement' })).toBeInTheDocument();
        expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
        expect(screen.getByText('Student contract body')).toBeInTheDocument();
        const when = new Date(SIGNED_AT).toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
        expect(screen.getByText(`You signed version 4 on ${when}.`)).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'Drawn signature' })).toHaveAttribute('src', SIGNATURE);
        expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Sign agreement' })).not.toBeInTheDocument();
        expect(screen.queryByRole('textbox', { name: /full legal name/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('checkbox', { name: /I agree/i })).not.toBeInTheDocument();
        expect(screen.queryByText(/Sign this agreement to continue/)).not.toBeInTheDocument();
    });

    it('keeps the sign form when the current version is not signed', async () => {
        api.getRequiredContracts.mockResolvedValue([]);
        api.getCurrentTerms.mockResolvedValue({
            published: true,
            alreadySigned: false,
            audience: 'expert',
            version: 2,
            html: '<p>Expert contract body</p>',
            contentHash: 'hash-expert',
        });

        render(<TermsSignDialog open role="expert" onClose={() => undefined} />);

        expect(await screen.findByRole('heading', { name: 'Expert agreement' })).toBeInTheDocument();
        expect(screen.getByText(/Sign this agreement to continue/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Sign agreement' })).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: /full legal name/i })).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: /I agree/i })).toBeInTheDocument();
    });
});
