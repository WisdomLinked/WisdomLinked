import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FormAlert from './FormAlert';

describe('FormAlert', () => {
    it('renders nothing when message is empty', () => {
        const { container } = render(<FormAlert message="" />);
        expect(container.firstChild).toBeNull();
    });

    it('renders error message with alert role', () => {
        render(<FormAlert variant="error" message="Invalid credentials" />);
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent('Invalid credentials');
    });

    it('calls onDismiss when dismiss button is clicked', () => {
        const onDismiss = vi.fn();
        render(
            <FormAlert variant="error" message="Failed" onDismiss={onDismiss} />,
        );
        fireEvent.click(screen.getByLabelText('Dismiss'));
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('uses status role for success variant', () => {
        render(<FormAlert variant="success" message="Saved" />);
        expect(screen.getByRole('status')).toHaveTextContent('Saved');
    });
});
