import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import AccountReviewBanner from './AccountReviewBanner';

function renderBanner(status: string | undefined) {
  const store = configureStore({
    reducer: {
      auth: () => ({
        userDetails: status === undefined ? {} : { status },
      }),
    },
  });
  return render(
    <Provider store={store}>
      <AccountReviewBanner />
    </Provider>,
  );
}

const copy =
  /Your profile is under review\. You'll have full access to sessions, seminars, and other features once it's approved\./;

describe('AccountReviewBanner', () => {
  it('renders the message when the account is under review', () => {
    renderBanner('review');
    expect(screen.getByRole('status')).toHaveTextContent(copy);
  });

  it('is absent from the DOM when the account is approved', () => {
    renderBanner('active');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText(copy)).not.toBeInTheDocument();
  });
});
