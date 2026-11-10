import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SignatureLookup from './SignatureLookup';
import { contractFromOverview, initialContracts } from './termsModel';
import type { TermsAcceptanceRow, TermsAudience, TermsUserHit } from '../../../../api/termsApi';

const api = vi.hoisted(() => ({
  searchTermsUsers: vi.fn(),
  getUserTermsAcceptances: vi.fn(),
  getAdminTermsVersion: vi.fn(),
  downloadTermsDocx: vi.fn(),
}));
vi.mock('../../../../api/termsApi', () => api);

const meta = (audience: TermsAudience, version: number) => ({
  audience,
  version,
  contentHash: `h${version}`,
  originalFilename: `${audience}-v${version}.docx`,
  publishedAt: '2026-10-01T10:00:00Z',
});
const [sharedBase, expertBase, studentBase] = initialContracts();
const contracts = [
  contractFromOverview(sharedBase, { audience: 'shared', audienceSize: 10, versions: [meta('shared', 1), meta('shared', 2)] }),
  contractFromOverview(expertBase, { audience: 'expert', audienceSize: 4, versions: [meta('expert', 1)] }),
  contractFromOverview(studentBase, { audience: 'customer', audienceSize: 6, versions: [] }),
];

const signed = (audience: TermsAudience, version: number) => ({ audience, version, signedAt: '2026-10-09T15:30:00Z' });
const users: TermsUserHit[] = [
  { id: 'e1', email: 'ada@example.com', username: 'ada', name: '', role: 'expert', status: 'active', signatures: [signed('shared', 2), signed('expert', 1)] },
  { id: 'e2', email: 'bob@example.com', username: 'bob', name: '', role: 'expert', status: 'active', signatures: [signed('shared', 1)] },
  { id: 's1', email: 'cy@example.com', username: 'cy', name: '', role: 'customer', status: 'blocked', signatures: [signed('shared', 1)] },
  { id: 'a1', email: 'admin@example.com', username: 'Admin', name: '', role: 'admin', status: 'active', signatures: [] },
];

const acceptance = (extra: Partial<TermsAcceptanceRow> = {}): TermsAcceptanceRow => ({
  userId: 'e1',
  audience: 'shared',
  version: 2,
  signedAt: '2026-10-09T15:30:00Z',
  ip: '203.0.113.7',
  userAgent: 'Mozilla/5.0 (Macintosh) Chrome/148',
  contentHash: 'abc123hash',
  typedName: 'Ada Lovelace',
  signaturePng: 'data:image/png;base64,iVBORw0KGgo=',
  originalFilename: 'shared-v2.docx',
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  api.searchTermsUsers.mockResolvedValue(users);
});

async function search(term: string) {
  const user = userEvent.setup();
  const input = screen.getByLabelText('Username, email or name');
  await user.clear(input);
  if (term) await user.type(input, term);
  await user.click(screen.getByRole('button', { name: 'Search' }));
  return user;
}

const row = (name: string) => screen.getByText(name, { exact: true }).closest('li') as HTMLElement;

describe('SignatureLookup', () => {
  it('asks for a search term instead of calling the server with an empty one', async () => {
    render(<SignatureLookup contracts={contracts} />);
    await search('   ');
    expect(screen.getByText('Enter a name, username, or email.')).toBeInTheDocument();
    expect(api.searchTermsUsers).not.toHaveBeenCalled();
  });

  it('shows real accounts with where each stands against the current versions', async () => {
    render(<SignatureLookup contracts={contracts} />);
    await search('  example  ');
    expect(api.searchTermsUsers).toHaveBeenCalledWith('example');

    const ada = row('ada');
    expect(within(ada).getByText('expert')).toBeInTheDocument();
    expect(within(ada).getByText('@ada · ada@example.com')).toBeInTheDocument();
    expect(within(ada).getByText(/^Shared: signed v2 on Oct 9, 2026/)).toBeInTheDocument();
    expect(within(ada).getByText(/^Expert: signed v1 on/)).toBeInTheDocument();

    const bob = row('bob');
    expect(within(bob).getByText('Shared: signed v1, needs v2')).toBeInTheDocument();
    expect(within(bob).getByText('Expert: not signed')).toBeInTheDocument();

    const cy = row('cy');
    expect(within(cy).getByText('student')).toBeInTheDocument();
    expect(within(cy).getByText('Blocked')).toBeInTheDocument();
    expect(within(cy).getByText('Shared: signed v1, needs v2')).toBeInTheDocument();
    expect(within(cy).getByText('Student: nothing published yet')).toBeInTheDocument();
    expect(within(bob).queryByText('Blocked')).not.toBeInTheDocument();

    const admin = row('Admin');
    expect(within(admin).getByText('No agreements required')).toBeInTheDocument();
    expect(within(admin).queryByText(/Shared:/)).not.toBeInTheDocument();
  });

  it('colours each status: green signed, amber needs update, rose not signed, grey otherwise', async () => {
    render(<SignatureLookup contracts={contracts} />);
    await search('example');
    expect(screen.getByText(/^Shared: signed v2/).className).toContain('bg-emerald-50');
    expect(within(row('bob')).getByText('Shared: signed v1, needs v2').className).toContain('bg-amber-50');
    expect(screen.getByText('Expert: not signed').className).toContain('bg-rose-50');
    expect(screen.getByText('Student: nothing published yet').className).toContain('bg-slate-100');
    for (const badge of screen.getAllByText(/:/)) expect(badge.className).not.toMatch(/(bg|text)-red-\d/);
  });

  it('says when nothing matches, and shows the server reason when the search fails', async () => {
    api.searchTermsUsers.mockResolvedValueOnce([]);
    render(<SignatureLookup contracts={contracts} />);
    await search('nobody');
    expect(screen.getByText('No users found')).toBeInTheDocument();
    api.searchTermsUsers.mockRejectedValueOnce({ response: { data: { error: 'Search is too long.' } } });
    await search('x');
    expect(await screen.findByText('Search is too long.')).toBeInTheDocument();
  });

  it('notes when the 25-result limit is reached', async () => {
    api.searchTermsUsers.mockResolvedValueOnce(
      Array.from({ length: 25 }, (_, i) => ({ ...users[1], id: `u${i}`, username: `user${i}` })),
    );
    render(<SignatureLookup contracts={contracts} />);
    await search('user');
    expect(screen.getByText('Showing the first 25 matches. Refine the search to narrow it down.')).toBeInTheDocument();
  });

  it('expands a user\'s signature records with every field, and collapses them again', async () => {
    api.getUserTermsAcceptances.mockResolvedValue({ user: users[0], acceptances: [acceptance(), acceptance({ audience: 'expert', version: 1, typedName: '', signaturePng: '' })] });
    render(<SignatureLookup contracts={contracts} />);
    const user = await search('example');
    const toggle = within(row('ada')).getByRole('button', { name: 'View signatures' });
    await user.click(toggle);
    expect(api.getUserTermsAcceptances).toHaveBeenCalledWith('e1');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const panel = await screen.findByRole('heading', { name: 'Signatures for ada' }).then(h => h.parentElement as HTMLElement);
    expect(within(panel).getAllByRole('columnheader').map(th => th.textContent)).toEqual([
      'Audience', 'Version', 'Time', 'IP', 'User agent', 'Account', 'Content hash', 'Typed name',
    ]);
    const cells = within(panel).getAllByRole('row')[1].querySelectorAll('td');
    expect(Array.from(cells).map(td => td.textContent)).toEqual([
      'Shared', 'v2', expect.stringMatching(/^Oct 9, 2026/), '203.0.113.7', 'Mozilla/5.0 (Macintosh) Chrome/148', 'e1', 'abc123hash', 'Ada Lovelace',
    ]);
    expect(within(panel).getByRole('button', { name: 'Open signature' })).toBeInTheDocument();

    await user.click(within(row('ada')).getByRole('button', { name: 'Hide signatures' }));
    expect(screen.queryByText('Signatures for ada')).not.toBeInTheDocument();
    await user.click(within(row('ada')).getByRole('button', { name: 'View signatures' }));
    expect(await screen.findByText('Signatures for ada')).toBeInTheDocument();
    expect(api.getUserTermsAcceptances).toHaveBeenCalledTimes(1);
  });

  it('shows "No signatures stored." and retries a failed load when reopened', async () => {
    api.getUserTermsAcceptances
      .mockRejectedValueOnce({ response: { data: { error: 'Account not found.' } } })
      .mockResolvedValueOnce({ user: users[3], acceptances: [] });
    render(<SignatureLookup contracts={contracts} />);
    const user = await search('example');
    await user.click(within(row('Admin')).getByRole('button', { name: 'View signatures' }));
    expect(await screen.findByText('Account not found.')).toBeInTheDocument();
    await user.click(within(row('Admin')).getByRole('button', { name: 'Hide signatures' }));
    await user.click(within(row('Admin')).getByRole('button', { name: 'View signatures' }));
    expect(await screen.findByText('No signatures stored.')).toBeInTheDocument();
    expect(api.getUserTermsAcceptances).toHaveBeenCalledTimes(2);
  });

  it('opens the signed agreement with its typed name, drawn signature and download', async () => {
    api.getUserTermsAcceptances.mockResolvedValue({ user: users[0], acceptances: [acceptance()] });
    api.getAdminTermsVersion.mockResolvedValue({ html: '<p>Refunds within 48 hours.</p>' });
    api.downloadTermsDocx.mockResolvedValue(undefined);
    render(<SignatureLookup contracts={contracts} />);
    const user = await search('example');
    await user.click(within(row('ada')).getByRole('button', { name: 'View signatures' }));
    await user.click(await screen.findByRole('button', { name: 'Ada Lovelace' }));
    expect(api.getAdminTermsVersion).toHaveBeenCalledWith('shared', 2);
    const dialog = await screen.findByRole('dialog', { name: 'Shared agreement · v2' });
    expect(within(dialog).getByText(/^Signed by ada on Oct 9, 2026/)).toBeInTheDocument();
    expect(await within(dialog).findByText('Refunds within 48 hours.')).toBeInTheDocument();
    expect(within(dialog).getByText('Ada Lovelace')).toBeInTheDocument();
    expect(within(dialog).getByRole('img', { name: 'Drawn signature' })).toHaveAttribute('src', 'data:image/png;base64,iVBORw0KGgo=');
    await user.click(within(dialog).getByRole('button', { name: 'Download .docx' }));
    expect(api.downloadTermsDocx).toHaveBeenCalledWith('shared', 2, 'shared-v2.docx');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('says when there is no drawn signature, and shows a download failure', async () => {
    api.getUserTermsAcceptances.mockResolvedValue({ user: users[0], acceptances: [acceptance({ signaturePng: '' })] });
    api.getAdminTermsVersion.mockResolvedValue({ html: '<p>Text</p>' });
    api.downloadTermsDocx.mockRejectedValue(new Error('500'));
    render(<SignatureLookup contracts={contracts} />);
    const user = await search('example');
    await user.click(within(row('ada')).getByRole('button', { name: 'View signatures' }));
    await user.click(await screen.findByRole('button', { name: 'Ada Lovelace' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('No drawn signature.')).toBeInTheDocument();
    expect(within(dialog).queryByRole('img')).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Download .docx' }));
    expect(await within(dialog).findByText('Could not download this agreement. Try again.')).toBeInTheDocument();
  });

  it('keeps the newest search when an older one answers late, and collapses details on a new search', async () => {
    let releaseSlow: (value: TermsUserHit[]) => void = () => {};
    api.searchTermsUsers
      .mockImplementationOnce(() => new Promise(resolve => { releaseSlow = resolve; }))
      .mockResolvedValueOnce([users[1]]);
    render(<SignatureLookup contracts={contracts} />);
    await search('slow');
    await search('bob');
    expect(await screen.findByText('bob')).toBeInTheDocument();
    releaseSlow([users[0]]);
    await waitFor(() => expect(screen.queryByText('ada')).not.toBeInTheDocument());
    expect(screen.getByText('bob')).toBeInTheDocument();

    api.getUserTermsAcceptances.mockResolvedValue({ user: users[1], acceptances: [] });
    api.searchTermsUsers.mockResolvedValueOnce([users[1]]);
    const user = userEvent.setup();
    await user.click(within(row('bob')).getByRole('button', { name: 'View signatures' }));
    expect(await screen.findByText('Signatures for bob')).toBeInTheDocument();
    await search('bob');
    await waitFor(() => expect(screen.queryByText('Signatures for bob')).not.toBeInTheDocument());
    expect(within(row('bob')).getByRole('button', { name: 'View signatures' })).toHaveAttribute('aria-expanded', 'false');
  });
});
