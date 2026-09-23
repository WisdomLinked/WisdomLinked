import { fireEvent, render, screen } from '@testing-library/react';
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
});
