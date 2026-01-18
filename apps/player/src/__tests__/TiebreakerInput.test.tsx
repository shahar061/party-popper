// apps/player/src/__tests__/TiebreakerInput.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TiebreakerInput } from '../components/TiebreakerInput';

describe('TiebreakerInput', () => {
  it('should show tiebreaker indicator', () => {
    render(
      <TiebreakerInput
        onSubmit={vi.fn()}
        hasSubmitted={false}
      />
    );

    expect(screen.getByText(/tiebreaker/i)).toBeInTheDocument();
  });

  it('should show both teams active message', () => {
    render(
      <TiebreakerInput
        onSubmit={vi.fn()}
        hasSubmitted={false}
      />
    );

    expect(screen.getByText(/both teams/i)).toBeInTheDocument();
  });

  it('should have input fields for artist, title, and year', () => {
    render(
      <TiebreakerInput
        onSubmit={vi.fn()}
        hasSubmitted={false}
      />
    );

    expect(screen.getByPlaceholderText(/artist/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/title/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/year/i)).toBeInTheDocument();
  });

  it('should call onSubmit with answer values', () => {
    const onSubmit = vi.fn();
    render(
      <TiebreakerInput
        onSubmit={onSubmit}
        hasSubmitted={false}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/artist/i), { target: { value: 'Queen' } });
    fireEvent.change(screen.getByPlaceholderText(/title/i), { target: { value: 'Bohemian Rhapsody' } });
    fireEvent.change(screen.getByPlaceholderText(/year/i), { target: { value: '1975' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      artist: 'Queen',
      title: 'Bohemian Rhapsody',
      year: '1975'
    });
  });

  it('should show submitted feedback after submission', () => {
    render(
      <TiebreakerInput
        onSubmit={vi.fn()}
        hasSubmitted={true}
      />
    );

    expect(screen.getByText(/submitted/i)).toBeInTheDocument();
  });

  it('should disable inputs after submission', () => {
    render(
      <TiebreakerInput
        onSubmit={vi.fn()}
        hasSubmitted={true}
      />
    );

    expect(screen.getByPlaceholderText(/artist/i)).toBeDisabled();
    expect(screen.getByPlaceholderText(/title/i)).toBeDisabled();
    expect(screen.getByPlaceholderText(/year/i)).toBeDisabled();
  });
});
