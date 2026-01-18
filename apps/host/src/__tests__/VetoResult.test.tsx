// apps/host/src/__tests__/VetoResult.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VetoResult } from '../components/VetoResult';

describe('VetoResult', () => {
  it('should show steal opportunity on successful veto', () => {
    render(
      <VetoResult
        success={true}
        challengingTeam="B"
        teamName="The Challengers"
      />
    );

    expect(screen.getByText(/steal opportunity/i)).toBeInTheDocument();
    expect(screen.getByText(/The Challengers/)).toBeInTheDocument();
  });

  it('should show failed message on unsuccessful veto', () => {
    render(
      <VetoResult
        success={false}
        challengingTeam="B"
        teamName="The Challengers"
      />
    );

    expect(screen.getByText(/challenge failed/i)).toBeInTheDocument();
  });

  it('should show token lost indicator', () => {
    render(
      <VetoResult
        success={false}
        challengingTeam="B"
        teamName="The Challengers"
      />
    );

    expect(screen.getByText(/token lost/i)).toBeInTheDocument();
  });

  it('should have success animation class when successful', () => {
    render(
      <VetoResult
        success={true}
        challengingTeam="A"
        teamName="Team A"
      />
    );

    const container = screen.getByTestId('veto-result');
    expect(container).toHaveClass('border-green-500');
  });

  it('should have failure animation class when unsuccessful', () => {
    render(
      <VetoResult
        success={false}
        challengingTeam="A"
        teamName="Team A"
      />
    );

    const container = screen.getByTestId('veto-result');
    expect(container).toHaveClass('border-red-500');
  });
});
