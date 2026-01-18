import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JoinScreen } from '../components/JoinScreen';

describe('JoinScreen', () => {
  const mockOnJoin = vi.fn();

  beforeEach(() => {
    mockOnJoin.mockClear();
  });

  it('renders code input with 4 character limit', () => {
    render(<JoinScreen onJoin={mockOnJoin} />);

    const codeInput = screen.getByLabelText(/game code/i);
    expect(codeInput).toBeInTheDocument();
    expect(codeInput).toHaveAttribute('maxLength', '4');
  });

  it('auto-uppercases code input', async () => {
    const user = userEvent.setup();
    render(<JoinScreen onJoin={mockOnJoin} />);

    const codeInput = screen.getByLabelText(/game code/i);
    await user.type(codeInput, 'abcd');

    expect(codeInput).toHaveValue('ABCD');
  });

  it('renders name input with 20 character limit', () => {
    render(<JoinScreen onJoin={mockOnJoin} />);

    const nameInput = screen.getByLabelText(/your name/i);
    expect(nameInput).toBeInTheDocument();
    expect(nameInput).toHaveAttribute('maxLength', '20');
  });

  it('disables join button when code is incomplete', () => {
    render(<JoinScreen onJoin={mockOnJoin} />);

    const joinButton = screen.getByRole('button', { name: /join/i });
    expect(joinButton).toBeDisabled();
  });

  it('disables join button when name is empty', async () => {
    const user = userEvent.setup();
    render(<JoinScreen onJoin={mockOnJoin} />);

    const codeInput = screen.getByLabelText(/game code/i);
    await user.type(codeInput, 'ABCD');

    const joinButton = screen.getByRole('button', { name: /join/i });
    expect(joinButton).toBeDisabled();
  });

  it('enables join button when code and name are valid', async () => {
    const user = userEvent.setup();
    render(<JoinScreen onJoin={mockOnJoin} />);

    const codeInput = screen.getByLabelText(/game code/i);
    const nameInput = screen.getByLabelText(/your name/i);

    await user.type(codeInput, 'ABCD');
    await user.type(nameInput, 'Player1');

    const joinButton = screen.getByRole('button', { name: /join/i });
    expect(joinButton).toBeEnabled();
  });

  it('calls onJoin with code and name when form is submitted', async () => {
    const user = userEvent.setup();
    render(<JoinScreen onJoin={mockOnJoin} />);

    const codeInput = screen.getByLabelText(/game code/i);
    const nameInput = screen.getByLabelText(/your name/i);

    await user.type(codeInput, 'ABCD');
    await user.type(nameInput, 'Player1');
    await user.click(screen.getByRole('button', { name: /join/i }));

    expect(mockOnJoin).toHaveBeenCalledWith({
      code: 'ABCD',
      name: 'Player1',
    });
  });

  it('shows error message when provided', () => {
    render(<JoinScreen onJoin={mockOnJoin} error="Game not found" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Game not found');
  });

  it('shows loading state when isLoading is true', () => {
    render(<JoinScreen onJoin={mockOnJoin} isLoading />);

    expect(screen.getByText(/joining/i)).toBeInTheDocument();
  });
});
