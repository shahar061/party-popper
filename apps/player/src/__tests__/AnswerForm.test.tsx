// apps/player/src/__tests__/AnswerForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnswerForm } from '../components/AnswerForm';

describe('AnswerForm', () => {
  const mockOnSubmit = vi.fn();
  const mockOnTyping = vi.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
    mockOnTyping.mockClear();
  });

  it('should render artist text input', () => {
    render(<AnswerForm onSubmit={mockOnSubmit} onTyping={mockOnTyping} />);

    expect(screen.getByLabelText(/artist/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/artist/i)).toHaveAttribute('type', 'text');
  });

  it('should render title text input', () => {
    render(<AnswerForm onSubmit={mockOnSubmit} onTyping={mockOnTyping} />);

    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
  });

  it('should render year number input with valid range', () => {
    render(<AnswerForm onSubmit={mockOnSubmit} onTyping={mockOnTyping} />);

    const yearInput = screen.getByLabelText(/year/i);
    expect(yearInput).toHaveAttribute('type', 'number');
    expect(yearInput).toHaveAttribute('min', '1950');
    expect(yearInput).toHaveAttribute('max', '2030');
  });

  it('should render submit button', () => {
    render(<AnswerForm onSubmit={mockOnSubmit} onTyping={mockOnTyping} />);

    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('should call onSubmit with form values', async () => {
    const user = userEvent.setup();
    render(<AnswerForm onSubmit={mockOnSubmit} onTyping={mockOnTyping} />);

    await user.type(screen.getByLabelText(/artist/i), 'Queen');
    await user.type(screen.getByLabelText(/title/i), 'Bohemian Rhapsody');
    await user.type(screen.getByLabelText(/year/i), '1975');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(mockOnSubmit).toHaveBeenCalledWith({
      artist: 'Queen',
      title: 'Bohemian Rhapsody',
      year: 1975
    });
  });

  it('should show loading state when isSubmitting is true', () => {
    render(
      <AnswerForm
        onSubmit={mockOnSubmit}
        onTyping={mockOnTyping}
        isSubmitting={true}
      />
    );

    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByText(/submitting/i)).toBeInTheDocument();
  });

  it('should disable form when disabled prop is true', () => {
    render(
      <AnswerForm
        onSubmit={mockOnSubmit}
        onTyping={mockOnTyping}
        disabled={true}
      />
    );

    expect(screen.getByLabelText(/artist/i)).toBeDisabled();
    expect(screen.getByLabelText(/title/i)).toBeDisabled();
    expect(screen.getByLabelText(/year/i)).toBeDisabled();
  });
});
