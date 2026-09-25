import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AnswerText from './AnswerText';

describe('AnswerText', () => {
    it('renders bold without asterisks', () => {
        const { container } = render(<AnswerText text="**Hello**" />);
        const strong = container.querySelector('strong');
        expect(strong).not.toBeNull();
        expect(strong).toHaveTextContent('Hello');
        expect(strong).toHaveClass('font-semibold');
        expect(container.textContent).not.toContain('*');
    });

    it('renders a numbered list', () => {
        const { container } = render(<AnswerText text={'1. First\n2. Second'} />);
        const list = container.querySelector('ol');
        expect(list).not.toBeNull();
        const items = list!.querySelectorAll('li');
        expect(items).toHaveLength(2);
        expect(items[0]).toHaveTextContent('First');
        expect(items[1]).toHaveTextContent('Second');
    });

    it('renders a bullet list', () => {
        const { container } = render(<AnswerText text={'- One\n* Two'} />);
        const list = container.querySelector('ul');
        expect(list).not.toBeNull();
        const items = list!.querySelectorAll('li');
        expect(items).toHaveLength(2);
        expect(items[0]).toHaveTextContent('One');
        expect(items[1]).toHaveTextContent('Two');
    });

    it('keeps script and img tags as text', () => {
        const raw = '<script>alert(1)</script><img src=x onerror=alert(1)>';
        const { container } = render(<AnswerText text={raw} />);
        expect(container.querySelector('script')).toBeNull();
        expect(container.querySelector('img')).toBeNull();
        expect(container.textContent).toContain(raw);
    });
});
