// apps/host/src/__tests__/AnswerDisplay.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnswerDisplay } from '../components/AnswerDisplay';

describe('AnswerDisplay', () => {
  it('should show current team name prominently', () => {
    render(
      <AnswerDisplay
        teamName="Team Alpha"
        artist=""
        title=""
        year={null}
      />
    );

    expect(screen.getByText('Team Alpha')).toBeInTheDocument();
    expect(screen.getByText('Team Alpha')).toHaveClass('text-3xl');
  });

  it('should display artist field', () => {
    render(
      <AnswerDisplay
        teamName="Team A"
        artist="Queen"
        title=""
        year={null}
      />
    );

    expect(screen.getByText('Queen')).toBeInTheDocument();
    expect(screen.getByText('Artist')).toBeInTheDocument();
  });

  it('should display title field', () => {
    render(
      <AnswerDisplay
        teamName="Team A"
        artist=""
        title="Bohemian Rhapsody"
        year={null}
      />
    );

    expect(screen.getByText('Bohemian Rhapsody')).toBeInTheDocument();
    expect(screen.getByText('Title')).toBeInTheDocument();
  });

  it('should display year field', () => {
    render(
      <AnswerDisplay
        teamName="Team A"
        artist=""
        title=""
        year={1975}
      />
    );

    expect(screen.getByText('1975')).toBeInTheDocument();
    expect(screen.getByText('Year')).toBeInTheDocument();
  });

  it('should show placeholder when fields are empty', () => {
    render(
      <AnswerDisplay
        teamName="Team A"
        artist=""
        title=""
        year={null}
      />
    );

    const placeholders = screen.getAllByText('...');
    expect(placeholders.length).toBeGreaterThanOrEqual(3);
  });

  it('should update in real-time', () => {
    const { rerender } = render(
      <AnswerDisplay
        teamName="Team A"
        artist=""
        title=""
        year={null}
      />
    );

    rerender(
      <AnswerDisplay
        teamName="Team A"
        artist="Que"
        title=""
        year={null}
      />
    );

    expect(screen.getByText('Que')).toBeInTheDocument();
  });
});
