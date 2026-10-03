import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { askSite } = vi.hoisted(() => ({
  askSite: vi.fn(),
}));

vi.mock('../api/api', () => ({
  askSite: (...args: unknown[]) => askSite(...args),
  doContactUs: vi.fn(),
}));

import Chatbot from './chatbot';
import { HELP_BOT_STORAGE_KEY } from './helpBot/types';

const STARTER_FAQS = [
  'How to accept a meeting?',
  'How to upload/change my avatar image?',
  'What does the calendar do?',
];

function renderBot() {
  return render(
    <MemoryRouter>
      <Chatbot />
    </MemoryRouter>,
  );
}

function expectUserBubble(text: string) {
  const bubble = screen.getByText(text);
  expect(bubble.className).toContain('bg-[#234C6A]');
  expect(bubble.className).toContain('text-white');
  expect(bubble.parentElement?.className).toContain('justify-end');
}

function expectBotAnswer(text: string) {
  const bubble = screen.getByText(text);
  const shell = bubble.closest('[class*="bg-slate-100"]') || bubble;
  expect(shell.className).toContain('bg-slate-100');
}

describe('HelpBot', () => {
  beforeEach(() => {
    askSite.mockReset();
    sessionStorage.removeItem(HELP_BOT_STORAGE_KEY);
  });

  it('keeps the transcript in component state and sends the last completed turns', async () => {
    askSite.mockImplementation(async (question: string) => {
      if (question === 'How do I book?') return { answer: 'Grounded one', similarQuestions: [] };
      if (question === 'Where are seminars?') {
        return {
          answer: 'Grounded two',
          similarQuestions: [{ id: 's1', question: 'Similar seminar question' }],
        };
      }
      throw new Error(`unexpected ${question}`);
    });

    renderBot();
    fireEvent.click(screen.getByRole('button', { name: 'Open HelpBot' }));

    fireEvent.change(screen.getByPlaceholderText('Ask a question…'), {
      target: { value: 'How do I book?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Grounded one')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Ask a question…'), {
      target: { value: 'Where are seminars?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Grounded two')).toBeInTheDocument();

    expect(screen.getByText('How do I book?')).toBeInTheDocument();
    expect(screen.getByText('Where are seminars?')).toBeInTheDocument();
    expect(askSite.mock.calls.map((call) => call[0])).toEqual([
      'How do I book?',
      'Where are seminars?',
    ]);
    expect(askSite.mock.calls[0]).toEqual(['How do I book?']);
    expect(askSite.mock.calls[1]).toEqual([
      'Where are seminars?',
      [
        { role: 'user', content: 'How do I book?' },
        { role: 'assistant', content: 'Grounded one' },
      ],
    ]);
    expect(screen.getByText('Similar seminar question')).toBeInTheDocument();
  });

  it('shows error bubble with retry when ask throws', async () => {
    askSite.mockRejectedValue(new Error('network'));

    renderBot();
    fireEvent.click(screen.getByRole('button', { name: 'Open HelpBot' }));
    fireEvent.change(screen.getByPlaceholderText('Ask a question…'), {
      target: { value: 'How do I book?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Something went wrong.')).toBeInTheDocument();
    expect(screen.getByText('How do I book?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
  });

  it('shows the question and typing indicator before a slow ask resolves', async () => {
    let resolveAsk: (value: unknown) => void = () => {};
    askSite.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAsk = resolve;
        }),
    );

    renderBot();
    fireEvent.click(screen.getByRole('button', { name: 'Open HelpBot' }));

    const dialog = screen.getByRole('dialog', { name: 'WisdomLinked Assistant' });
    const faqButtons = within(dialog)
      .getAllByRole('button')
      .filter((button) => STARTER_FAQS.includes((button.textContent ?? '').replace(/\s+/g, ' ').trim() as (typeof STARTER_FAQS)[number]) || STARTER_FAQS.some((faq) => (button.textContent ?? '').includes(faq)));
    const faqLabels = faqButtons
      .map((button) => STARTER_FAQS.find((faq) => (button.textContent ?? '').includes(faq)))
      .filter(Boolean);
    expect(faqLabels).toEqual(STARTER_FAQS);

    fireEvent.change(screen.getByPlaceholderText('Ask a question…'), {
      target: { value: 'How do I book?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(screen.getByText('How do I book?')).toBeInTheDocument();
    expect(screen.getByLabelText('HelpBot is answering')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    expect(screen.queryByText('How to accept a meeting?')).not.toBeInTheDocument();
    expectUserBubble('How do I book?');

    fireEvent.change(screen.getByPlaceholderText('Ask a question…'), {
      target: { value: 'Where are seminars?' },
    });
    fireEvent.submit(screen.getByPlaceholderText('Ask a question…').closest('form')!);
    expect(askSite).toHaveBeenCalledTimes(1);
    expect(askSite.mock.calls[0]).toEqual(['How do I book?']);
    const userBubbles = screen
      .queryAllByText('Where are seminars?')
      .filter((el) => el.className.includes('bg-[#234C6A]'));
    expect(userBubbles).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    expect(screen.getByLabelText('HelpBot is answering')).toBeInTheDocument();

    await act(async () => {
      resolveAsk({
        answer: 'Grounded one',
        similarQuestions: [{ id: 's1', question: 'Similar seminar question' }],
      });
    });

    expect(await screen.findByText('Grounded one')).toBeInTheDocument();
    expect(screen.queryByLabelText('HelpBot is answering')).not.toBeInTheDocument();
    expectUserBubble('How do I book?');
    expectBotAnswer('Grounded one');
    expect(screen.getByText('Similar seminar question')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).not.toBeDisabled();
  });

  it('resets to welcome on New chat', async () => {
    askSite.mockResolvedValue({ answer: 'Done', similarQuestions: [] });
    renderBot();
    fireEvent.click(screen.getByRole('button', { name: 'Open HelpBot' }));
    fireEvent.change(screen.getByPlaceholderText('Ask a question…'), {
      target: { value: 'Hello' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Done')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'New chat' }));
    expect(screen.getByText('Hi there 👋')).toBeInTheDocument();
    expect(screen.queryByText('Done')).not.toBeInTheDocument();
    expect(screen.getByText('How to accept a meeting?')).toBeInTheDocument();
  });

  it('opens the Contact Us form from Contact support', () => {
    renderBot();
    fireEvent.click(screen.getByRole('button', { name: 'Open HelpBot' }));
    fireEvent.click(screen.getByRole('button', { name: 'Contact support' }));
    expect(screen.getByRole('heading', { name: 'Contact Us' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
  });
});
