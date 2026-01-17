// apps/player/src/components/AnswerFeedback.tsx
interface Answer {
  artist: string;
  title: string;
  year: number;
}

interface Result {
  correct: boolean;
  pointsEarned: number;
}

interface AnswerFeedbackProps {
  status: 'submitted' | 'revealed';
  answer: Answer;
  result?: Result;
}

export function AnswerFeedback({ status, answer, result }: AnswerFeedbackProps) {
  const isRevealed = status === 'revealed';
  const isCorrect = result?.correct ?? false;
  const points = result?.pointsEarned ?? 0;
  const isPartial = isCorrect && points > 0 && points < 3;

  const getBackgroundClass = () => {
    if (!isRevealed) return 'bg-blue-500';
    if (points === 0) return 'bg-red-500';
    return 'bg-green-500';
  };

  return (
    <div
      data-testid="feedback-container"
      className={`
        w-full p-6 rounded-xl text-white text-center
        ${getBackgroundClass()}
      `}
    >
      {!isRevealed ? (
        <>
          <div className="flex items-center justify-center gap-2 mb-4">
            <span data-testid="checkmark" className="text-3xl">✓</span>
            <span className="text-xl font-bold">Answer Submitted!</span>
          </div>
        </>
      ) : (
        <>
          <div className="text-2xl font-bold mb-2">
            {points > 0 ? (
              isPartial ? 'Partial Correct!' : 'Correct!'
            ) : (
              'Incorrect'
            )}
          </div>
          <div className="text-4xl font-bold mb-4">
            +{points}
          </div>
        </>
      )}

      <div className="bg-black/20 rounded-lg p-4 mt-4">
        <div className="text-sm opacity-75 mb-1">Your Answer</div>
        <div className="font-medium">{answer.artist}</div>
        <div className="font-medium">{answer.title}</div>
        <div className="font-medium">{answer.year}</div>
      </div>
    </div>
  );
}
