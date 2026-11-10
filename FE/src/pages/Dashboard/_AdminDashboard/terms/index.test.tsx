import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TermsAgreementPage from './index';
import { DOCX_MIME } from './termsModel';
import type { TermsOverview } from '../../../../api/termsApi';

const api = vi.hoisted(() => ({
  getTermsOverview: vi.fn(),
  publishTerms: vi.fn(),
  getAdminTermsVersion: vi.fn(),
  listVersionSigners: vi.fn(),
  downloadTermsDocx: vi.fn(),
  searchTermsUsers: vi.fn(),
  getUserTermsAcceptances: vi.fn(),
}));

vi.mock('../../../../api/termsApi', () => api);

const version = (audience: TermsOverview['audience'], n: number, extra: Record<string, unknown> = {}) => ({
  audience,
  version: n,
  contentHash: `hash-${n}`,
  originalFilename: `${audience}-v${n}.docx`,
  publishedAt: '2026-10-23T05:41:00Z',
  publisherName: 'khussal',
  accepted: 0,
  notes: '',
  ...extra,
});

const overviews: Record<string, TermsOverview> = {};

function setOverviews() {
  overviews.shared = {
    audience: 'shared',
    audienceSize: 25,
    versions: [
      version('shared', 1, { accepted: 20, notes: 'Initial terms' }),
      version('shared', 2, { accepted: 7, notes: 'Clarified refund window' }),
    ],
  };
  overviews.expert = { audience: 'expert', audienceSize: 4, versions: [version('expert', 1, { accepted: 4 })] };
  overviews.customer = { audience: 'customer', audienceSize: 2, versions: [version('customer', 1, { accepted: 1 })] };
}

beforeEach(() => {
  vi.clearAllMocks();
  setOverviews();
  api.getTermsOverview.mockImplementation(async (audience: string) => overviews[audience]);
});

async function renderLoaded() {
  render(<TermsAgreementPage />);
  await screen.findByRole('heading', { name: 'Shared agreement · v2' });
}

describe('TermsAgreementPage — current version', () => {
  it('shows the real current version, counts and share for each tab', async () => {
    const user = userEvent.setup();
    await renderLoaded();

    expect(api.getTermsOverview.mock.calls.map(call => call[0]).sort()).toEqual(['customer', 'expert', 'shared']);
    expect(screen.getByText(/Published Oct 23, 2026.* by khussal/)).toBeInTheDocument();
    expect(screen.getAllByText('Clarified refund window').length).toBeGreaterThan(0);
    const card = screen.getByRole('heading', { name: 'Shared agreement · v2' }).closest('section') as HTMLElement;
    expect(within(card).getByText('Accepted').nextSibling).toHaveTextContent('7');
    expect(within(card).getByText('Pending').nextSibling).toHaveTextContent('18');
    expect(within(card).getByText('Audience').nextSibling).toHaveTextContent('25');
    expect(within(card).getByText('28%')).toBeInTheDocument();
    expect(within(card).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '28');

    screen.getByRole('tab', { name: /Shared/ }).focus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(screen.getByRole('tab', { name: /Student/ })).toHaveAttribute('aria-selected', 'true');
    const studentCard = screen.getByRole('heading', { name: 'Student agreement · v1' }).closest('section') as HTMLElement;
    expect(within(studentCard).getByText('Pending').nextSibling).toHaveTextContent('1');
    expect(within(studentCard).getByText('50%')).toBeInTheDocument();
  });

  it('shows the empty state, not a crash, when nothing is published', async () => {
    overviews.shared = { audience: 'shared', audienceSize: 12, versions: [] };
    render(<TermsAgreementPage />);
    expect(await screen.findByText('No version published yet')).toBeInTheDocument();
    expect(screen.queryByText('Accepted')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Version history' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New version' })).toBeEnabled();
  });

  it('shows a retry when loading fails, and loads on retry', async () => {
    const user = userEvent.setup();
    api.getTermsOverview.mockImplementation(async (audience: string) => {
      if (audience === 'shared' && api.getTermsOverview.mock.calls.filter(c => c[0] === 'shared').length === 1) {
        throw new Error('network');
      }
      return overviews[audience];
    });
    render(<TermsAgreementPage />);
    expect(await screen.findByText('Could not load the shared agreement.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New version' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Shared agreement · v2' })).toBeInTheDocument();
  });

  it('opens the real preview, signers and download for the current version', async () => {
    const user = userEvent.setup();
    api.getAdminTermsVersion.mockResolvedValue({ html: '<p>Refunds within 24 hours.</p>' });
    api.listVersionSigners.mockResolvedValue([
      {
        userId: 'u1',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        audience: 'shared',
        version: 2,
        signedAt: '2026-10-24T10:00:00Z',
        ip: '203.0.113.9',
        userAgent: 'ua',
        contentHash: 'hash-2',
        typedName: 'Ada L',
        signaturePng: '',
      },
    ]);
    api.downloadTermsDocx.mockResolvedValue(undefined);
    await renderLoaded();
    const card = screen.getByRole('heading', { name: 'Shared agreement · v2' }).closest('section') as HTMLElement;

    await user.click(within(card).getByRole('button', { name: 'Preview' }));
    expect(api.getAdminTermsVersion).toHaveBeenCalledWith('shared', 2);
    const preview = await screen.findByRole('dialog', { name: 'Shared agreement · v2' });
    expect(await within(preview).findByText('Refunds within 24 hours.')).toBeInTheDocument();
    await user.click(within(preview).getByRole('button', { name: 'Close dialog' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(within(card).getByRole('button', { name: 'Signers' }));
    expect(api.listVersionSigners).toHaveBeenCalledWith('shared', 2);
    const signers = await screen.findByRole('dialog', { name: 'Signers of Shared v2' });
    expect(await within(signers).findByText('Ada Lovelace')).toBeInTheDocument();
    expect(within(signers).getByText(/IP 203\.0\.113\.9/)).toBeInTheDocument();
    expect(within(signers).getByText('Typed name: Ada L')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(within(card).getByRole('button', { name: 'Download .docx' }));
    expect(api.downloadTermsDocx).toHaveBeenCalledWith('shared', 2, 'shared-v2.docx');
  });

  it('shows the server reason when a preview cannot load', async () => {
    const user = userEvent.setup();
    api.getAdminTermsVersion.mockRejectedValue({ response: { data: { error: 'That agreement version was not found.' } } });
    await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(await screen.findByText('That agreement version was not found.')).toBeInTheDocument();
  });

  it('publishes to the backend with notes, then shows the new version from the server', async () => {
    const user = userEvent.setup();
    api.publishTerms.mockImplementation(async () => {
      overviews.customer = {
        audience: 'customer',
        audienceSize: 2,
        versions: [...overviews.customer.versions, version('customer', 2, { notes: 'No-show policy' })],
      };
      return { version: 2 };
    });
    await renderLoaded();
    await user.click(screen.getByRole('tab', { name: /Student/ }));
    await user.click(screen.getByRole('button', { name: 'New version' }));
    expect(screen.getByRole('dialog', { name: 'Publish Student v2' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close publish panel' })).toHaveFocus());

    const file = new File(['terms'], 'student-v2.docx', { type: DOCX_MIME });
    fireEvent.change(screen.getByLabelText('Agreement document'), { target: { files: [file] } });
    await user.type(screen.getByLabelText('What changed (optional)'), 'No-show policy');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('v1 → v2')).toBeInTheDocument();
    expect(screen.getByText('2 users')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Publish v2' }));

    expect(api.publishTerms).toHaveBeenCalledWith('customer', file, 'No-show policy');
    expect(await screen.findByText('Student v2 is now the current agreement.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Student agreement · v2' })).toBeInTheDocument();
    expect(screen.getAllByText('No-show policy').length).toBeGreaterThan(0);
  });

  it('keeps the drawer open and shows why when the server refuses the publish', async () => {
    const user = userEvent.setup();
    api.publishTerms.mockRejectedValue({ response: { data: { error: 'That document has no text to publish.' } } });
    await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'New version' }));
    const file = new File(['terms'], 'empty.docx', { type: DOCX_MIME });
    fireEvent.change(screen.getByLabelText('Agreement document'), { target: { files: [file] } });
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Publish v3' }));

    expect(await screen.findByText('That document has no text to publish.')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Publish Shared v3' })).toBeInTheDocument();
    expect(screen.queryByText(/is now the current agreement/)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Publish v3' })).toBeEnabled());
  });

  it('labels the first publish as the first version', async () => {
    const user = userEvent.setup();
    overviews.shared = { audience: 'shared', audienceSize: 12, versions: [] };
    render(<TermsAgreementPage />);
    await screen.findByText('No version published yet');
    await user.click(screen.getByRole('button', { name: 'New version' }));
    fireEvent.change(screen.getByLabelText('Agreement document'), {
      target: { files: [new File(['t'], 'v1.docx', { type: DOCX_MIME })] },
    });
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('v1 (first version)')).toBeInTheDocument();
    expect(screen.getByText('Must accept')).toBeInTheDocument();
  });
});

describe('TermsAgreementPage — signature lookup', () => {
  it('judges search results against the versions the page loaded', async () => {
    const user = userEvent.setup();
    api.searchTermsUsers.mockResolvedValue([
      {
        id: 'u1', email: 'ada@example.com', username: 'ada', name: '', role: 'expert', status: 'active',
        signatures: [
          { audience: 'shared', version: 1, signedAt: '2026-10-09T10:00:00Z' },
          { audience: 'expert', version: 1, signedAt: '2026-10-09T10:00:00Z' },
        ],
      },
    ]);
    await renderLoaded();
    expect(screen.getByText('Search for a user')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Username, email or name'), 'ada');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(api.searchTermsUsers).toHaveBeenCalledWith('ada');
    expect(await screen.findByText('Shared: signed v1, needs v2')).toBeInTheDocument();
    expect(screen.getByText(/^Expert: signed v1 on/)).toBeInTheDocument();
  });
});
