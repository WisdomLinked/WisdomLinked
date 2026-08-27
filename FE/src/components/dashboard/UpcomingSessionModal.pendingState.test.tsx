import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import UpcomingSessionModal, { type UpcomingModalSession } from './UpcomingSessionModal';

const session = (over: Partial<UpcomingModalSession> = {}): UpcomingModalSession => ({
  id: 's1',
  title: 'Grad school strategy',
  at: Date.now() + 60 * 60 * 1000,
  when: 'Fri, 3:00 PM',
  location: 'Online · WisdomLinked',
  with: 'Bruce Wang',
  ...over,
});

const renderPending = (sessions: UpcomingModalSession[]) =>
  render(
    <UpcomingSessionModal
      kind="oneToOne"
      status="pending"
      role="expert"
      onClose={vi.fn()}
      sessions={sessions}
    />,
  );

describe('UpcomingSessionModal pending 1:1 copy for experts', () => {
  it('asks the expert to decide when every request is theirs to decide', () => {
    renderPending([session({ id: 'a', pendingState: 'awaiting_expert' })]);

    expect(screen.getByText(/need your decision/i)).toBeInTheDocument();
    expect(screen.getByText('Your decision')).toBeInTheDocument();
  });

  it('tells the expert nothing is needed from them once they have accepted', () => {
    renderPending([session({ id: 'b', pendingState: 'accepted_awaiting_payment' })]);

    expect(screen.getByText(/already accepted these/i)).toBeInTheDocument();
    expect(screen.getByText(/Nothing more is needed from you/i)).toBeInTheDocument();
    expect(screen.getByText('Awaiting payment')).toBeInTheDocument();
  });

  it('names an expert-sent offer as waiting on the student', () => {
    renderPending([session({ id: 'c', pendingState: 'offer_awaiting_payment' })]);

    expect(screen.getByText(/offers you sent/i)).toBeInTheDocument();
    expect(screen.getByText(/withdraw an offer until then/i)).toBeInTheDocument();
  });

  it('splits the difference when the list mixes states', () => {
    renderPending([
      session({ id: 'd', pendingState: 'awaiting_expert' }),
      session({ id: 'e', pendingState: 'accepted_awaiting_payment' }),
    ]);

    expect(screen.getByText(/Some of these need your decision/i)).toBeInTheDocument();
    expect(screen.getByText('Your decision')).toBeInTheDocument();
    expect(screen.getByText('Awaiting payment')).toBeInTheDocument();
  });

  it('does not claim a decision is owed when the list is empty', () => {
    renderPending([]);

    expect(screen.getByText(/No 1:1 requests are pending right now/i)).toBeInTheDocument();
  });

  it('never tells an accepted-but-unpaid session that it is waiting on the expert', () => {
    const { container } = renderPending([
      session({ id: 'f', pendingState: 'accepted_awaiting_payment' }),
    ]);

    expect(container.textContent).not.toMatch(/waiting for you/i);
  });
});

describe('UpcomingSessionModal pending 1:1 copy for students', () => {
  const renderStudent = (sessions: UpcomingModalSession[]) =>
    render(
      <UpcomingSessionModal
        kind="oneToOne"
        status="pending"
        onClose={vi.fn()}
        sessions={sessions}
      />,
    );

  it('asks for payment when every request is the student\'s to pay', () => {
    renderStudent([session({ id: 'p', payable: true })]);

    expect(screen.getByText(/waiting for your payment/i)).toBeInTheDocument();
  });

  it('keeps the approval wording when nothing is payable yet', () => {
    renderStudent([session({ id: 'q', payable: false })]);

    expect(screen.getByText(/waiting for mentor approval/i)).toBeInTheDocument();
  });

  it('splits the difference when the list mixes states', () => {
    renderStudent([
      session({ id: 'r', payable: true }),
      session({ id: 's', payable: false }),
    ]);

    expect(screen.getByText(/Some of these are waiting for your payment/i)).toBeInTheDocument();
  });
});
