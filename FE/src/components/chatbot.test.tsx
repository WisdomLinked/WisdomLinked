import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { askSite } = vi.hoisted(() => ({
  askSite: vi.fn(),
}));

vi.mock('../api/api', () => ({
  askSite: (...args: unknown[]) => askSite(...args),
}));

import Chatbot from './chatbot';

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
    expect(screen.getByText('How to accept a meeting?')).toBeInTheDocument();
    expect(screen.getByText('How to upload/change my avatar image?')).toBeInTheDocument();
    expect(screen.getByText('What does the calendar do?')).toBeInTheDocument();
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
    const question = screen.getByText('How do I book?');
    expect(question.className).toContain('bg-[#234C6A]');
    expect(question.className).toContain('text-white');
    const answering = screen.getByLabelText('HelpBot is answering');
    expect(answering.className).toContain('border-[#E5E2DB]');
    expect(answering.className).toContain('text-[#234C6A]');

    await act(async () => {
      resolveAsk({
        answer: 'Grounded one',
        similarQuestions: [{ id: 's1', question: 'Similar seminar question' }],
      });
    });

    expect(await screen.findByText('Grounded one')).toBeInTheDocument();
    expect(screen.queryByLabelText('HelpBot is answering')).not.toBeInTheDocument();
    expect(screen.queryByText('Similar questions')).not.toBeInTheDocument();
    expect(screen.queryByText('Similar seminar question')).not.toBeInTheDocument();
    expect(screen.queryByText('No similar questions found.')).not.toBeInTheDocument();
  });
});
