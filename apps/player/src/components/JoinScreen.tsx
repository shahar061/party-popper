import { FormEvent } from 'react';
import { useJoinGame } from '../hooks/useJoinGame';

interface JoinScreenProps {
  onJoin: (data: { code: string; name: string }) => void;
  isLoading?: boolean;
  error?: string | null;
}

export function JoinScreen({ onJoin, isLoading = false, error }: JoinScreenProps) {
  const { code, name, setCode, setName, isValid } = useJoinGame();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isValid && !isLoading) {
      onJoin({ code, name: name.trim() });
    }
  };

  return (
    <div className="flex flex-col flex-1 justify-center">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Party Popper</h1>
        <p className="text-game-muted">Join a game to play</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="game-code"
            className="block text-sm font-medium text-game-muted mb-2"
          >
            Game Code
          </label>
          <input
            id="game-code"
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ABCD"
            className="w-full px-4 py-4 text-2xl text-center font-mono tracking-[0.5em]
                       bg-game-surface border-2 border-game-border rounded-xl
                       text-game-text placeholder-game-muted
                       focus:border-team-a-500 focus:outline-none focus:ring-2 focus:ring-team-a-500/50
                       transition-colors"
            aria-describedby={error ? 'join-error' : undefined}
          />
        </div>

        <div>
          <label
            htmlFor="player-name"
            className="block text-sm font-medium text-game-muted mb-2"
          >
            Your Name
          </label>
          <input
            id="player-name"
            type="text"
            autoComplete="name"
            autoCorrect="off"
            maxLength={20}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-4 py-4 text-lg
                       bg-game-surface border-2 border-game-border rounded-xl
                       text-game-text placeholder-game-muted
                       focus:border-team-a-500 focus:outline-none focus:ring-2 focus:ring-team-a-500/50
                       transition-colors"
          />
        </div>

        {error && (
          <div
            id="join-error"
            role="alert"
            className="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!isValid || isLoading}
          className="w-full py-4 px-6 text-lg font-semibold
                     bg-team-a-600 hover:bg-team-a-500
                     disabled:bg-game-surface disabled:text-game-muted disabled:cursor-not-allowed
                     rounded-xl text-white
                     focus:outline-none focus:ring-2 focus:ring-team-a-500 focus:ring-offset-2 focus:ring-offset-game-bg
                     transition-colors"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Joining...
            </span>
          ) : (
            'Join Game'
          )}
        </button>
      </form>
    </div>
  );
}
