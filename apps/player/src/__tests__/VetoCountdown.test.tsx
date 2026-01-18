// apps/player/src/__tests__/VetoCountdown.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VetoCountdown } from '../components/VetoCountdown';

describe('VetoCountdown', () => {
  it('should show countdown timer when active', () => {
    render(
      <VetoCountdown
        remainingTime={10000}
        isActive={true}
      />
    );

    expect(screen.getByTestId('veto-countdown')).toHaveTextContent('10');
  });

  it('should not render when inactive', () => {
    render(
      <VetoCountdown
        remainingTime={10000}
        isActive={false}
      />
    );

    expect(screen.queryByTestId('veto-countdown')).not.toBeInTheDocument();
  });

  it('should show urgent styling when low time', () => {
    render(
      <VetoCountdown
        remainingTime={3000}
        isActive={true}
      />
    );

    const countdown = screen.getByTestId('veto-countdown');
    expect(countdown).toHaveClass('text-red-500');
  });

  it('should show veto opportunity message', () => {
    render(
      <VetoCountdown
        remainingTime={10000}
        isActive={true}
      />
    );

    expect(screen.getByText(/Challenge Window Open/i)).toBeInTheDocument();
  });

  it('should round up remaining seconds', () => {
    render(
      <VetoCountdown
        remainingTime={2500}
        isActive={true}
      />
    );

    expect(screen.getByTestId('veto-countdown')).toHaveTextContent('3');
  });
});
