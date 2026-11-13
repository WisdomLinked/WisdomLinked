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
  getTermsDocxViewUrl: vi.fn(),
  searchTermsUsers: vi.fn(),
  getUserTermsAcceptances: vi.fn(),
  previewTerms: vi.fn(),
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
  api.previewTerms.mockResolvedValue({ html: '<p>Doc preview text</p>', contentHash: 'h' });
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
        role: 'customer',
        status: 'active',
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
    expect(within(signers).getByText('1 signature')).toBeInTheDocument();
    expect(within(signers).queryByText(/not counted/)).not.toBeInTheDocument();
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
    await screen.findByText('Doc preview text');
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
    await screen.findByText('Doc preview text');
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
    await screen.findByText('Doc preview text');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('v1 (first version)')).toBeInTheDocument();
    expect(screen.getByText('Must accept')).toBeInTheDocument();
  });
});

describe('TermsAgreementPage — publish drawer preview and warning', () => {
  const docx = (name = 'v.docx') => new File(['terms'], name, { type: DOCX_MIME });
  async function openDrawerOn(tabName: string) {
    const user = userEvent.setup();
    await renderLoaded();
    await user.click(screen.getByRole('tab', { name: new RegExp(tabName) }));
    await user.click(screen.getByRole('button', { name: 'New version' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close publish panel' })).toHaveFocus());
    return user;
  }

  it('shows the converted text before publishing, for the right audience, and only then allows Continue', async () => {
    let finish: (v: unknown) => void = () => {};
    api.previewTerms.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await openDrawerOn('Student');
    const file = docx('student-v2.docx');
    fireEvent.change(screen.getByLabelText('Agreement document'), { target: { files: [file] } });
    expect(api.previewTerms).toHaveBeenCalledWith('customer', file);
    expect(screen.getByText('Reading the document…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    finish({ html: '<h1>Student Agreement</h1><p>No-shows are not refunded.</p>', contentHash: 'h' });
    const region = await screen.findByRole('region', { name: 'Document preview' });
    expect(within(region).getByRole('heading', { name: 'Student Agreement' })).toBeInTheDocument();
    expect(within(region).getByText('No-shows are not refunded.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it('refuses an unreadable document straight away, and Try again re-reads it', async () => {
    api.previewTerms
      .mockRejectedValueOnce({ response: { data: { error: 'Could not read that document. Upload a .docx file.' } } })
      .mockResolvedValueOnce({ html: '<p>Readable now</p>', contentHash: 'h' });
    const user = await openDrawerOn('Shared');
    const file = docx('broken.docx');
    fireEvent.change(screen.getByLabelText('Agreement document'), { target: { files: [file] } });
    expect(await screen.findByText('Could not read that document. Upload a .docx file.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Readable now')).toBeInTheDocument();
    expect(api.previewTerms).toHaveBeenNthCalledWith(2, 'shared', file);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it('removing the file clears the preview, and a late preview of an older file never shows', async () => {
    let finishOld: (v: unknown) => void = () => {};
    api.previewTerms
      .mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
      .mockResolvedValueOnce({ html: '<p>Newest file text</p>', contentHash: 'h' });
    const user = await openDrawerOn('Shared');
    fireEvent.change(screen.getByLabelText('Agreement document'), { target: { files: [docx('old.docx')] } });
    await user.click(screen.getByRole('button', { name: 'Remove file' }));
    expect(screen.queryByText('Reading the document…')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Agreement document'), { target: { files: [docx('new.docx')] } });
    expect(await screen.findByText('Newest file text')).toBeInTheDocument();
    finishOld({ html: '<p>Old file text</p>', contentHash: 'h' });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(screen.queryByText('Old file text')).not.toBeInTheDocument();
    expect(screen.getByText('Newest file text')).toBeInTheDocument();
  });

  it('a rejected file (not .docx) shows no preview and never reaches the server', async () => {
    await openDrawerOn('Shared');
    fireEvent.change(screen.getByLabelText('Agreement document'), {
      target: { files: [new File(['x'], 'terms.pdf', { type: 'application/pdf' })] },
    });
    expect(screen.getByText('Only .docx files are accepted.')).toBeInTheDocument();
    expect(api.previewTerms).not.toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: 'Document preview' })).not.toBeInTheDocument();
  });

  it.each([
    ['Shared', 'Every student and expert will have to sign this new version'],
    ['Expert', 'Every expert will have to sign this new version'],
    ['Student', 'Every student will have to sign this new version'],
  ])('%s: the warning names who must sign', async (tabName, text) => {
    const user = await openDrawerOn(tabName);
    fireEvent.change(screen.getByLabelText('Agreement document'), { target: { files: [docx()] } });
    await screen.findByText('Doc preview text');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText(new RegExp(text))).toBeInTheDocument();
    expect(screen.queryByText(/students and experts must/)).not.toBeInTheDocument();
  });

  it('first version: the warning says "this agreement"', async () => {
    overviews.expert = { audience: 'expert', audienceSize: 4, versions: [] };
    const user = await openDrawerOn('Expert');
    fireEvent.change(screen.getByLabelText('Agreement document'), { target: { files: [docx()] } });
    await screen.findByText('Doc preview text');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText(/Every expert will have to sign this agreement before/)).toBeInTheDocument();
  });
});

describe('TermsAgreementPage — version history', () => {
  const signer = (userId: string, role: string, status: string) => ({
    userId, name: '', username: userId, email: `${userId}@example.com`, role, status,
    audience: 'shared', version: 1, signedAt: '2026-10-24T10:00:00Z', ip: '203.0.113.1', userAgent: 'ua',
    contentHash: 'hash-1', typedName: '', signaturePng: '',
  });

  it('shows who published each version, on one line with its date, and actions that never wrap', async () => {
    overviews.shared.versions[0].publisherName = 'priya';
    await renderLoaded();
    const rows = within(screen.getByRole('heading', { name: 'Version history' }).closest('section') as HTMLElement)
      .getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('by khussal')).toBeInTheDocument();
    expect(within(rows[1]).getByText('by priya')).toBeInTheDocument();
    expect(within(rows[0]).getByText(/^Oct 23, 2026/).className).toContain('whitespace-nowrap');
    const actions = within(rows[0]).getByRole('button', { name: 'Signers of v2' }).parentElement as HTMLElement;
    expect(actions.className).toContain('flex-nowrap');
    expect(actions.className).not.toMatch(/\bflex-wrap\b/);
    expect(screen.getByText(/blocked or\s+removed accounts are left out/)).toBeInTheDocument();
  });

  it('says how many signers are not counted in Accepted, and why', async () => {
    const user = userEvent.setup();
    api.listVersionSigners.mockResolvedValue([
      signer('ann', 'customer', 'active'),
      signer('bob', 'expert', 'review'),
      signer('cat', 'customer', 'blocked'),
      { ...signer('gone', '', ''), username: '', email: '' },
      signer('root', 'admin', 'active'),
    ]);
    await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Signers of v1' }));
    const dialog = await screen.findByRole('dialog', { name: 'Signers of Shared v1' });
    expect(await within(dialog).findByText('5 signatures · 3 not counted in Accepted')).toBeInTheDocument();
    const tagFor = (name: string) => within(within(dialog).getByText(name, { exact: true }).closest('li') as HTMLElement)
      .queryByText(/not counted/)?.textContent;
    expect(tagFor('ann')).toBeUndefined();
    expect(tagFor('bob')).toBeUndefined();
    expect(tagFor('cat')).toBe('Blocked · not counted');
    expect(tagFor('gone')).toBe('Account removed · not counted');
    expect(tagFor('root')).toBe('Now admin · not counted');
  });

  it('judges signers against the agreement being viewed: a student is not counted for the expert agreement', async () => {
    const user = userEvent.setup();
    api.listVersionSigners.mockResolvedValue([
      { ...signer('stu', 'customer', 'active'), audience: 'expert' },
      { ...signer('exp', 'expert', 'active'), audience: 'expert' },
    ]);
    await renderLoaded();
    await user.click(screen.getByRole('tab', { name: /Expert/ }));
    await user.click(await screen.findByRole('button', { name: 'Signers of v1' }));
    const dialog = await screen.findByRole('dialog', { name: 'Signers of Expert v1' });
    expect(await within(dialog).findByText('2 signatures · 1 not counted in Accepted')).toBeInTheDocument();
    expect(within(dialog).getByText('Now student · not counted')).toBeInTheDocument();
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

describe('TermsAgreementPage — View document', () => {
  const LINK = 'https://bucket.example/termsDocuments/1731_shared-v2.docx';

  beforeEach(() => {
    api.getAdminTermsVersion.mockResolvedValue({ html: '<p>Refunds within 24 hours.</p>' });
    api.getTermsDocxViewUrl.mockResolvedValue(LINK);
  });

  async function openPreview(versionNumber: number) {
    const user = userEvent.setup();
    await renderLoaded();
    const history = screen.getByRole('heading', { name: 'Version history' }).closest('section') as HTMLElement;
    await user.click(within(history).getByRole('button', { name: `Preview v${versionNumber}` }));
    const preview = await screen.findByRole('dialog', { name: `Shared agreement · v${versionNumber}` });
    return { user, preview };
  }

  it('the preview has a View document button beside its title; the signers list does not', async () => {
    const { user, preview } = await openPreview(2);
    const heading = within(preview).getByRole('heading', { name: 'Shared agreement · v2' });
    expect(heading.parentElement).toContainElement(within(preview).getByRole('button', { name: 'View document' }));
    await user.click(within(preview).getByRole('button', { name: 'Close dialog' }));

    api.listVersionSigners.mockResolvedValue([]);
    const card = screen.getByRole('heading', { name: 'Shared agreement · v2' }).closest('section') as HTMLElement;
    await user.click(within(card).getByRole('button', { name: 'Signers' }));
    const signers = await screen.findByRole('dialog', { name: 'Signers of Shared v2' });
    expect(within(signers).queryByRole('button', { name: 'View document' })).not.toBeInTheDocument();
  });

  it('opens that exact version in the résumé viewer: Word viewer frame, title, file name and download', async () => {
    const { user, preview } = await openPreview(1);
    api.getTermsDocxViewUrl.mockResolvedValue('https://bucket.example/termsDocuments/9_shared-v1.docx');
    await user.click(within(preview).getByRole('button', { name: 'View document' }));
    expect(api.getTermsDocxViewUrl).toHaveBeenCalledWith('shared', 1);
    const close = await screen.findByRole('button', { name: 'Close preview' });
    const viewer = close.closest('[role="dialog"]') as HTMLElement;
    expect(within(viewer).getByRole('heading', { name: 'Shared agreement · v1' })).toBeInTheDocument();
    const frame = viewer.querySelector('iframe') as HTMLIFrameElement;
    expect(frame.getAttribute('src')).toBe(
      `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent('https://bucket.example/termsDocuments/9_shared-v1.docx')}`,
    );
    expect(within(viewer).getByText('shared-v1.docx')).toBeInTheDocument();
    expect(within(viewer).getByRole('link', { name: 'Download' })).toHaveAttribute('href', 'https://bucket.example/termsDocuments/9_shared-v1.docx');
  });

  it('Escape and the close button close only the document, leaving the preview open', async () => {
    const { user, preview } = await openPreview(2);
    await user.click(within(preview).getByRole('button', { name: 'View document' }));
    await screen.findByRole('button', { name: 'Close preview' });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Close preview' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Shared agreement · v2' })).toBeInTheDocument();

    await user.click(within(preview).getByRole('button', { name: 'View document' }));
    await user.click(await screen.findByRole('button', { name: 'Close preview' }));
    expect(screen.queryByRole('button', { name: 'Close preview' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Shared agreement · v2' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the server reason when the document cannot be opened, and the preview stays usable', async () => {
    api.getTermsDocxViewUrl.mockRejectedValue({
      response: { data: { error: 'The document viewer is not available right now. Use Download instead.' } },
    });
    const { user, preview } = await openPreview(2);
    await user.click(within(preview).getByRole('button', { name: 'View document' }));
    expect(await within(preview).findByRole('alert')).toHaveTextContent('The document viewer is not available right now');
    expect(screen.queryByRole('button', { name: 'Close preview' })).not.toBeInTheDocument();
    expect(within(preview).getByText('Refunds within 24 hours.')).toBeInTheDocument();
    expect(within(preview).getByRole('button', { name: 'View document' })).toBeEnabled();
  });

  it('a link that arrives after the preview was closed never opens a viewer', async () => {
    let resolve: (url: string) => void = () => {};
    api.getTermsDocxViewUrl.mockImplementation(() => new Promise<string>(r => { resolve = r; }));
    const { user, preview } = await openPreview(2);
    await user.click(within(preview).getByRole('button', { name: 'View document' }));
    expect(within(preview).getByRole('button', { name: 'Opening…' })).toBeDisabled();
    await user.click(within(preview).getByRole('button', { name: 'Close dialog' }));
    resolve(LINK);
    await new Promise(r => setTimeout(r, 0));
    expect(screen.queryByRole('button', { name: 'Close preview' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
