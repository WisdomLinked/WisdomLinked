import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import TermsDashboardGate from './TermsDashboardGate';

const api = vi.hoisted(() => ({
    getRequiredContracts: vi.fn(),
    acceptTerms: vi.fn(),
}));

vi.mock('../../api/termsApi', () => ({
    getRequiredContracts: (...args: unknown[]) => api.getRequiredContracts(...args),
    acceptTerms: (...args: unknown[]) => api.acceptTerms(...args),
}));

describe('TermsDashboardGate', () => {
    beforeEach(() => {
        api.getRequiredContracts.mockReset();
        api.acceptTerms.mockReset();
    });

    it('blocks the dashboard and shows the unsigned contract', async () => {
        api.getRequiredContracts.mockResolvedValue([
            {
                audience: 'shared',
                version: 2,
                html: '<p>Please sign the shared agreement</p>',
                contentHash: 'abc',
                originalFilename: 'shared.docx',
            },
        ]);

        render(
            <TermsDashboardGate>
                <div>Student dashboard body</div>
            </TermsDashboardGate>,
        );

        expect(await screen.findByText('Please sign the shared agreement')).toBeInTheDocument();
        expect(screen.queryByText('Student dashboard body')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /skip|dismiss|not now|close/i })).not.toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: /I agree/i })).toBeInTheDocument();
    });

    it('shows the dashboard when nothing is left to sign', async () => {
        api.getRequiredContracts.mockResolvedValue([]);
        render(
            <TermsDashboardGate>
                <div>Student dashboard body</div>
            </TermsDashboardGate>,
        );
        expect(await screen.findByText('Student dashboard body')).toBeInTheDocument();
    });
});
