import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { askSite } = vi.hoisted(() => ({
  askSite: vi.fn(),
}));

vi.mock('../api/api', () => ({
  askSite: (...args: unknown[]) => askSite(...args),
}));

import Chatbot from './chatbot';

const STARTER_FAQS = [
  'How to accept a meeting?',
  'How to upload/change my avatar image?',
  'What does the calendar do?',
];

function expectUserBubble(text: string) {
  const bubble = screen.getByText(text);
  expect(bubble.className).toContain('bg-[#234C6A]');
  expect(bubble.className).toContain('text-white');
  expect(bubble.parentElement?.className).toContain('justify-end');
}

function expectBotBubble(bubble: HTMLElement) {
  const hasBotBackground =
    bubble.className.includes('bg-white') || bubble.className.includes('bg-[#F5F3EF]');
  expect(hasBotBackground).toBe(true);
  expect(bubble.className).toContain('text-[#234C6A]');
  expect(bubble.className).toContain('border-[#E5E2DB]');
  expect(bubble.parentElement?.className).toContain('justify-start');
}

describe('HelpBot', () => {
  beforeEach(() => {
    askSite.mockReset();
  });

  it('keeps the transcript in component state and sends only the current question', async () => {
    askSite.mockImplementation(async (question: string) => {
      if (question === 'How do I book?') return { answer: 'Grounded one', similarQuestions: [] };
      if (question === 'Where are seminars?') {
        return { answer: 'Grounded two', similarQuestions: [{ id: 's1', question: 'Similar seminar question' }] };
      }
      throw new Error(`unexpected ${question}`);
    });

    render(<Chatbot />);
    fireEvent.click(screen.getByRole('button', { name: 'Open HelpBot' }));

    fireEvent.change(screen.getByPlaceholderText('Ask me a question...'), {
      target: { value: 'How do I book?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Grounded one')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Ask me a question...'), {
      target: { value: 'Where are seminars?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Grounded two')).toBeInTheDocument();

    expect(screen.getByText('How do I book?')).toBeInTheDocument();
    expect(screen.getByText('Where are seminars?')).toBeInTheDocument();
    expect(askSite.mock.calls.map((call) => call[0])).toEqual(['How do I book?', 'Where are seminars?']);
    expect(askSite.mock.calls[1]).toEqual(['Where are seminars?']);
  });

  it('does not read response.answer when ask throws', async () => {
    askSite.mockRejectedValue(new Error('network'));

    render(<Chatbot />);
    fireEvent.click(screen.getByRole('button', { name: 'Open HelpBot' }));
    fireEvent.change(screen.getByPlaceholderText('Ask me a question...'), {
      target: { value: 'How do I book?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText("I couldn't reach HelpBot just now. Please try again.")).toBeInTheDocument();
    expect(screen.getByText('How do I book?')).toBeInTheDocument();
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
  });

  it('shows the question and a spinner before a slow ask resolves and hides similar questions', async () => {
    let resolveAsk: (value: unknown) => void = () => {};
    askSite.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAsk = resolve;
        }),
    );

    render(<Chatbot />);
    fireEvent.click(screen.getByRole('button', { name: 'Open HelpBot' }));
    const starterButtons = screen
      .getAllByRole('button')
      .filter((button) => (button.textContent ?? '').trim().endsWith('?'));
    expect(starterButtons.map((button) => button.textContent)).toEqual(STARTER_FAQS);
    expect(screen.queryByText('Similar questions')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Ask me a question...'), {
      target: { value: 'How do I book?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(screen.getByText('How do I book?')).toBeInTheDocument();
    expect(screen.getByLabelText('HelpBot is answering')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    expect(screen.queryByText('Similar questions')).not.toBeInTheDocument();
    expect(screen.queryByText('No similar questions found.')).not.toBeInTheDocument();
    expect(screen.queryByText('How to accept a meeting?')).not.toBeInTheDocument();
    expectUserBubble('How do I book?');
    const answering = screen.getByLabelText('HelpBot is answering');
    expectBotBubble(answering);
    expect(answering.querySelector('.animate-spin')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Ask me a question...'), {
      target: { value: 'Where are seminars?' },
    });
    fireEvent.submit(screen.getByPlaceholderText('Ask me a question...').closest('form')!);
    expect(askSite).toHaveBeenCalledTimes(1);
    expect(askSite.mock.calls[0]).toEqual(['How do I book?']);
    expect(screen.queryByText('Where are seminars?')).not.toBeInTheDocument();
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
    expectBotBubble(screen.getByText('Grounded one'));
    expect(screen.queryByText('Similar questions')).not.toBeInTheDocument();
    expect(screen.queryByText('Similar seminar question')).not.toBeInTheDocument();
    expect(screen.queryByText('No similar questions found.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).not.toBeDisabled();
  });
});
