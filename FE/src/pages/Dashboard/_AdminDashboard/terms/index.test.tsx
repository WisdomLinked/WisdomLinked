import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TermsAgreementPage from './index';
import { DOCX_MIME } from './termsModel';

describe('TermsAgreementPage', () => {
  it('shows the current shared agreement and switches tabs with arrow keys', async () => {
    const user = userEvent.setup();
    render(<TermsAgreementPage />);
    expect(screen.getByRole('heading', { name: 'Terms & Agreement' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Shared agreement · v4' })).toBeInTheDocument();
    expect(screen.getByText('1,284')).toBeInTheDocument();

    const sharedTab = screen.getByRole('tab', { name: /Shared/ });
    sharedTab.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /Expert/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Expert agreement · v3' })).toBeInTheDocument();
    expect(screen.getByText('318')).toBeInTheDocument();
  });

  it('looks up current, outdated and missing signatures', async () => {
    const user = userEvent.setup();
    render(<TermsAgreementPage />);
    expect(screen.getByText('Search for a user')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Username, email or name'), 'maya');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(screen.getByText('Maya Chen')).toBeInTheDocument();
    expect(screen.getByText(/Shared: signed v4/)).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Username, email or name'));
    await user.type(screen.getByLabelText('Username, email or name'), 'nobody-here');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(screen.getByText('No users found')).toBeInTheDocument();
  });

  it('publishes a new version from the slide-over', async () => {
    const user = userEvent.setup();
    render(<TermsAgreementPage />);
    await user.click(screen.getByRole('button', { name: 'Publish Shared v5' }));
    expect(screen.getByRole('dialog', { name: 'Publish Shared v5' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close publish panel' })).toHaveFocus());
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();

    const file = new File(['terms'], 'shared-v5.docx', { type: DOCX_MIME });
    fireEvent.change(screen.getByLabelText('Agreement document'), { target: { files: [file] } });
    expect(screen.getByText('shared-v5.docx')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('v4 → v5')).toBeInTheDocument();
    expect(screen.getByText(/Publishing cannot be undone/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Publish v5' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Shared v5 is now the current agreement.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Shared agreement · v5' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish Shared v6' })).toBeInTheDocument();
  });
});
