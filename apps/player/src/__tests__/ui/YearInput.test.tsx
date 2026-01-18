import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { YearInput } from '../../components/ui/YearInput';

describe('YearInput', () => {
  it('renders year value', () => {
    render(<YearInput value={1985} onChange={vi.fn()} />);

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(1985);
  });

  it('has increment button that increases year by 1', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<YearInput value={1985} onChange={onChange} />);

    const incrementButton = screen.getByRole('button', { name: /increase year/i });
    await user.click(incrementButton);

    expect(onChange).toHaveBeenCalledWith(1986);
  });

  it('has decrement button that decreases year by 1', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<YearInput value={1985} onChange={onChange} />);

    const decrementButton = screen.getByRole('button', { name: /decrease year/i });
    await user.click(decrementButton);

    expect(onChange).toHaveBeenCalledWith(1984);
  });

  it('respects min value constraint', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<YearInput value={1950} onChange={onChange} min={1950} />);

    const decrementButton = screen.getByRole('button', { name: /decrease year/i });
    await user.click(decrementButton);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('respects max value constraint', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<YearInput value={2030} onChange={onChange} max={2030} />);

    const incrementButton = screen.getByRole('button', { name: /increase year/i });
    await user.click(incrementButton);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('allows direct input of year value', () => {
    const onChange = vi.fn();
    render(<YearInput value={1985} onChange={onChange} />);

    const input = screen.getByRole('spinbutton');
    // Simulate direct value change
    fireEvent.change(input, { target: { value: '1999' } });

    // onChange called with the final value
    expect(onChange).toHaveBeenCalledWith(1999);
  });

  it('has touch-friendly button sizes (min 44px)', () => {
    const { container } = render(<YearInput value={1985} onChange={vi.fn()} />);

    const buttons = container.querySelectorAll('button');
    buttons.forEach(button => {
      expect(button).toHaveClass('min-h-[44px]');
      expect(button).toHaveClass('min-w-[44px]');
    });
  });

  it('supports disabled state', () => {
    render(<YearInput value={1985} onChange={vi.fn()} disabled />);

    const input = screen.getByRole('spinbutton');
    const incrementButton = screen.getByRole('button', { name: /increase year/i });
    const decrementButton = screen.getByRole('button', { name: /decrease year/i });

    expect(input).toBeDisabled();
    expect(incrementButton).toBeDisabled();
    expect(decrementButton).toBeDisabled();
  });
});
