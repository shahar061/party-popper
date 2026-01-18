// apps/player/src/__tests__/AnswerFeedback.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnswerFeedback } from '../components/AnswerFeedback';

describe('AnswerFeedback', () => {
  it('should show submission confirmed with checkmark', () => {
    render(
      <AnswerFeedback
        status="submitted"
        answer={{ artist: 'Queen', title: 'Bohemian Rhapsody', year: 1975 }}
      />
    );

    expect(screen.getByTestId('checkmark')).toBeInTheDocument();
    expect(screen.getByText(/submitted/i)).toBeInTheDocument();
  });

  it('should show result after reveal - correct', () => {
    render(
      <AnswerFeedback
        status="revealed"
        answer={{ artist: 'Queen', title: 'Bohemian Rhapsody', year: 1975 }}
        result={{ correct: true, pointsEarned: 3 }}
      />
    );

    expect(screen.getByText(/correct/i)).toBeInTheDocument();
    expect(screen.getByTestId('feedback-container')).toHaveClass('bg-green-500');
  });

  it('should show result after reveal - incorrect', () => {
    render(
      <AnswerFeedback
        status="revealed"
        answer={{ artist: 'Wrong', title: 'Wrong', year: 2000 }}
        result={{ correct: false, pointsEarned: 0 }}
      />
    );

    expect(screen.getByText(/incorrect/i)).toBeInTheDocument();
    expect(screen.getByTestId('feedback-container')).toHaveClass('bg-red-500');
  });

  it('should display points earned', () => {
    render(
      <AnswerFeedback
        status="revealed"
        answer={{ artist: 'Queen', title: 'Bohemian Rhapsody', year: 1976 }}
        result={{ correct: true, pointsEarned: 2.5 }}
      />
    );

    expect(screen.getByText('+2.5')).toBeInTheDocument();
  });

  it('should show submitted answer details', () => {
    render(
      <AnswerFeedback
        status="submitted"
        answer={{ artist: 'Queen', title: 'Bohemian Rhapsody', year: 1975 }}
      />
    );

    expect(screen.getByText('Queen')).toBeInTheDocument();
    expect(screen.getByText('Bohemian Rhapsody')).toBeInTheDocument();
    expect(screen.getByText('1975')).toBeInTheDocument();
  });

  it('should show partial points message', () => {
    render(
      <AnswerFeedback
        status="revealed"
        answer={{ artist: 'Queen', title: 'Wrong', year: 1975 }}
        result={{ correct: true, pointsEarned: 2 }}
      />
    );

    expect(screen.getByText(/partial/i)).toBeInTheDocument();
  });
});
